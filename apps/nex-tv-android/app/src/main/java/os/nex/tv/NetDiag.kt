package os.nex.tv

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.SystemClock
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.InetAddress
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Mediciones para el semáforo de salud y el diagnóstico de red del panel (ver apps/nex-os/src/admin/health.ts).
 *
 * - quick(): liviana, cada 5 min en segundo plano: tipo de conexión, señal Wi-Fi, ping al router (gateway) y a
 *   internet. Viaja en health.net en cada sync.
 * - full(): la pide el panel. Suma enlace y banda Wi-Fi, DNS, tiempo al servidor de NEX y una prueba de bajada
 *   (hasta 25 MB u 8 s). Viaja como evento net_diag.
 *
 * Separa los tramos TV box → router/ONU → internet: si el router responde mal, el problema es la red de la casa;
 * si el router responde bien e internet no, es el acceso. Ningún valor es obligatorio: lo que no se puede medir
 * viaja como null.
 */
object NetDiag {
    private const val TAG = "nex-net"
    private const val INTERNET_HOST = "1.1.1.1"
    private const val DNS_HOST = "connectivitycheck.gstatic.com"
    private const val SPEED_URL = "https://speed.cloudflare.com/__down?bytes=25000000"
    private const val SPEED_MS = 8_000L

    @Volatile var lastQuick: JSONObject? = null
        private set
    @Volatile private var running = false

    // ---- Conexión ----

    private fun transport(ctx: Context): String {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return "none"
        val caps = cm.getNetworkCapabilities(cm.activeNetwork ?: return "none") ?: return "none"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "eth"
            else -> "other"
        }
    }

    private fun gateway(ctx: Context): String? {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return null
        val lp = cm.getLinkProperties(cm.activeNetwork ?: return null) ?: return null
        return lp.routes.filter { it.isDefaultRoute && it.gateway != null }
            .sortedBy { if (it.gateway is Inet4Address) 0 else 1 }
            .firstOrNull()?.gateway?.hostAddress?.substringBefore('%')
    }

    @Suppress("DEPRECATION")
    private fun wifi(ctx: Context): android.net.wifi.WifiInfo? =
        runCatching { ctx.applicationContext.getSystemService(WifiManager::class.java)?.connectionInfo }.getOrNull()

    // ---- ping (ICMP con /system/bin/ping; sin root el intervalo mínimo es 0,2 s) ----

    data class Ping(val avgMs: Double?, val lossPct: Int?)

    private val HOST = Regex("[0-9A-Fa-f.:]{2,45}")

    fun ping(host: String?, count: Int): Ping {
        if (host == null || !HOST.matches(host)) return Ping(null, null)
        return runCatching {
            val p = ProcessBuilder("/system/bin/ping", "-c", count.toString(), "-i", "0.2", "-W", "1", host)
                .redirectErrorStream(true).start()
            // Process.waitFor(timeout) es de API 26: un hilo corta el ping si se cuelga.
            val watchdog = Thread {
                try { Thread.sleep((count + 3) * 1000L); p.destroy() } catch (_: InterruptedException) {}
            }.apply { isDaemon = true; start() }
            val out = p.inputStream.bufferedReader().readText()
            watchdog.interrupt()
            val loss = Regex("([0-9.]+)% packet loss").find(out)?.groupValues?.get(1)?.toDoubleOrNull()?.toInt()
            val avg = Regex("= [0-9.]+/([0-9.]+)/").find(out)?.groupValues?.get(1)?.toDoubleOrNull()
            Ping(avg, loss)
        }.onFailure { Log.w(TAG, "ping falló: ${it.message}") }.getOrDefault(Ping(null, null))
    }

    // ---- Mediciones ----

    private fun base(ctx: Context, count: Int): JSONObject {
        val t = transport(ctx)
        val o = JSONObject().put("t", t)
        if (t == "wifi") wifi(ctx)?.let { w -> if (w.rssi in -127..0) o.put("rssi", w.rssi) }
        val gw = ping(gateway(ctx), count)
        val inet = ping(INTERNET_HOST, count)
        o.put("gw_ms", gw.avgMs?.round1() ?: JSONObject.NULL).put("gw_loss", gw.lossPct ?: JSONObject.NULL)
        o.put("inet_ms", inet.avgMs?.round1() ?: JSONObject.NULL).put("inet_loss", inet.lossPct ?: JSONObject.NULL)
        return o
    }

    /** Medición liviana en segundo plano; el resultado queda en lastQuick para el próximo sync. */
    fun quickAsync(ctx: Context) {
        if (running) return
        running = true
        Thread({
            try {
                lastQuick = base(ctx.applicationContext, 3)
            } catch (e: Exception) {
                Log.w(TAG, "medición liviana falló", e)
            } finally {
                running = false
            }
        }, "nex-net-quick").apply { isDaemon = true }.start()
    }

    /** Diagnóstico completo (bloquea ~15-25 s): llamarlo fuera del hilo del agente. */
    fun full(ctx: Context, req: Long, mdmUrl: String): JSONObject {
        val o = base(ctx, 10).put("req", req).put("at", System.currentTimeMillis() / 1000)
        if (o.optString("t") == "wifi") wifi(ctx)?.let { w ->
            if (w.linkSpeed > 0) o.put("link_mbps", w.linkSpeed)
            if (w.frequency > 0) o.put("freq_mhz", w.frequency)
        }
        o.put("dns_ms", timed(3_000) { InetAddress.getByName(DNS_HOST) } ?: JSONObject.NULL)
        o.put("mdm_ms", timed(8_000) { httpStatus("$mdmUrl/rest/v1/") } ?: JSONObject.NULL)
        o.put("down_mbps", download() ?: JSONObject.NULL)
        return o
    }

    private fun httpStatus(url: String): Int {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 5_000
        conn.readTimeout = 5_000
        return try { conn.responseCode } finally { conn.disconnect() }
    }

    /** ms que tarda block, o null si falla o pasa el tiempo límite. */
    private fun timed(timeoutMs: Long, block: () -> Any?): Long? {
        val pool = Executors.newSingleThreadExecutor()
        return try {
            val start = SystemClock.elapsedRealtime()
            pool.submit(block).get(timeoutMs, TimeUnit.MILLISECONDS)
            SystemClock.elapsedRealtime() - start
        } catch (_: Exception) {
            null
        } finally {
            pool.shutdownNow()
        }
    }

    /** Mbps de bajada: lee hasta 25 MB o 8 s, lo que pase primero. */
    private fun download(): Double? = runCatching {
        val conn = URL(SPEED_URL).openConnection() as HttpURLConnection
        conn.connectTimeout = 5_000
        conn.readTimeout = 5_000
        try {
            if (conn.responseCode != 200) return@runCatching null
            val buf = ByteArray(64 * 1024)
            var total = 0L
            val start = SystemClock.elapsedRealtime()
            conn.inputStream.use { input ->
                while (SystemClock.elapsedRealtime() - start < SPEED_MS) {
                    val n = input.read(buf)
                    if (n < 0) break
                    total += n
                }
            }
            val secs = (SystemClock.elapsedRealtime() - start) / 1000.0
            if (secs <= 0 || total < 256 * 1024) null else (total * 8 / secs / 1_000_000).round1()
        } finally {
            conn.disconnect()
        }
    }.getOrNull()

    private fun Double.round1() = Math.round(this * 10) / 10.0

    // ---- Salud del equipo (temperatura, memoria, almacenamiento) ----

    /** Temperatura máxima entre las zonas térmicas que da el kernel, en °C; null si no expone ninguna. */
    fun temperature(): Double? {
        val zones = File("/sys/class/thermal").listFiles { f -> f.name.startsWith("thermal_zone") } ?: return null
        return zones.mapNotNull { z ->
            val raw = runCatching { File(z, "temp").readText().trim().toDouble() }.getOrNull() ?: return@mapNotNull null
            val c = if (raw > 1000) raw / 1000 else raw
            c.takeIf { it in 1.0..150.0 }
        }.maxOrNull()?.round1()
    }

    fun putDeviceHealth(ctx: Context, status: JSONObject) {
        temperature()?.let { status.put("temp_c", it) }
        ctx.getSystemService(ActivityManager::class.java)?.let { am ->
            val mi = ActivityManager.MemoryInfo().also(am::getMemoryInfo)
            status.put("ram_avail_mb", mi.availMem / (1024 * 1024))
                .put("ram_total_mb", mi.totalMem / (1024 * 1024))
                .put("low_mem", mi.lowMemory)
        }
        status.put("storage_mb", ctx.filesDir.totalSpace / (1024 * 1024))
        lastQuick?.let { status.put("net", it) }
    }
}
