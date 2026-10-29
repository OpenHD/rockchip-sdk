package os.nex.tv

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException
import java.security.MessageDigest
import org.json.JSONObject

/**
 * Sirve NEX-OS desde los assets del APK en un origen https propio (equivale al
 * busybox httpd de 127.0.0.1:8080 en Linux) y aplica la lista blanca del agente
 * a todo lo demás que pida el WebView.
 */
class UiServer(private val ctx: Context) {
    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val ORIGIN = "https://$HOST"
        const val UI_URL = "$ORIGIN/index.html"

        private val MIME = mapOf(
            "html" to "text/html", "js" to "text/javascript", "mjs" to "text/javascript",
            "css" to "text/css", "json" to "application/json", "webmanifest" to "application/manifest+json",
            "wasm" to "application/wasm", "svg" to "image/svg+xml", "png" to "image/png",
            "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "webp" to "image/webp", "gif" to "image/gif",
            "ico" to "image/x-icon", "woff" to "font/woff", "woff2" to "font/woff2", "ttf" to "font/ttf",
            "mp3" to "audio/mpeg", "mp4" to "video/mp4", "txt" to "text/plain",
        )
        private val NO_STORE = mapOf("Cache-Control" to "no-store")
    }

    /** null = dejar pasar a la red (dominio permitido). */
    fun intercept(request: WebResourceRequest): WebResourceResponse? = intercept(request.url)

    fun intercept(url: Uri): WebResourceResponse? {
        val host = url.host
        if (url.scheme == "https" && host == HOST) return serveLocal(url)
        if ((url.scheme == "https" || url.scheme == "wss") && Agent.isAllowed(host)) return null
        if (url.scheme == "data" || url.scheme == "blob") return null
        Agent.recordBlocked(host)
        return text(403, "Bloqueado por tu proveedor")
    }

    /** Navegación de nivel superior: true = se cancela. */
    fun shouldBlockNavigation(url: Uri): Boolean {
        if (url.scheme == "https" && url.host == HOST) {
            val path = url.path.orEmpty()
            if (!path.startsWith(AndroidApps.LAUNCH_PREFIX)) return false
            // Mosaico de una app Android: se abre la app y la UI se queda donde estaba.
            AndroidApps.launch(ctx, path.removePrefix(AndroidApps.LAUNCH_PREFIX))
            return true
        }
        if (url.scheme == "https" && Agent.isAllowed(url.host)) return false
        Agent.recordBlocked(url.host)
        return true
    }

    private fun serveLocal(url: Uri): WebResourceResponse {
        val path = url.path ?: "/"
        if (path.startsWith("/agent/wifi/")) {
            if (path == "/agent/wifi/connect" && !MessageDigest.isEqual(
                    Agent.wifiToken.toByteArray(), url.getQueryParameter("token").orEmpty().toByteArray())) {
                return json(403, JSONObject().put("ok", false).put("error", "Token inválido"))
            }
            return runCatching {
                when (path) {
                    "/agent/wifi/status" -> json(200, Wifi.status(ctx))
                    "/agent/wifi/scan" -> json(200, Wifi.scan(ctx))
                    "/agent/wifi/connect" -> json(200, Wifi.connect(ctx,
                        url.getQueryParameter("ssid").orEmpty(), url.getQueryParameter("password").orEmpty()))
                    else -> json(404, JSONObject().put("error", "No encontrado"))
                }
            }.getOrElse { json(500, JSONObject().put("ok", false).put("error", "Wi-Fi no disponible")) }
        }
        if (path == "/agent/ui-state.json") {
            return WebResourceResponse("application/json", "utf-8", 200, "OK", NO_STORE,
                ByteArrayInputStream(Agent.uiState.toByteArray()))
        }
        if (path.startsWith("/agent/")) {
            val logo = Agent.currentLogo()
            if (logo != null && path == "/agent/${logo.name}") {
                return WebResourceResponse(mime(logo.name), null, 200, "OK", NO_STORE, logo.inputStream())
            }
            return text(404, "Not found")
        }
        // Nunca se carga como página: shouldBlockNavigation la convierte en "abrir la app".
        if (path.startsWith(AndroidApps.LAUNCH_PREFIX)) return text(204, "")
        // El panel de administración no viaja en el TV box.
        if (path == "/admin.html" || path.startsWith("/admin")) return text(404, "Not found")

        val rel = path.trimStart('/').ifEmpty { "index.html" }
        if (rel.split('/').any { it == ".." }) return text(400, "Bad request")
        return try {
            WebResourceResponse(mime(rel), null, ctx.assets.open("www/$rel"))
        } catch (_: FileNotFoundException) {
            // Rutas de la SPA sin extensión: index.html.
            if ('.' !in rel.substringAfterLast('/')) {
                WebResourceResponse("text/html", "utf-8", ctx.assets.open("www/index.html"))
            } else {
                text(404, "Not found")
            }
        }
    }

    private fun json(code: Int, body: JSONObject) = WebResourceResponse(
        "application/json", "utf-8", code, if (code == 200) "OK" else "Error", NO_STORE,
        ByteArrayInputStream(body.toString().toByteArray()),
    )

    private fun mime(name: String) = MIME[name.substringAfterLast('.').lowercase()] ?: "application/octet-stream"

    private fun text(code: Int, msg: String) = WebResourceResponse(
        "text/plain", "utf-8", code, if (code == 403) "Forbidden" else "Error", NO_STORE,
        ByteArrayInputStream(msg.toByteArray()),
    )
}
