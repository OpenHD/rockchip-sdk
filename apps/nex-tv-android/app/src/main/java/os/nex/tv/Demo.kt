package os.nex.tv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Modo demo (compilado con -Pnex.demo=true): reemplaza al servidor MDM por una respuesta local con el
 * mismo formato que mdm_device_sync. Todo lo demás (modo efectivo, kiosko, filtro, UI) es el código real.
 *
 * Cambiar de escenario desde la PC:
 *   adb shell am broadcast -a os.nex.tv.DEMO -n os.nex.tv/.DemoReceiver --es state <escenario>
 */
object Demo {
    const val ACTION = "os.nex.tv.DEMO"
    val STATES = listOf("activo", "aviso", "pago", "bloqueado", "sin-vincular")

    /** Respuesta simulada del servidor para el escenario. Devuelve status "paired" o "unpaired". */
    fun syncResponse(state: String, now: Long): JSONObject {
        if (state == "sin-vincular") {
            return JSONObject()
                .put("status", "unpaired")
                .put("pairing_code", "482913")
                .put("pairing_expires_at", JSONObject.NULL)
                .put("server_epoch", now)
        }
        val day = 86_400L
        val payment = when (state) {
            "aviso" -> JSONObject().put("warn_at", now - day).put("lock_at", now + 3 * day)
                .put("paid_until", isoDate(now + 3 * day))
            "pago" -> JSONObject().put("warn_at", now - 4 * day).put("lock_at", now - day)
                .put("paid_until", isoDate(now - day))
                .put("message", "Tu servicio está suspendido por falta de pago. Comunicate con Demo ISP para regularizarlo.")
            else -> JSONObject.NULL
        }
        return JSONObject()
            .put("status", "paired")
            .put("server_epoch", now)
            .put("locked", state == "bloqueado")
            .put("lock_reason", if (state == "bloqueado") "Equipo bloqueado por el proveedor." else "")
            .put("payment", payment)
            .put("company", JSONObject()
                .put("id", "demo")
                .put("name", "Demo ISP")
                .put("lock_message", "Llamá al 0800-555-0199 o escribinos por WhatsApp.")
                .put("offline_lock_days", 7))
            .put("device", JSONObject().put("name", "TV del living"))
            .put("blocked_domains", JSONArray())
            // Solo apps que tienen sentido en un TV (sin calculadora, fotos de ejemplo, reloj ni calendario).
            .put("apps", JSONArray()
                .put(web("youtube", "YouTube", "https://www.youtube.com/tv",
                    "youtube.com", "googlevideo.com", "ytimg.com", "ggpht.com", "gstatic.com")))
    }

    private fun web(id: String, name: String, url: String, vararg domains: String) =
        JSONObject().put("id", id).put("name", name).put("kind", "web").put("launch_url", url)
            .put("domains", JSONArray(domains.toList()))

    private fun isoDate(epoch: Long): String =
        java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date(epoch * 1000))
}

/** Solo responde en compilaciones demo; el permiso DUMP limita el envío a adb, como ReleaseReceiver. */
class DemoReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!BuildConfig.DEMO || intent.action != Demo.ACTION) return
        val state = intent.getStringExtra("state") ?: return
        if (state !in Demo.STATES) {
            Log.w("nex-demo", "escenario desconocido: $state (opciones: ${Demo.STATES})")
            return
        }
        Agent.setDemoState(state)
    }
}
