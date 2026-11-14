package os.nex.tv

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.net.URL
import java.security.MessageDigest
import javax.net.ssl.HttpsURLConnection

/**
 * Apps Android que el ISP carga en el panel (mdm_company_android_apps, ver schema-mdm-v12.sql).
 *
 * - "apk": NEX TV lo baja del bucket público mdm-apps, verifica tamaño y sha256 (los da el sync por HTTPS), que el
 *   paquete y el versionCode del archivo sean los declarados, y lo instala sin preguntar (app de sistema con
 *   INSTALL_PACKAGES). Si el ISP la quita, desinstala solo las apps que instaló NEX (managed.json).
 * - "play": no se puede instalar de la Play Store sin que el usuario confirme; mientras no esté instalada, la UI
 *   muestra un mosaico "Instalar" que abre su ficha en la Play Store (openPlay).
 *
 * Nunca toca NEX, la Play Store y sus servicios, ni apps de sistema.
 */
object ManagedApps {
    private const val TAG = "nex-apps-isp"
    private const val MAX_SIZE = 200L * 1024 * 1024
    private const val RETRY_SECONDS = 6 * 3600L
    const val PLAY_PREFIX = "/android-play/"

    private val PATH = Regex("[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}\\.apk")
    private val PACKAGE = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")
    private val SHA = Regex("[0-9a-f]{64}")

    data class Entry(val pkg: String, val name: String, val source: String, val path: String?,
                     val versionCode: Long, val sha256: String?, val size: Long)

    @Volatile private var busy = false

    private fun dir(ctx: Context) = File(ctx.filesDir, "agent/apps").apply { mkdirs() }
    private fun managedFile(ctx: Context) = File(dir(ctx), "managed.json")
    private fun failedFile(ctx: Context) = File(dir(ctx), "failed.json")

    private fun protected(ctx: Context, pkg: String) =
        pkg == ctx.packageName || pkg in AndroidApps.PLAY_SUPPORT || pkg == AndroidApps.CHROME

    /** Lista válida del sync (las entradas mal formadas se ignoran). */
    fun entries(cfg: JSONObject?): List<Entry> {
        val arr = cfg?.optJSONArray("android_apps") ?: return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            val pkg = o.optString("package")
            val source = o.optString("source")
            if (!PACKAGE.matches(pkg) || pkg.length > 150 || source !in setOf("play", "apk")) return@mapNotNull null
            val name = o.optString("name").trim().take(60).ifEmpty { pkg }
            if (source == "play") return@mapNotNull Entry(pkg, name, source, null, 0, null, 0)
            val path = o.optString("apk_path")
            val sha = o.optString("sha256")
            val vc = o.optLong("version_code", 0)
            val size = o.optLong("size", 0)
            if (!PATH.matches(path) || !SHA.matches(sha) || vc <= 0 || size !in 1..MAX_SIZE) return@mapNotNull null
            Entry(pkg, name, source, path, vc, sha, size)
        }
    }

    // ---- Estado instalado ----

    private fun info(ctx: Context, pkg: String): PackageInfo? =
        runCatching { ctx.packageManager.getPackageInfo(pkg, 0) }.getOrNull()

    @Suppress("DEPRECATION")
    private fun versionOf(p: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) p.longVersionCode else p.versionCode.toLong()

    private fun isSystem(p: PackageInfo) = (p.applicationInfo?.flags ?: 0) and ApplicationInfo.FLAG_SYSTEM != 0

    /** Apps de la Play Store cargadas por el ISP que todavía no están instaladas (para el mosaico "Instalar"). */
    fun playPending(ctx: Context, cfg: JSONObject?): List<Entry> =
        entries(cfg).filter { it.source == "play" && !protected(ctx, it.pkg) && info(ctx, it.pkg) == null }

    /** Abre la ficha de la Play Store, solo para apps de la lista del ISP y con el equipo activo. */
    fun openPlay(ctx: Context, cfg: JSONObject?, pkg: String): Boolean {
        if (Agent.mode != "active" || entries(cfg).none { it.source == "play" && it.pkg == pkg }) return false
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
            .setPackage(AndroidApps.PLAY_STORE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { ctx.startActivity(intent) }.onFailure { Log.w(TAG, "no se pudo abrir la Play Store", it) }.isSuccess
    }

    // ---- Sincronización ----

    /** Lo llama el agente después de cada sync válido. Una operación a la vez, en segundo plano. */
    @Synchronized
    fun sync(ctx: Context, cfg: JSONObject, mdmUrl: String) {
        if (busy || BuildConfig.DEMO) return
        val app = ctx.applicationContext
        val wanted = entries(cfg).filterNot { protected(app, it.pkg) }
        val managed = readMap(managedFile(app))

        // 1. Quitar lo que NEX instaló y el ISP ya no quiere (o pasó a Play Store: se deja, ya es del usuario).
        val wantedApk = wanted.filter { it.source == "apk" }.map { it.pkg }.toSet()
        val wantedAny = wanted.map { it.pkg }.toSet()
        val removable = managed.keys.firstOrNull { it !in wantedAny }
        if (removable != null) {
            val p = info(app, removable)
            if (p == null || isSystem(p)) {
                writeMap(managedFile(app), managed - removable)
            } else {
                busy = true
                uninstall(app, removable)
                return
            }
        }
        // Una app que pasó de APK a Play Store deja de ser administrada por NEX, pero queda instalada.
        val moved = managed.keys.filter { it in wantedAny && it !in wantedApk }
        if (moved.isNotEmpty()) writeMap(managedFile(app), managed - moved.toSet())

        // 2. Instalar o actualizar el primer APK pendiente.
        val now = System.currentTimeMillis() / 1000
        val failed = readMap(failedFile(app))
        val next = wanted.firstOrNull { e ->
            if (e.source != "apk") return@firstOrNull false
            val p = info(app, e.pkg)
            if (p != null && (isSystem(p) || versionOf(p) >= e.versionCode)) return@firstOrNull false
            now - (failed["${e.pkg}@${e.versionCode}"] ?: 0) >= RETRY_SECONDS
        } ?: return
        busy = true
        Thread({ install(app, next, mdmUrl) }, "nex-apps-isp").apply { isDaemon = true }.start()
    }

    private fun install(ctx: Context, e: Entry, mdmUrl: String) {
        val part = File(dir(ctx), "${e.pkg}.apk.part")
        try {
            download("$mdmUrl/storage/v1/object/public/mdm-apps/${e.path}", e, part)
            // El archivo tiene que ser la app y la versión que dice el panel.
            @Suppress("DEPRECATION")
            val archive = ctx.packageManager.getPackageArchiveInfo(part.path, 0) ?: error("el archivo no es un APK válido")
            check(archive.packageName == e.pkg) { "el APK es de otro paquete (${archive.packageName})" }
            check(versionOf(archive) == e.versionCode) { "el APK tiene otra versión (${versionOf(archive)})" }
            commit(ctx, e, part)
        } catch (ex: Exception) {
            failed(ctx, e.pkg, e.versionCode, ex.message ?: "error")
        } finally {
            part.delete()
        }
    }

    private fun download(url: String, e: Entry, part: File) {
        val conn = URL(url).openConnection() as? HttpsURLConnection ?: error("se requiere HTTPS")
        conn.connectTimeout = 30_000
        conn.readTimeout = 60_000
        conn.instanceFollowRedirects = false
        try {
            check(conn.responseCode == 200) { "HTTP ${conn.responseCode}" }
            val digest = MessageDigest.getInstance("SHA-256")
            var total = 0L
            conn.inputStream.use { input ->
                part.outputStream().use { out ->
                    val buf = ByteArray(16 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        total += n
                        check(total <= e.size) { "descarga excede el tamaño declarado" }
                        digest.update(buf, 0, n)
                        out.write(buf, 0, n)
                    }
                }
            }
            check(total == e.size) { "tamaño descargado incorrecto" }
            check(digest.digest().joinToString("") { "%02x".format(it) } == e.sha256) { "sha256 no coincide" }
        } finally {
            conn.disconnect()
        }
    }

    private fun commit(ctx: Context, e: Entry, apk: File) {
        val installer = ctx.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(e.pkg)
            setSize(apk.length())
        }
        val id = installer.createSession(params)
        try {
            installer.openSession(id).use { session ->
                session.openWrite("base.apk", 0, apk.length()).use { out ->
                    apk.inputStream().use { it.copyTo(out) }
                    session.fsync(out)
                }
                session.commit(pending(ctx, id, "install", e.pkg, e.versionCode).intentSender)
            }
        } catch (ex: Exception) {
            runCatching { installer.abandonSession(id) }
            throw ex
        }
    }

    private fun uninstall(ctx: Context, pkg: String) {
        runCatching {
            ctx.packageManager.packageInstaller.uninstall(pkg, pending(ctx, pkg.hashCode(), "uninstall", pkg, 0).intentSender)
        }.onFailure { done(ctx, "uninstall", pkg, 0, false, it.message ?: "error") }
    }

    private fun pending(ctx: Context, code: Int, op: String, pkg: String, vc: Long): PendingIntent {
        val intent = Intent(ctx, ManagedAppReceiver::class.java)
            .putExtra("op", op).putExtra("pkg", pkg).putExtra("vc", vc)
        // PackageInstaller agrega el estado al intent: el PendingIntent debe ser mutable.
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
        return PendingIntent.getBroadcast(ctx, code, intent, flags)
    }

    /** Resultado de una instalación o desinstalación (ManagedAppReceiver). */
    @Synchronized
    internal fun done(ctx: Context, op: String, pkg: String, vc: Long, ok: Boolean, message: String) {
        busy = false
        val managed = readMap(managedFile(ctx))
        if (op == "install") {
            if (ok) {
                writeMap(managedFile(ctx), managed + (pkg to vc))
                writeMap(failedFile(ctx), readMap(failedFile(ctx)).filterKeys { !it.startsWith("$pkg@") })
                Agent.addEvent("app_installed", JSONObject().put("package", pkg).put("version", vc))
                Log.i(TAG, "instalada $pkg ($vc)")
            } else {
                failed(ctx, pkg, vc, message)
                return
            }
        } else {
            // Si no se pudo desinstalar se deja de administrar igual: no se reintenta en cada sync.
            writeMap(managedFile(ctx), managed - pkg)
            Agent.addEvent(if (ok) "app_removed" else "app_install_failed",
                JSONObject().put("package", pkg).apply { if (!ok) put("reason", "desinstalar: $message".take(200)) })
        }
        Agent.requestUiRefresh()
    }

    @Synchronized
    private fun failed(ctx: Context, pkg: String, vc: Long, reason: String) {
        busy = false
        val now = System.currentTimeMillis() / 1000
        writeMap(failedFile(ctx), readMap(failedFile(ctx)) + ("$pkg@$vc" to now))
        Agent.addEvent("app_install_failed", JSONObject().put("package", pkg).put("version", vc).put("reason", reason.take(200)))
        Log.w(TAG, "no se pudo instalar $pkg: $reason")
    }

    private fun readMap(f: File): Map<String, Long> = runCatching {
        val o = JSONObject(f.readText())
        o.keys().asSequence().associateWith { o.getLong(it) }
    }.getOrDefault(emptyMap())

    private fun writeMap(f: File, map: Map<String, Long>) {
        val o = JSONObject()
        map.forEach { (k, v) -> o.put(k, v) }
        val tmp = File(f.parentFile, "${f.name}.tmp")
        tmp.writeText(o.toString())
        if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) }
    }
}

class ManagedAppReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE).orEmpty()
        val op = intent.getStringExtra("op") ?: return
        val pkg = intent.getStringExtra("pkg") ?: return
        val vc = intent.getLongExtra("vc", 0)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // Nunca se abre la confirmación: sin INSTALL_PACKAGES/DELETE_PACKAGES no se instala ni desinstala.
            val id = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)
            if (id >= 0) runCatching { context.packageManager.packageInstaller.abandonSession(id) }
            ManagedApps.done(context, op, pkg, vc, false, "NEX TV no es app de sistema (falta permiso)")
            return
        }
        ManagedApps.done(context, op, pkg, vc, status == PackageInstaller.STATUS_SUCCESS, "estado $status: $message")
    }
}
