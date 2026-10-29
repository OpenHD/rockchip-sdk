package os.nex.tv

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Base64
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import javax.net.ssl.HttpsURLConnection

/** Releases firmadas: la firma se verifica antes de abrir la conexión de descarga. */
object Updater {
    private const val TAG = "nex-updater"
    private var busy = false
    private var failed = ""
    private var warned = false

    private fun dir(ctx: Context) = File(ctx.filesDir, "agent").apply { mkdirs() }

    @Synchronized
    fun start(ctx: Context) {
        val last = File(dir(ctx), "update-last-build")
        val previous = runCatching { last.readText().trim().toInt() }.getOrNull()
        if (previous != null && BuildConfig.VERSION_CODE > previous) {
            Agent.addEvent("update_installed", JSONObject().put("build", BuildConfig.VERSION_CODE))
        }
        last.writeText(BuildConfig.VERSION_CODE.toString())
        if (BuildConfig.RELEASE_PUB_KEYS.isBlank() && !warned) {
            warned = true
            Log.w(TAG, "sin clave de releases: actualizaciones desactivadas")
        }
    }

    fun offer(ctx: Context, update: JSONObject?) = offer(ctx, update, false)

    /** Solo DemoReceiver (DUMP) habilita la excepción local del emulador. */
    internal fun offerDemo(ctx: Context, update: JSONObject) {
        if (BuildConfig.DEMO) offer(ctx, update, true)
    }

    @Synchronized
    private fun offer(ctx: Context, update: JSONObject?, test: Boolean) {
        if (update == null || (BuildConfig.DEMO && !test) || BuildConfig.RELEASE_PUB_KEYS.isBlank()) return
        val build = update.optLong("build", 0)
        if (build <= BuildConfig.VERSION_CODE || build > Int.MAX_VALUE || busy) return
        val root = dir(ctx)
        if (failed.isEmpty()) failed = runCatching { File(root, "update-failed").readText() }.getOrDefault("")
        val parts = failed.trim().split(' ')
        if (parts.size == 2 && parts[0] == build.toString() &&
            System.currentTimeMillis() / 1000 - (parts[1].toLongOrNull() ?: 0) < 6 * 3600) return
        val url = update.optString("url")
        val sha = update.optString("sha256")
        val size = update.optLong("size", 0)
        val rejection = when {
            !allowedUrl(url, test) -> "URL no permitida"
            !Regex("[0-9a-f]{64}").matches(sha) -> "sha256 inválido"
            size <= 0 || size > 300L * 1024 * 1024 -> "tamaño inválido"
            !verify(build, sha, update.optString("sig")) -> "firma inválida"
            else -> null
        }
        if (rejection != null) {
            Agent.addEvent("update_rejected", JSONObject().put("reason", rejection))
            return
        }
        busy = true
        val app = ctx.applicationContext
        Thread({
            val part = File(root, "update.apk.part")
            val apk = File(root, "update.apk")
            try {
                Agent.addEvent("update_started", JSONObject().put("build", build))
                download(url, test, size, sha, part)
                check(part.renameTo(apk)) { "no se pudo renombrar el APK" }
                install(app, apk, build.toInt())
                apk.delete()
            } catch (e: Exception) {
                part.delete()
                apk.delete()
                failure(app, build, e.message ?: "error de actualización")
            }
        }, "nex-updater").apply { isDaemon = true }.start()
    }

    private fun allowedUrl(value: String, test: Boolean): Boolean = runCatching {
        val url = URL(value)
        url.userInfo == null && (value.startsWith("https://") ||
            (BuildConfig.DEMO && test && url.protocol == "http" && url.host == "10.0.2.2" && url.port in 1..65535))
    }.getOrDefault(false)

    private fun verify(build: Long, sha: String, sig: String): Boolean =
        BuildConfig.RELEASE_PUB_KEYS.split(' ').filter { it.isNotBlank() }.any { key ->
            runCatching {
                val pub = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(Base64.decode(key, Base64.DEFAULT)))
                Signature.getInstance("SHA256withRSA").run {
                    initVerify(pub)
                    update("nex-update:v1:$build:$sha".toByteArray(Charsets.UTF_8))
                    verify(Base64.decode(sig, Base64.DEFAULT))
                }
            }.getOrDefault(false)
        }

    private fun download(url: String, test: Boolean, size: Long, sha: String, part: File) {
        val connection = URL(url).openConnection()
        // HTTP solo para el hook demo; no se siguen redirecciones que puedan degradar HTTPS.
        val conn = if (connection is HttpsURLConnection) connection else {
            check(BuildConfig.DEMO && test && allowedUrl(url, true)) { "se requiere HTTPS" }
            connection as HttpURLConnection
        }
        conn.connectTimeout = 30_000
        conn.readTimeout = 30_000
        conn.instanceFollowRedirects = false
        try {
            check(conn.responseCode == 200) { "HTTP ${conn.responseCode}" }
            val digest = MessageDigest.getInstance("SHA-256")
            var total = 0L
            conn.inputStream.use { input ->
                part.outputStream().use { output ->
                    val buffer = ByteArray(8192)
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        total += n
                        check(total <= size) { "descarga excede el tamaño declarado" }
                        digest.update(buffer, 0, n)
                        output.write(buffer, 0, n)
                    }
                }
            }
            check(total == size) { "tamaño descargado incorrecto" }
            check(digest.digest().joinToString("") { "%02x".format(it) } == sha) { "sha256 no coincide" }
        } finally {
            conn.disconnect()
        }
    }

    private fun install(ctx: Context, apk: File, build: Int) {
        val installer = ctx.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(ctx.packageName)
            setSize(apk.length())
        }
        val id = installer.createSession(params)
        try {
            installer.openSession(id).use { session ->
                session.openWrite("base.apk", 0, apk.length()).use { output ->
                    apk.inputStream().use { it.copyTo(output) }
                    session.fsync(output)
                }
                val intent = Intent(ctx, UpdateReceiver::class.java).putExtra("build", build)
                // PackageInstaller agrega el estado al intent: el PendingIntent debe ser mutable.
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
                session.commit(PendingIntent.getBroadcast(ctx, id, intent, flags).intentSender)
            }
        } catch (e: Exception) {
            runCatching { installer.abandonSession(id) }
            throw e
        }
    }

    @Synchronized
    internal fun failure(ctx: Context, build: Long, reason: String) {
        failed = "$build ${System.currentTimeMillis() / 1000}"
        File(dir(ctx), "update-failed").writeText(failed)
        File(dir(ctx), "update.apk").delete()
        busy = false
        Agent.addEvent("update_failed", JSONObject().put("reason", reason).put("build", build))
        Log.w(TAG, "actualización falló: $reason")
    }

    @Synchronized
    internal fun success(ctx: Context) {
        File(dir(ctx), "update.apk").delete()
        busy = false
    }
}

class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE).orEmpty()
        Log.i("nex-updater", "instalación: $status $message")
        if (status == PackageInstaller.STATUS_SUCCESS) {
            Updater.success(context)
        } else {
            // Incluye PENDING_USER_ACTION: nunca se abre la confirmación del instalador.
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                val id = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)
                if (id >= 0) runCatching { context.packageManager.packageInstaller.abandonSession(id) }
            }
            Updater.failure(context, intent.getIntExtra("build", 0).toLong(), "estado $status: $message")
        }
    }
}

/** NexApp inicia Agent; MainActivity.onResume vuelve a aplicar el kiosko. */
class PackageReplacedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        Agent.start(context)
        runCatching {
            context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }.onFailure { Log.w("nex-updater", "no se pudo abrir NEX TV", it) }
    }
}
