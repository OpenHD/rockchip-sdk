package os.nex.tv

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * Bloqueo sin Device Owner. Hay firmwares de TV box sin android.software.device_admin, donde NEX no puede
 * ser dueño del equipo ni usar el kiosko de Kiosk. Este servicio de accesibilidad mira qué app pasa al frente
 * y, si no está permitida (los Ajustes de Android, otro launcher, una app fuera de la lista), vuelve al inicio.
 * Lo activa el técnico al instalar (ver README). No lee el contenido de las pantallas: solo el paquete.
 */
class Guard : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (allowed(pkg)) return
        Log.i(TAG, "fuera de NEX: $pkg")
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    override fun onInterrupt() = Unit

    private fun allowed(pkg: String): Boolean {
        if (SystemClock.elapsedRealtime() < pausedUntil) return true
        // Configuración inicial de Android (después de un reset): deja pasar el asistente.
        if (Settings.Secure.getInt(contentResolver, "user_setup_complete", 1) == 0) return true
        // Con Device Owner manda el kiosko (lock task).
        if (Kiosk.isOwner(this)) return true
        if (pkg in SYSTEM || pkg == keyboard()) return true
        return pkg in Kiosk.allowedPackages(this)
    }

    private fun keyboard(): String? =
        Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)?.substringBefore('/')

    companion object {
        private const val TAG = "nex-guard"

        /** Ventanas del sistema que no son una app: diálogos, la barra del sistema y el selector de apps. */
        private val SYSTEM = setOf("android", "com.android.systemui")

        /** Tiempo que el técnico tiene para usar los Ajustes de Android (ver UiServer, /agent/setup/settings). */
        private const val PAUSE_MS = 10 * 60 * 1000L

        @Volatile private var pausedUntil = 0L

        fun pause() {
            pausedUntil = SystemClock.elapsedRealtime() + PAUSE_MS
        }

        /** La protección está activa: Android tiene este servicio entre los de accesibilidad habilitados. */
        fun isEnabled(ctx: Context): Boolean {
            val cr = ctx.contentResolver
            if (Settings.Secure.getInt(cr, Settings.Secure.ACCESSIBILITY_ENABLED, 0) != 1) return false
            val guard = ComponentName(ctx, Guard::class.java)
            return Settings.Secure.getString(cr, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
                .split(':').any { ComponentName.unflattenFromString(it) == guard }
        }
    }
}
