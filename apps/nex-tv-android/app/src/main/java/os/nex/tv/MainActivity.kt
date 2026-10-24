package os.nex.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewFeature

/** Escritorio de NEX-OS: un WebView a pantalla completa que es la pantalla de inicio del equipo. */
class MainActivity : Activity() {
    private lateinit var root: FrameLayout
    private lateinit var web: WebView
    private lateinit var server: UiServer
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        server = UiServer(this)

        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            isFocusable = true
            isFocusableInTouchMode = true
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                setSupportMultipleWindows(false)
                javaScriptCanOpenWindowsAutomatically = false
                // Agente de TV: YouTube y otros servicios sirven su versión para televisor (control remoto)
                // en vez de la de celular o escritorio.
                userAgentString = TV_USER_AGENT
            }
            webViewClient = Client()
            webChromeClient = Chrome()
        }
        // Sin descargas: no se pueden bajar APKs ni archivos.
        web.setDownloadListener { _, _, _, _, _ -> }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(object : ServiceWorkerClientCompat() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? =
                    server.intercept(request)
            })
        }

        root = FrameLayout(this).apply { addView(web, MATCH) }
        setContentView(root)

        Agent.onRestartUi = { runOnUiThread { goHome() } }
        if (savedInstanceState == null) web.loadUrl(UiServer.UI_URL) else web.restoreState(savedInstanceState)
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        Kiosk.enter(this)
        web.requestFocus()
        restoreFocus()
    }

    /** Al volver de una app Android el foco queda en <body> y el control remoto no mueve nada. */
    private fun restoreFocus() {
        if (onUi()) web.evaluateJavascript(
            "(function(){var a=document.activeElement;if(!a||a===document.body){" +
                "var b=document.querySelector('button[data-index=\"0\"]')||document.querySelector('button');" +
                "if(b)b.focus();}})()", null)
    }

    // Botón Home con NEX-OS ya adelante. Si hay una app web abierta (YouTube corre en este mismo WebView),
    // vuelve al escritorio igual que con "Atrás".
    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        if (fullscreenView != null) fullscreenCallback?.onCustomViewHidden()
        if (!onUi()) goHome()
        web.postDelayed({ restoreFocus() }, 200)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUi()
            restoreFocus()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        Agent.onRestartUi = null
        web.destroy()
        super.onDestroy()
    }

    /** "Atrás" del control: desde una app de streaming vuelve al escritorio; dentro de NEX-OS lo maneja la UI. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) {
                when {
                    fullscreenView != null -> fullscreenCallback?.onCustomViewHidden()
                    !onUi() -> goHome()
                    else -> {
                        web.evaluateJavascript(
                            "window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))", null)
                        // Al cerrar una app interna el foco queda en <body>.
                        web.postDelayed({ restoreFocus() }, 300)
                    }
                }
            }
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    // Es la pantalla de inicio: el botón Home no debe hacer nada distinto a volver acá.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {}

    private fun onUi() = web.url?.startsWith(UiServer.ORIGIN + "/") == true

    private fun goHome() {
        fullscreenCallback?.onCustomViewHidden()
        web.stopLoading()
        web.loadUrl(UiServer.UI_URL)
        web.clearHistory()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemUi() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
    }

    private inner class Client : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            server.intercept(request)

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            server.shouldBlockNavigation(request.url)

        @Deprecated("Deprecated in Java")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean =
            server.shouldBlockNavigation(Uri.parse(url))
    }

    /** Pantalla completa de los reproductores web (requestFullscreen). */
    private inner class Chrome : WebChromeClient() {
        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            fullscreenCallback?.onCustomViewHidden()
            fullscreenView = view
            fullscreenCallback = callback
            root.addView(view, MATCH)
            web.visibility = View.GONE
        }

        override fun onHideCustomView() {
            fullscreenView?.let(root::removeView)
            fullscreenView = null
            fullscreenCallback = null
            web.visibility = View.VISIBLE
            web.requestFocus()
        }
    }

    private companion object {
        val MATCH = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    }
}

/** Navegador de Smart TV (Tizen): con él youtube.com/tv abre la interfaz de TV y no la de escritorio. */
private const val TV_USER_AGENT =
    "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36"
