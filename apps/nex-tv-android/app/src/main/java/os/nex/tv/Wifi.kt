package os.nex.tv

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.SupplicantState
import android.net.wifi.WifiConfiguration
import android.net.wifi.WifiManager
import org.json.JSONArray
import org.json.JSONObject

/** Configuración local de red, disponible también con el equipo bloqueado. */
@Suppress("DEPRECATION")
@SuppressLint("MissingPermission")
object Wifi {
    private fun manager(ctx: Context) = ctx.applicationContext.getSystemService(WifiManager::class.java)
    private fun ssid(value: String?) = value?.removeSurrounding("\"")?.takeIf { it.isNotEmpty() && it != "<unknown ssid>" }
    // Android espera SSID y contraseña entre comillas y sin escapar: escapar cambiaría una clave con " o \.
    private fun quoted(value: String) = "\"" + value + "\""

    fun status(ctx: Context): JSONObject {
        val info = manager(ctx).connectionInfo
        val cm = ctx.getSystemService(ConnectivityManager::class.java)
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        val connected = info.supplicantState == SupplicantState.COMPLETED && info.ipAddress != 0
        val ip = info.ipAddress
        return JSONObject()
            .put("ssid", ssid(info.ssid) ?: JSONObject.NULL)
            .put("connected", connected)
            .put("level", if (connected) WifiManager.calculateSignalLevel(info.rssi, 5) else 0)
            .put("ip", if (connected) (0..3).joinToString(".") { ((ip ushr (it * 8)) and 255).toString() } else JSONObject.NULL)
            .put("ethernet", caps?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true)
    }

    fun scan(ctx: Context): JSONObject {
        val wifi = manager(ctx)
        if (!wifi.isWifiEnabled) wifi.setWifiEnabled(true)
        runCatching { wifi.startScan() }
        val saved = wifi.configuredNetworks.orEmpty().mapNotNull { ssid(it.SSID) }.toSet()
        val networks = wifi.scanResults.orEmpty().filter { it.SSID.isNotBlank() }
            .groupBy { it.SSID }.values.map { group -> group.maxBy { it.level } }
            .sortedByDescending { it.level }.take(40)
        return JSONObject().put("status", status(ctx)).put("networks", JSONArray().apply {
            networks.forEach { n ->
                val caps = n.capabilities.uppercase()
                put(JSONObject().put("ssid", n.SSID)
                    .put("level", WifiManager.calculateSignalLevel(n.level, 5))
                    .put("secure", listOf("WPA", "WEP", "SAE", "PSK", "EAP").any { caps.contains(it) })
                    .put("saved", n.SSID in saved)
                    .put("unsupported", caps.contains("EAP") || caps.contains("WEP") || (caps.contains("SAE") && !caps.contains("PSK"))))
            }
        })
    }

    fun connect(ctx: Context, ssid: String, password: String): JSONObject {
        fun result(ok: Boolean, error: String? = null) = JSONObject().put("ok", ok).put("error", error ?: JSONObject.NULL)
        if (ssid.isBlank() || ssid.toByteArray(Charsets.UTF_8).size > 32) return result(false, "Ingresá un nombre de red válido.")
        if (password.isNotEmpty() && password.length !in 8..63) return result(false, "La contraseña debe tener entre 8 y 63 caracteres.")
        return runCatching {
            val wifi = manager(ctx)
            if (!wifi.isWifiEnabled && !wifi.setWifiEnabled(true)) return result(false, "No se pudo activar Wi-Fi.")
            val previous = wifi.configuredNetworks.orEmpty().find { this.ssid(it.SSID) == ssid }
            val config = WifiConfiguration().apply {
                SSID = quoted(ssid)
                if (previous != null) networkId = previous.networkId
                if (password.isEmpty()) allowedKeyManagement.set(WifiConfiguration.KeyMgmt.NONE)
                else {
                    allowedKeyManagement.set(WifiConfiguration.KeyMgmt.WPA_PSK)
                    preSharedKey = quoted(password)
                }
            }
            val id = if (previous == null) wifi.addNetwork(config) else wifi.updateNetwork(config)
            val ok = id >= 0 && wifi.enableNetwork(id, true) && wifi.reconnect()
            result(ok, if (ok) null else "No se pudo iniciar la conexión.")
        }.getOrElse { result(false, "No se pudo configurar Wi-Fi.") }
    }
}
