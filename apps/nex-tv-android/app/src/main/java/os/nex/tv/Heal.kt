package os.nex.tv

import android.Manifest
import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import java.util.TimeZone

/**
 * Vuelve a proteger el equipo al arrancar. Como app de sistema (install-system.sh), NEX sobrevive a un reset de
 * fábrica, pero el reset borra los ajustes y el firmware vuelve a instalar su adware: Heal repite lo que hace
 * install-box.sh. Instalada como app común no tiene estos permisos y no hace nada.
 */
object Heal {
    private const val TAG = "nex-heal"

    /**
     * Apps de fábrica que NEX no deja usar (ver install-box.sh): el adware, las que el firmware reinstala en cada reset
     * y la empresa no quiere (tienda alternativa, Kodi, duplicar pantalla, Firefox) y el launcher de fábrica, que
     * competiría con NEX como inicio.
     */
    private val VENDOR_APPS = listOf(
        // com.example.himac le manda comandos al shell root de fábrica (cmd_root, TCP/40000); ver FactoryRisk.
        "com.example.himac", "com.lz.sysplugin", "com.android.tvh", "com.android.network", "com.charon.rocketfly", "com.tv.napp",
        "com.simple.appstore.flymarket", "org.xbmc.kodi", "com.hpplay.happyplay.aw", "com.agileapps.airplay",
        "org.mozilla.tv.firefox", "com.droidlogic.mboxlauncher",
        // Otra variante del firmware TX6698 (nov. 2026): Google Play y servicios falsos, publicidad y apps instaladas
        // en silencio. com.android.gms.service tiene INSTALL_PACKAGES y WRITE_SECURE_SETTINGS.
        "com.android.gms.service", "com.android.vending.update", "com.android.network.cserver",
        "com.android.network.iotvads", "com.huawei.qx", "a.b.c", "com.flymobi.dramashort",
        // PlayMe: app de TV de fábrica que la empresa no quiere en sus equipos.
        "net.playme.androidtv",
    )

    /** Hoy los equipos son de empresas argentinas: pasar a la configuración de la empresa si hay otros países. */
    private const val TIME_ZONE = "America/Argentina/Buenos_Aires"

    fun run(ctx: Context) {
        if (granted(ctx, Manifest.permission.CHANGE_COMPONENT_ENABLED_STATE)) disableVendorApps(ctx)
        if (granted(ctx, Manifest.permission.WRITE_SECURE_SETTINGS)) secureSettings(ctx)
        if (granted(ctx, Manifest.permission.SET_TIME_ZONE)) timeZone(ctx)
    }

    /**
     * El firmware instala sus apps de fábrica después del arranque, cuando Heal ya corrió: vuelve a correr ante cada
     * app instalada, actualizada o reactivada.
     */
    fun watch(ctx: Context) {
        if (!granted(ctx, Manifest.permission.CHANGE_COMPONENT_ENABLED_STATE)) return
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED)
            addAction(Intent.ACTION_PACKAGE_REPLACED)
            addAction(Intent.ACTION_PACKAGE_CHANGED)
            addDataScheme("package")
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) = Heal.run(context)
        }
        if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else ctx.registerReceiver(receiver, filter)
    }

    private fun granted(ctx: Context, permission: String) =
        ctx.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun disableVendorApps(ctx: Context) {
        val pm = ctx.packageManager
        for (pkg in VENDOR_APPS) {
            // Lanza si la app no está instalada.
            val state = runCatching { pm.getApplicationEnabledSetting(pkg) }.getOrNull() ?: continue
            if (state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER) continue
            // DISABLED_USER, como `pm disable-user`: el técnico lo puede revertir por ADB con `pm enable`.
            runCatching { pm.setApplicationEnabledSetting(pkg, PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER, 0) }
                .onSuccess { Log.i(TAG, "desactivada: $pkg") }
                .onFailure { Log.w(TAG, "no se pudo desactivar $pkg", it) }
        }
    }

    private fun secureSettings(ctx: Context) {
        val cr = ctx.contentResolver
        val guard = ComponentName(ctx, Guard::class.java)
        val services = Settings.Secure.getString(cr, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
            .split(':').filter { it.isNotBlank() }
        if (services.none { ComponentName.unflattenFromString(it) == guard }) {
            Settings.Secure.putString(cr, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
                (services + guard.flattenToString()).joinToString(":"))
            Log.i(TAG, "protección activada")
        }
        // Solo escribe lo que cambió: Heal corre ante cada app instalada o cambiada.
        if (Settings.Secure.getInt(cr, Settings.Secure.ACCESSIBILITY_ENABLED, 0) != 1) {
            Settings.Secure.putInt(cr, Settings.Secure.ACCESSIBILITY_ENABLED, 1)
        }
        // Como install-box.sh: sin el aviso de pantalla completa ni el protector de pantalla (era del adware).
        if (Settings.Secure.getString(cr, "immersive_mode_confirmations") != "confirmed") {
            Settings.Secure.putString(cr, "immersive_mode_confirmations", "confirmed")
        }
        if (Settings.Secure.getInt(cr, "screensaver_enabled", 1) != 0) Settings.Secure.putInt(cr, "screensaver_enabled", 0)
    }

    private fun timeZone(ctx: Context) {
        if (TimeZone.getDefault().id == TIME_ZONE) return
        if (granted(ctx, Manifest.permission.WRITE_SECURE_SETTINGS)) {
            Settings.Global.putInt(ctx.contentResolver, Settings.Global.AUTO_TIME_ZONE, 0)
        }
        runCatching { ctx.getSystemService(AlarmManager::class.java).setTimeZone(TIME_ZONE) }
            .onSuccess { Log.i(TAG, "zona horaria: $TIME_ZONE") }
            .onFailure { Log.w(TAG, "no se pudo fijar la zona horaria", it) }
    }
}

/** Al arrancar (también el primero después de un reset): NexApp inicia Agent y Heal vuelve a proteger el equipo. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Heal.run(context)
    }
}
