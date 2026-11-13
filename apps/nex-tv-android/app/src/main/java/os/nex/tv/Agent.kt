package os.nex.tv

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * nex-agent para Android: misma lógica que
 * device/rockchip/common/overlays/rootfs/nex-os/nex-agent (ver apps/nex-os/docs/GESTION_REMOTA.md).
 *
 * - Token de 256 bits en el almacenamiento privado de la app; viaja solo en el cuerpo HTTPS.
 * - Es la fuente de verdad del equipo: calcula el modo (vinculación, bloqueado, activo),
 *   arma la lista blanca que aplica el WebView y publica el estado de solo lectura para la UI.
 * - Falla cerrado: sin configuración válida, la lista blanca solo incluye Supabase.
 */
object Agent {
    private const val TAG = "nex-agent"
    private const val AGENT_VERSION = 3
    private const val SYNC_INTERVAL = 60L
    private const val REPORT_INTERVAL = 300L
    private const val LOOP_MS = 5_000L
    private const val MAX_RESPONSE = 2 * 1024 * 1024
    private const val MAX_LOGO = 1024 * 1024

    private val mdmUrl = BuildConfig.MDM_URL.trimEnd('/')
    private val mdmKey = BuildConfig.MDM_ANON_KEY
    private val mdmHost: String? = runCatching { URL(mdmUrl).host.lowercase() }.getOrNull()
        ?.takeIf { mdmUrl.startsWith("https://") }

    private lateinit var app: Context
    private lateinit var dir: File
    private val tokenFile get() = File(dir, "token")
    private val configFile get() = File(dir, "config.json")
    private val pairingFile get() = File(dir, "pairing.json")
    private val lastSyncFile get() = File(dir, "last_sync")
    private val serverEpochFile get() = File(dir, "server_epoch")
    private val eventsFile get() = File(dir, "events.jsonl")
    private val appliedFile get() = File(dir, "applied_mode")
    private val bootFile get() = File(dir, "boot")
    private val demoStateFile get() = File(dir, "demo_state")
    private val noticesSeenFile get() = File(dir, "notices_seen")
    private val diagReqFile get() = File(dir, "diag_req")
    val logoDir: File get() = File(dir, "branding")

    val wifiToken: String = ByteArray(32).also { SecureRandom().nextBytes(it) }
        .joinToString("") { "%02x".format(it.toInt() and 255) }

    /** Estado publicado para la UI (/agent/ui-state.json). */
    @Volatile var uiState: String = JSONObject().put("mode", "starting").put("wifi_token", wifiToken).toString()
        private set
    @Volatile var mode: String = "starting"
        private set
    @Volatile private var allowed: Set<String> = emptySet()
    @Volatile private var denied: Set<String> = emptySet()

    /** La actividad lo escucha para volver a la UI (equivale a reiniciar Chromium). */
    @Volatile var onRestartUi: ((String) -> Unit)? = null

    private val blockedHits = ConcurrentHashMap<String, Int>()
    private var lockKind = ""
    private var reason = ""
    private var payWarn = false
    private val onceKeys = HashSet<String>()
    @Volatile private var forceSync = false
    @Volatile private var diagRunning = false

    fun start(context: Context) {
        if (::app.isInitialized) return
        app = context.applicationContext
        dir = File(app.filesDir, "agent").apply { mkdirs() }
        Updater.start(app)
        Thread(::main, "nex-agent").apply { isDaemon = true }.start()
    }

    // ---- Filtro de navegación (lo consulta el WebView) ----

    /** Lista blanca por dominio y subdominios; un dominio de piratería gana aunque esté dentro de uno permitido. */
    fun isAllowed(host: String?): Boolean {
        val h = host?.lowercase()?.trimEnd('.') ?: return false
        if (matches(h, denied)) return false
        return matches(h, allowed)
    }

    fun recordBlocked(host: String?) {
        val h = host?.lowercase()?.trimEnd('.') ?: return
        if (h.isEmpty() || h == mdmHost || !DOMAIN.matches(h)) return
        if (blockedHits.size < 1000 || blockedHits.containsKey(h)) blockedHits.merge(h, 1, Int::plus)
    }

    private fun matches(h: String, set: Set<String>) =
        set.any { d -> h == d || h.endsWith(".$d") }

    // ---- Bucle principal ----

    private fun main() {
        // Mismo arranque del sistema = el proceso se reinició sin reiniciar el equipo.
        val bootId = ((System.currentTimeMillis() - SystemClock.elapsedRealtime()) / 60_000).toString()
        if (bootFile.readOrNull() == bootId) {
            addEvent("agent_restarted")
        } else {
            addEvent("agent_started", JSONObject().put("firmware", firmware()))
        }
        bootFile.writeAtomic(bootId)

        var lastSyncTry = 0L
        var lastReport = now()
        var prevMode = ""
        while (true) {
            try {
                val t = now()
                val interval = if (prevMode in setOf("", "starting", "unpaired")) 10L else SYNC_INTERVAL
                if (forceSync || t - lastSyncTry >= interval) {
                    forceSync = false
                    lastSyncTry = t
                    if (syncRemote()) {
                        updateLogo()
                        config()?.let { cfg ->
                            if (mode == "active" || mode == "starting") ManagedApps.sync(app, cfg, mdmUrl)
                            maybeRunDiag(cfg)
                        }
                    }
                }

                computeMode()
                val prevAllowed = allowed
                applyAllowlist()
                // Bloqueado: Android cierra las apps que salen de la lista del kiosko.
                Kiosk.syncPackages(app)
                publishUiState()
                reportModeChange()
                if (mode != "starting" && mode != "unpaired" && !Kiosk.isOwner(app)) {
                    addEventOnce("image_not_hardened")
                }

                if (prevMode == "active" && mode != "active") {
                    restartUi("modo $mode")
                } else if (mode == "active" && prevMode == "active" && !allowed.containsAll(prevAllowed)) {
                    restartUi("app desactivada")
                }
                prevMode = mode

                FactoryRisk.tick(app)
                if (t - lastReport >= REPORT_INTERVAL || NetDiag.lastQuick == null) {
                    NetDiag.quickAsync(app)
                }
                if (t - lastReport >= REPORT_INTERVAL) {
                    lastReport = t
                    reportBlocked()
                }
            } catch (e: Exception) {
                Log.w(TAG, "error en el ciclo", e)
            }
            Thread.sleep(LOOP_MS)
        }
    }

    private fun restartUi(why: String) {
        Log.i(TAG, "$why: reiniciando la interfaz")
        onRestartUi?.invoke(why)
        // Si había una app Android adelante, NEX-OS vuelve al frente (Device Owner puede hacerlo desde segundo plano).
        runCatching {
            app.startActivity(Intent(app, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT))
        }.onFailure { Log.w(TAG, "no se pudo traer NEX-OS al frente", it) }
    }

    // ---- Sincronización ----

    private fun ensureToken(): String {
        tokenFile.readOrNull()?.takeIf { TOKEN.matches(it) }?.let { return it }
        Log.i(TAG, "generando token de equipo")
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val token = bytes.joinToString("") { "%02x".format(it) }
        tokenFile.writeAtomic(token)
        configFile.delete()
        pairingFile.delete()
        return token
    }

    private fun rpc(fn: String, body: JSONObject): JSONObject? {
        body.put("p_token", ensureToken())
        val conn = (URL("$mdmUrl/rest/v1/rpc/$fn").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("apikey", mdmKey)
            setRequestProperty("Authorization", "Bearer $mdmKey")
            setRequestProperty("Content-Type", "application/json")
        }
        return try {
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            if (conn.responseCode !in 200..299) {
                Log.w(TAG, "rpc $fn: HTTP ${conn.responseCode}")
                return null
            }
            val text = conn.inputStream.use { readLimited(it, MAX_RESPONSE) }?.toString(Charsets.UTF_8) ?: return null
            if (text.isBlank() || text == "null") JSONObject() else JSONObject(text)
        } catch (e: Exception) {
            Log.w(TAG, "rpc $fn falló (sin conexión?): ${e.message}")
            null
        } finally {
            conn.disconnect()
        }
    }

    private fun syncRemote(): Boolean {
        if (BuildConfig.DEMO) return syncDemo()
        if (mdmHost == null || mdmKey.isEmpty()) {
            Log.w(TAG, "sin nex.mdmUrl/nex.mdmAnonKey en la compilación")
            return false
        }
        val hw = hardwareId()
        val events = readEvents()
        var resp = rpc("mdm_device_sync", JSONObject()
            .put("p_firmware", firmware())
            .put("p_status", statusJson())
            .put("p_events", JSONArray(events))
            .put("p_hardware_id", hw ?: JSONObject.NULL)) ?: return false
        var status = resp.optString("status")

        // Entregados: se quitan de la cola los que se mandaron.
        if (status.isNotEmpty() && status != "unknown") dropEvents(events.size)

        if (status == "unknown") {
            // Token desconocido: alta nueva, o re-enrolamiento si el hardware ya era de una empresa.
            resp = rpc("mdm_device_register", JSONObject()
                .put("p_firmware", firmware())
                .put("p_hardware_id", hw ?: JSONObject.NULL)) ?: return false
            status = resp.optString("status")
            when (status) {
                "unpaired" -> {}
                "paired" -> {
                    resp = rpc("mdm_device_sync", JSONObject().put("p_firmware", firmware())
                        .put("p_status", statusJson())) ?: return false
                    status = resp.optString("status")
                }
                else -> return false
            }
        }

        when (status) {
            "unpaired" -> {
                pairingFile.writeAtomic(JSONObject()
                    .put("pairing_code", resp.opt("pairing_code"))
                    .put("pairing_expires_at", resp.opt("pairing_expires_at")).toString())
                configFile.delete()
            }
            "paired" -> {
                if (resp.optJSONObject("company")?.has("id") != true || resp.optJSONArray("apps") == null) {
                    Log.w(TAG, "respuesta de sync inválida")
                    return false
                }
                configFile.writeAtomic(resp.toString())
                pairingFile.delete()
            }
            else -> {
                Log.w(TAG, "estado de sync desconocido: $status")
                return false
            }
        }

        Updater.offer(app, resp.optJSONObject("update"))
        lastSyncFile.writeAtomic(now().toString())
        val ep = resp.opt("server_epoch")
        if (ep is Number && ep.toLong() > 0) serverEpochFile.writeAtomic(ep.toLong().toString())
        return true
    }

    /** Demo: la respuesta del "servidor" sale de Demo.kt y se guarda igual que una real. */
    private fun syncDemo(): Boolean {
        val state = demoStateFile.readOrNull()?.takeIf { it in Demo.STATES } ?: "activo"
        val resp = Demo.syncResponse(state, now())
        dropEvents(readEvents().size)
        if (resp.optString("status") == "unpaired") {
            pairingFile.writeAtomic(JSONObject()
                .put("pairing_code", resp.opt("pairing_code"))
                .put("pairing_expires_at", resp.opt("pairing_expires_at")).toString())
            configFile.delete()
        } else {
            configFile.writeAtomic(resp.toString())
            pairingFile.delete()
        }
        lastSyncFile.writeAtomic(now().toString())
        serverEpochFile.writeAtomic(now().toString())
        return true
    }

    /** Cambia el escenario de la demo; se aplica en la próxima vuelta del ciclo (≤ 5 s). */
    fun setDemoState(state: String) {
        if (!BuildConfig.DEMO || !::dir.isInitialized) return
        Log.i(TAG, "demo: escenario $state")
        demoStateFile.writeAtomic(state)
        forceSync = true
    }

    // ---- Modo efectivo: starting | unpaired | locked | active ----
    // Prioridad: bloqueo manual > pago vencido > reloj inválido > días sin conexión.

    private fun computeMode() {
        reason = ""
        lockKind = ""
        payWarn = false
        val cfg = config()
        if (cfg != null) {
            val last = lastSyncFile.readOrNull()?.toLongOrNull() ?: 0L
            val days = cfg.optJSONObject("company")?.optLong("offline_lock_days", 7) ?: 7
            // La hora nunca se toma menor a la última hora del servidor.
            val clock = now()
            val srv = serverEpochFile.readOrNull()?.toLongOrNull() ?: 0L
            val t = maxOf(clock, srv)
            val payment = cfg.optJSONObject("payment")
            // Con control de pago, una fecha que no es número bloquea (falla cerrado).
            val lockAt = when {
                payment == null -> 0L
                payment.opt("lock_at") is Number -> payment.getDouble("lock_at").toLong()
                else -> 1L
            }
            val warnAt = (payment?.opt("warn_at") as? Number)?.toLong() ?: 0L
            when {
                cfg.optBoolean("locked") -> {
                    mode = "locked"; lockKind = "manual"; reason = cfg.str("lock_reason")
                }
                lockAt > 0 && t >= lockAt -> {
                    mode = "locked"; lockKind = "payment"; reason = payment?.str("message").orEmpty()
                }
                clock < last - 300 -> {
                    mode = "locked"; lockKind = "clock"
                    reason = "La hora del equipo es inválida. Conectalo a internet."
                }
                t - last > days * 86_400 -> {
                    mode = "locked"; lockKind = "offline"
                    reason = "El equipo estuvo más de $days días sin conexión. Conectalo a internet."
                }
                else -> {
                    mode = "active"
                    payWarn = warnAt > 0 && t >= warnAt
                }
            }
        } else if (pairingFile.exists()) {
            mode = "unpaired"
        } else {
            mode = "starting"
        }
    }

    private fun applyAllowlist() {
        val cfg = config()
        val allow = HashSet<String>()
        mdmHost?.let(allow::add)
        BuildConfig.BASE_DOMAINS.split(' ').forEach { allow.add(it) }
        if (mode == "active" && cfg != null) {
            val apps = cfg.optJSONArray("apps") ?: JSONArray()
            for (i in 0 until apps.length()) {
                val domains = apps.optJSONObject(i)?.optJSONArray("domains") ?: continue
                for (j in 0 until domains.length()) allow.add(domains.optString(j))
            }
        }
        val deny = HashSet<String>()
        cfg?.optJSONArray("blocked_domains")?.let { for (i in 0 until it.length()) deny.add(it.optString(i)) }
        denied = deny.map { it.lowercase() }.filter { DOMAIN.matches(it) && '.' in it }.toSet()
        allowed = allow.map { it.lowercase() }
            .filter { DOMAIN.matches(it) && '.' in it }
            .filterNot { d -> matches(d, denied) }
            .toSet()
    }

    // ---- Estado para la UI ----

    private fun publishUiState() {
        val cfg = config() ?: JSONObject()
        val pair = pairingFile.readOrNull()?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()
        val company = cfg.optJSONObject("company") ?: JSONObject()
        val logo = currentLogo()?.name
        val apps = JSONArray()
        if (mode == "active") {
            // Solo las apps Android (Play Store y las instaladas), con su ícono real. Las web del catálogo de la
            // empresa no se muestran: el WebView no tiene Widevine y no reproduce Netflix, Disney+, Prime Video
            // ni Spotify (la versión Linux sí las muestra). Viajan como "web" con una URL del origen local que
            // UiServer convierte en "abrir la app".
            for (a in AndroidApps.list(app)) {
                apps.put(JSONObject()
                    .put("id", "android:${a.pkg}".take(41)).put("name", a.label.take(60))
                    .put("kind", "web").put("launch_url", "${UiServer.ORIGIN}${AndroidApps.LAUNCH_PREFIX}${a.pkg}")
                    .put("icon", "${AndroidApps.ICON_PREFIX}${a.pkg}"))
            }
            // Apps de la Play Store que cargó el ISP y todavía no están instaladas: mosaico "Instalar".
            for (e in ManagedApps.playPending(app, cfg)) {
                apps.put(JSONObject()
                    .put("id", "play:${e.pkg}".take(41)).put("name", e.name)
                    .put("kind", "web").put("launch_url", "${UiServer.ORIGIN}${ManagedApps.PLAY_PREFIX}${e.pkg}")
                    .put("icon", JSONObject.NULL).put("install", true))
            }
        }
        // Nunca se publica el token del MDM ni la configuración cruda.
        val owner = Kiosk.isOwner(app)
        uiState = JSONObject()
            .put("wifi_token", wifiToken)
            .put("mode", mode)
            // Sin Device Owner la UI ofrece al técnico activarlo con root (si el equipo lo tiene).
            .put("owner", owner)
            .put("root", !owner && Provision.hasRoot())
            .put("updated_at", now())
            // Versión instalada, para mostrarla en Ajustes.
            .put("version", BuildConfig.VERSION_NAME)
            .put("build", BuildConfig.VERSION_CODE)
            .put("logo", logo?.let { "/agent/$it" } ?: JSONObject.NULL)
            .put("company_name", company.opt("name") ?: JSONObject.NULL)
            .put("device_name", cfg.optJSONObject("device")?.opt("name") ?: JSONObject.NULL)
            .put("lock_message", if (mode == "locked") company.opt("lock_message") ?: JSONObject.NULL else JSONObject.NULL)
            .put("lock_kind", lockKind.ifEmpty { null } ?: JSONObject.NULL)
            .put("lock_reason", reason.ifEmpty { null } ?: JSONObject.NULL)
            .put("payment_due", if (payWarn) cfg.optJSONObject("payment")?.opt("paid_until") ?: JSONObject.NULL else JSONObject.NULL)
            .put("pairing_code", if (mode == "unpaired") pair.opt("pairing_code") ?: JSONObject.NULL else JSONObject.NULL)
            .put("pairing_expires_at", if (mode == "unpaired") pair.opt("pairing_expires_at") ?: JSONObject.NULL else JSONObject.NULL)
            .put("apps", apps)
            .put("notices", pendingNotices(cfg).also(::surfaceEmergencies))
            .toString()
    }

    // ---- Comunicados del ISP ----

    private val UUID_RE = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

    private fun seenNotices(): Set<String> =
        noticesSeenFile.readOrNull()?.lines()?.filter { UUID_RE.matches(it) }?.toSet() ?: emptySet()

    /** Vigentes y todavía no vistos en este equipo (texto plano: la UI no lo interpreta como HTML). */
    private fun pendingNotices(cfg: JSONObject): JSONArray {
        val out = JSONArray()
        val list = cfg.optJSONArray("notices") ?: return out
        val seen = seenNotices()
        val t = maxOf(now(), serverEpochFile.readOrNull()?.toLongOrNull() ?: 0L)
        // Se filtra antes de cortar en 5: uno nuevo no queda escondido detrás de otros ya vistos.
        for (i in 0 until minOf(list.length(), 20)) {
            if (out.length() >= 5) break
            val n = list.optJSONObject(i) ?: continue
            val id = n.optString("id")
            if (!UUID_RE.matches(id) || id in seen || n.optLong("expires_at", 0) <= t) continue
            val severity = n.optString("severity").takeIf { it in setOf("info", "importante", "emergencia") } ?: continue
            out.put(JSONObject().put("id", id)
                .put("title", n.str("title").take(80)).put("body", n.str("body").take(500))
                .put("category", n.optString("category", "general")).put("severity", severity)
                .put("expires_at", n.optLong("expires_at")))
        }
        return out
    }

    private val announced = HashSet<String>()

    /** Una emergencia nueva trae NEX TV al frente aunque el cliente esté en otra app (Netflix, YouTube...). */
    private fun surfaceEmergencies(notices: JSONArray) {
        for (i in 0 until notices.length()) {
            val n = notices.optJSONObject(i) ?: continue
            if (n.optString("severity") != "emergencia" || !announced.add(n.optString("id"))) continue
            Log.i(TAG, "comunicado de emergencia: trayendo NEX TV al frente")
            runCatching {
                app.startActivity(Intent(app, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT))
            }.onFailure { Log.w(TAG, "no se pudo traer NEX TV al frente", it) }
        }
    }

    /** La UI avisa que el usuario vio el comunicado: deja de mostrarse y se informa al panel. */
    fun markNoticeSeen(id: String): Boolean {
        if (!::dir.isInitialized || !UUID_RE.matches(id)) return false
        val cfg = config() ?: return false
        val list = cfg.optJSONArray("notices") ?: return false
        if ((0 until list.length()).none { list.optJSONObject(it)?.optString("id") == id }) return false
        val seen = seenNotices()
        if (id !in seen) {
            noticesSeenFile.writeAtomic((seen.toList().takeLast(49) + id).joinToString("\n"))
            addEvent("notice_seen", JSONObject().put("id", id))
        }
        requestUiRefresh()
        return true
    }

    /** Vuelve a publicar el estado para la UI (después de instalar una app o ver un comunicado). */
    fun requestUiRefresh() {
        if (!::dir.isInitialized) return
        runCatching { publishUiState() }.onFailure { Log.w(TAG, "no se pudo publicar el estado", it) }
    }

    // ---- Diagnóstico de red pedido desde el panel ----

    private fun maybeRunDiag(cfg: JSONObject) {
        val req = cfg.optLong("diag_request", 0)
        if (req <= 0 || diagRunning || req <= (diagReqFile.readOrNull()?.toLongOrNull() ?: 0L)) return
        diagReqFile.writeAtomic(req.toString())
        diagRunning = true
        Thread({
            try {
                addEvent("net_diag", NetDiag.full(app, req, mdmUrl))
                forceSync = true
            } catch (e: Exception) {
                addEvent("net_diag", JSONObject().put("req", req).put("error", (e.message ?: "error").take(120)))
            } finally {
                diagRunning = false
            }
        }, "nex-net-diag").apply { isDaemon = true }.start()
    }

    fun currentLogo(): File? =
        logoDir.listFiles()?.firstOrNull { LOGO_NAME.matches(it.name) }

    private fun updateLogo() {
        val path = config()?.optJSONObject("company")?.str("logo_path").orEmpty()
        logoDir.mkdirs()
        val source = File(logoDir, "source")
        if (path.isEmpty()) {
            logoDir.listFiles()?.forEach { it.delete() }
            return
        }
        if (!LOGO_PATH.matches(path) || source.readOrNull() == path) return
        val conn = (URL("$mdmUrl/storage/v1/object/public/mdm-branding/$path").openConnection() as HttpURLConnection)
            .apply { connectTimeout = 15_000; readTimeout = 30_000 }
        try {
            if (conn.responseCode != 200) return
            val bytes = conn.inputStream.use { readLimited(it, MAX_LOGO) } ?: return
            // Se valida por firma del archivo, no por extensión ni Content-Type.
            val ext = when {
                bytes.startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) -> "png"
                bytes.startsWith(0xff, 0xd8, 0xff) -> "jpg"
                bytes.size > 12 && bytes.startsWith(0x52, 0x49, 0x46, 0x46) &&
                    String(bytes, 8, 4, Charsets.US_ASCII) == "WEBP" -> "webp"
                else -> { Log.w(TAG, "logo rechazado: formato no permitido"); return }
            }
            logoDir.listFiles()?.filter { LOGO_NAME.matches(it.name) }?.forEach { it.delete() }
            File(logoDir, "logo.$ext").writeAtomic(bytes)
            source.writeAtomic(path)
            Log.i(TAG, "logo actualizado")
        } catch (e: Exception) {
            Log.w(TAG, "no se pudo descargar el logo: ${e.message}")
        } finally {
            conn.disconnect()
        }
    }

    // ---- Informes ----

    private fun statusJson(): JSONObject {
        val owner = Kiosk.isOwner(app)
        return JSONObject()
            .put("mode", mode)
            .put("lock_kind", lockKind.ifEmpty { null } ?: JSONObject.NULL)
            .put("hardened", owner)
            // En Android no hay dnsmasq/iptables: filtra el WebView (lista blanca por dominio).
            .put("dns_filter", false)
            .put("firewall", false)
            .put("webview_filter", true)
            .put("platform", "android")
            .put("build", BuildConfig.VERSION_CODE)
            .put("version", BuildConfig.VERSION_NAME)
            .put("uptime", SystemClock.elapsedRealtime() / 1000)
            .put("free_mb", app.filesDir.usableSpace / (1024 * 1024))
            .put("agent", AGENT_VERSION)
            .also { NetDiag.putDeviceHealth(app, it); FactoryRisk.putHealth(it) }
    }

    private fun reportBlocked() {
        if (config() == null || blockedHits.isEmpty()) return
        val snapshot = HashMap(blockedHits)
        snapshot.keys.forEach { blockedHits.remove(it) }
        val events = JSONArray()
        snapshot.entries.sortedByDescending { it.value }.take(200).forEach {
            events.put(JSONObject().put("domain", it.key).put("hits", it.value))
        }
        rpc("mdm_device_report", JSONObject().put("p_events", events))
            ?: Log.w(TAG, "no se pudo enviar el reporte de bloqueos")
    }

    /** Confirma al servidor el bloqueo/desbloqueo realmente aplicado. */
    private fun reportModeChange() {
        val cur = "$mode:$lockKind"
        val last = appliedFile.readOrNull().orEmpty()
        if (cur == last || mode == "starting" || mode == "unpaired") return
        if (mode == "locked") {
            addEvent("lock_applied", JSONObject().put("lock_kind", lockKind))
            if (lockKind == "clock") addEvent("clock_rollback")
        } else if (last.substringBefore(':') == "locked") {
            addEvent("unlock_applied")
        }
        appliedFile.writeAtomic(cur)
    }

    // ---- Cola de eventos (se conserva sin internet) ----

    @Synchronized
    internal fun addEvent(kind: String, details: JSONObject = JSONObject()) {
        val line = JSONObject().put("kind", kind).put("at", now()).put("details", details).toString()
        val lines = (eventsFile.readOrNull()?.lines()?.filter { it.isNotBlank() } ?: emptyList()) + line
        eventsFile.writeAtomic(lines.takeLast(100).joinToString("\n", postfix = "\n"))
        Log.i(TAG, "evento: $kind")
    }

    private fun addEventOnce(kind: String) {
        if (onceKeys.add(kind)) addEvent(kind)
    }

    @Synchronized
    private fun readEvents(): List<JSONObject> =
        eventsFile.readOrNull()?.lines()?.filter { it.isNotBlank() }
            ?.mapNotNull { runCatching { JSONObject(it) }.getOrNull() } ?: emptyList()

    @Synchronized
    private fun dropEvents(count: Int) {
        val lines = eventsFile.readOrNull()?.lines()?.filter { it.isNotBlank() } ?: return
        eventsFile.writeAtomic(lines.drop(count).joinToString("\n", postfix = "\n"))
    }

    // ---- Utilidades ----

    // optString devuelve "null" para valores null de JSON.
    private fun JSONObject.str(key: String): String =
        if (isNull(key)) "" else optString(key)

    /** Configuración del último sync (solo lectura, para UiServer). */
    fun configSnapshot(): JSONObject? = if (::dir.isInitialized) config() else null

    private fun config(): JSONObject? =
        configFile.readOrNull()?.let { runCatching { JSONObject(it) }.getOrNull() }

    private fun now() = System.currentTimeMillis() / 1000

    private fun firmware() = "android-${Build.VERSION.RELEASE}:${Build.DISPLAY}".take(120)

    /** Identificador estable de hardware: serie del equipo + CID del eMMC, hasheados. */
    @SuppressLint("HardwareIds", "MissingPermission")
    private fun hardwareId(): String? {
        val serial = runCatching {
            if (Build.VERSION.SDK_INT >= 26) Build.getSerial() else @Suppress("DEPRECATION") Build.SERIAL
        }.getOrNull()?.takeIf { it.isNotBlank() && it != Build.UNKNOWN }.orEmpty()
        val cid = (0..2).firstNotNullOfOrNull { File("/sys/block/mmcblk$it/device/cid").readOrNull() }.orEmpty()
        if (serial.isEmpty() && cid.isEmpty()) return null
        val digest = MessageDigest.getInstance("SHA-256").digest("nex-hw:$serial:$cid".toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun readLimited(input: InputStream, max: Int): ByteArray? {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(8192)
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            out.write(buf, 0, n)
            if (out.size() > max) return null
        }
        return out.toByteArray()
    }

    private fun ByteArray.startsWith(vararg b: Int) =
        size >= b.size && b.indices.all { this[it] == b[it].toByte() }

    private fun File.readOrNull(): String? =
        runCatching { readText().trim() }.getOrNull()?.takeIf { it.isNotEmpty() }

    // Escritura atómica: evita leer un archivo a medias.
    private fun File.writeAtomic(text: String) = writeAtomic(text.toByteArray())

    private fun File.writeAtomic(bytes: ByteArray) {
        val tmp = File(parentFile, "$name.tmp")
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(this)) {
            delete()
            tmp.renameTo(this)
        }
    }

    private val TOKEN = Regex("[0-9a-f]{64}")
    private val DOMAIN = Regex("[a-z0-9.-]{1,253}")
    private val LOGO_PATH = Regex("[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}")
    private val LOGO_NAME = Regex("logo\\.(png|jpg|webp)")
}
