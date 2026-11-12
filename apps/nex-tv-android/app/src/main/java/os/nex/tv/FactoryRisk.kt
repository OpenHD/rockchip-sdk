package os.nex.tv

import android.content.Context
import android.content.pm.PackageManager
import android.net.TrafficStats
import android.os.Process
import android.os.SystemClock
import android.system.Os
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Señales de equipo comprometido en TV box HiSilicon con firmware de fábrica vulnerable.
 *
 * Basado en lo que documentó CureBox (macch-ai/curebox, docs/HANDOFF.md) sobre los Hi3798MV310 "bigfish" del
 * incidente de CAPPI: equipos quietos subiendo 40-100 Mbps, con un shell root remoto de fábrica (cmd_root en TCP/40000),
 * ADB por red sin autenticación (TCP/5555), su con setuid y apps que le mandan comandos (com.example.himac) o
 * instalan cosas a distancia (com.lz.sysplugin).
 *
 * NEX solo informa: cerrar esos accesos requiere reparar el firmware (CureBox). Nada de esto prueba una infección;
 * la subida alta sostenida es la señal fuerte, las puertas abiertas son riesgo.
 *
 * - subida: promedio de los últimos 5 min sin contar el tráfico de NEX (health.up_mbps). Si pasa de UPLOAD_ALERT_MBPS
 *   en 3 ventanas seguidas (15 min), evento upload_anomaly (uno cada 6 h).
 * - puertas: puertos de fábrica escuchando, su con setuid y apps de control remoto habilitadas (health.factory).
 *   Evento factory_backdoor al arrancar y cada vez que cambia lo encontrado.
 */
object FactoryRisk {
    private const val TAG = "nex-risk"
    private const val WINDOW_MS = 5 * 60_000L
    const val UPLOAD_ALERT_MBPS = 5.0
    private const val ALERT_WINDOWS = 3
    private const val ALERT_EVERY_MS = 6 * 3600_000L

    /** Puertos que el firmware de fábrica deja abiertos: shell root remoto y ADB por red. */
    private val PORTS = mapOf(40000 to "cmd_root", 5555 to "adb")
    private val SU_PATHS = listOf("/system/xbin/su", "/system/bin/su", "/sbin/su")
    /** Apps de fábrica que ejecutan comandos o instalan a distancia. */
    private val REMOTE_PACKAGES = listOf("com.example.himac", "com.lz.sysplugin")

    @Volatile var uploadMbps: Double? = null
        private set
    @Volatile var factory: JSONObject? = null
        private set

    private var windowStart = 0L
    private var txStart = 0L
    private var highWindows = 0
    private var lastAlert = 0L
    private var lastFactory = ""

    /** Lo llama el agente en cada vuelta (cada 5 s); mide y avisa solo cuando cierra una ventana de 5 min. */
    @Synchronized
    fun tick(ctx: Context) {
        val now = SystemClock.elapsedRealtime()
        val tx = otherTxBytes() ?: return
        if (windowStart == 0L || tx < txStart) {
            windowStart = now
            txStart = tx
            checkFactory(ctx)
            return
        }
        if (now - windowStart < WINDOW_MS) return
        val mbps = (tx - txStart) * 8.0 / ((now - windowStart) / 1000.0) / 1_000_000
        uploadMbps = Math.round(mbps * 10) / 10.0
        windowStart = now
        txStart = tx
        highWindows = if (mbps >= UPLOAD_ALERT_MBPS) highWindows + 1 else 0
        if (highWindows >= ALERT_WINDOWS && (lastAlert == 0L || now - lastAlert >= ALERT_EVERY_MS)) {
            lastAlert = now
            Agent.addEvent("upload_anomaly", JSONObject().put("mbps", uploadMbps).put("minutes", highWindows * 5))
            Log.w(TAG, "subida sostenida de $uploadMbps Mbps sin uso")
        }
        checkFactory(ctx)
    }

    /** Bytes subidos por todo el equipo menos NEX (el sync y los diagnósticos no cuentan). */
    private fun otherTxBytes(): Long? {
        val total = TrafficStats.getTotalTxBytes()
        if (total == TrafficStats.UNSUPPORTED.toLong() || total < 0) return null
        val own = TrafficStats.getUidTxBytes(Process.myUid()).takeIf { it >= 0 } ?: 0
        return total - own
    }

    private fun checkFactory(ctx: Context) {
        val o = JSONObject()
        val ports = listeningPorts().filter { it in PORTS }.sorted()
        if (ports.isNotEmpty()) o.put("ports", JSONArray(ports))
        if (SU_PATHS.any(::isSetuid)) o.put("su", true)
        val pkgs = REMOTE_PACKAGES.filter { enabled(ctx, it) }
        if (pkgs.isNotEmpty()) o.put("pkgs", JSONArray(pkgs))
        factory = o
        val key = o.toString()
        if (key != lastFactory) {
            lastFactory = key
            if (o.length() > 0) Agent.addEvent("factory_backdoor", o)
        }
    }

    /** Puertos TCP en LISTEN según /proc/net/tcp y tcp6 (legibles sin root hasta Android 9). */
    private fun listeningPorts(): Set<Int> {
        val out = HashSet<Int>()
        for (f in listOf("/proc/net/tcp", "/proc/net/tcp6")) {
            runCatching {
                File(f).readLines().drop(1).forEach { line ->
                    val cols = line.trim().split(Regex("\\s+"))
                    if (cols.size > 3 && cols[3] == "0A") {
                        cols[1].substringAfterLast(':').toIntOrNull(16)?.let(out::add)
                    }
                }
            }
        }
        return out
    }

    private fun isSetuid(path: String): Boolean =
        runCatching { Os.stat(path).st_mode and 0x800 != 0 }.getOrDefault(false)

    private fun enabled(ctx: Context, pkg: String): Boolean = runCatching {
        val state = ctx.packageManager.getApplicationEnabledSetting(pkg)
        val info = ctx.packageManager.getApplicationInfo(pkg, 0)
        info.enabled && state != PackageManager.COMPONENT_ENABLED_STATE_DISABLED &&
            state != PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER
    }.getOrDefault(false)

    fun putHealth(status: JSONObject) {
        uploadMbps?.let { status.put("up_mbps", it) }
        factory?.let { status.put("factory", it) }
    }
}
