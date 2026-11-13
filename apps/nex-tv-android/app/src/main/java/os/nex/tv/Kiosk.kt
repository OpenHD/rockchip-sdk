package os.nex.tv

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.UserManager
import android.provider.Settings
import android.util.Log

/**
 * Modo TV cerrado en Android. Requiere que la app sea Device Owner, lo que se hace una sola vez:
 * por ADB (`adb shell dpm set-device-owner --user 0 os.nex.tv/.AdminReceiver`), por QR al configurar
 * el equipo de fábrica o con root (ver Provision).
 * Sin Device Owner NEX-OS funciona como launcher, pero el usuario puede salir a Android.
 */
object Kiosk {
    private const val TAG = "nex-kiosk"

    private val RESTRICTIONS = listOf(
        UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES,
        UserManager.DISALLOW_SAFE_BOOT,
        UserManager.DISALLOW_ADD_USER,
        UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA,
        // Prototipo: el reset de fábrica y ADB quedan habilitados para poder recuperar el equipo.
    )

    fun admin(ctx: Context) = ComponentName(ctx, AdminReceiver::class.java)

    private fun dpm(ctx: Context) = ctx.getSystemService(DevicePolicyManager::class.java)

    fun isOwner(ctx: Context): Boolean =
        runCatching { dpm(ctx).isDeviceOwnerApp(ctx.packageName) }.getOrDefault(false)

    /** Aplica las políticas y entra en modo kiosko (lock task). Seguro de llamar en cada onResume. */
    fun enter(activity: Activity) {
        if (!isOwner(activity)) return
        val dpm = dpm(activity)
        val admin = admin(activity)
        runCatching {
            dpm.setPermissionGrantState(admin, activity.packageName, Manifest.permission.ACCESS_FINE_LOCATION,
                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED)
        }.onFailure { Log.w(TAG, "no se pudo conceder ubicación", it) }
        runCatching {
            if (Build.VERSION.SDK_INT >= 30) dpm.setLocationEnabled(admin, true)
            else dpm.setSecureSetting(admin, Settings.Secure.LOCATION_MODE,
                Settings.Secure.LOCATION_MODE_HIGH_ACCURACY.toString())
        }.onFailure { Log.w(TAG, "no se pudo activar ubicación para buscar redes", it) }
        runCatching {
            syncPackages(activity)
            if (Build.VERSION.SDK_INT >= 28) {
                // Solo el botón Home (vuelve a NEX-OS): sin recientes, notificaciones ni menú de apagado de Android.
                dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_HOME)
            }
            val home = IntentFilter(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                addCategory(Intent.CATEGORY_DEFAULT)
            }
            dpm.addPersistentPreferredActivity(admin, home, ComponentName(activity, MainActivity::class.java))
            RESTRICTIONS.forEach { dpm.addUserRestriction(admin, it) }
            if (Build.VERSION.SDK_INT >= 23) {
                dpm.setStatusBarDisabled(admin, true)
                dpm.setKeyguardDisabled(admin, true)
            }
        }.onFailure { Log.w(TAG, "no se pudieron aplicar las políticas", it) }

        val am = activity.getSystemService(ActivityManager::class.java)
        if (am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) {
            runCatching { activity.startLockTask() }.onFailure { Log.w(TAG, "startLockTask falló", it) }
        }
    }

    @Volatile private var lastPackages: List<String> = emptyList()

    /**
     * Apps que pueden estar al frente: las del modo kiosko y las que Guard deja pasar. Con el equipo
     * activo: NEX-OS, la Play Store y las apps del usuario. Bloqueado o sin vincular: solo NEX-OS.
     */
    fun allowedPackages(ctx: Context): List<String> {
        val pkgs = mutableListOf(ctx.packageName)
        if (Agent.mode == "active") {
            pkgs += AndroidApps.PLAY_SUPPORT.filter { AndroidApps.installed(ctx, it) }
            pkgs += AndroidApps.list(ctx).map { it.pkg }
        }
        return pkgs.distinct()
    }

    /** Pasa allowedPackages al modo kiosko (Android cierra las demás apps). */
    fun syncPackages(ctx: Context) {
        if (!isOwner(ctx)) return
        val list = allowedPackages(ctx)
        if (list == lastPackages) return
        runCatching { dpm(ctx).setLockTaskPackages(admin(ctx), list.toTypedArray()) }
            .onSuccess { lastPackages = list; Log.i(TAG, "apps del kiosko: ${list.size}") }
            .onFailure { Log.w(TAG, "setLockTaskPackages falló", it) }
    }

    /** Quita el Device Owner y todas las políticas (solo desde ADB, ver ReleaseReceiver). */
    fun release(ctx: Context) {
        if (!isOwner(ctx)) return
        val dpm = dpm(ctx)
        val admin = admin(ctx)
        runCatching {
            dpm.clearPackagePersistentPreferredActivities(admin, ctx.packageName)
            RESTRICTIONS.forEach { dpm.clearUserRestriction(admin, it) }
            if (Build.VERSION.SDK_INT >= 23) {
                dpm.setStatusBarDisabled(admin, false)
                dpm.setKeyguardDisabled(admin, false)
            }
            dpm.setLockTaskPackages(admin, emptyArray())
            lastPackages = emptyList()
            @Suppress("DEPRECATION")
            dpm.clearDeviceOwnerApp(ctx.packageName)
        }.onFailure { Log.w(TAG, "no se pudo liberar el equipo", it) }
        Log.i(TAG, "Device Owner liberado")
    }
}

class AdminReceiver : DeviceAdminReceiver() {
    // Fin de la instalación por QR: NEX TV abre y aplica las políticas.
    override fun onProfileProvisioningComplete(context: Context, intent: Intent) = Provision.relaunch(context)
}

/**
 * Salida de emergencia para el taller. Protegido con el permiso DUMP: solo ADB (shell) o el sistema lo pueden enviar.
 *   adb shell am broadcast -a os.nex.tv.RELEASE -n os.nex.tv/.ReleaseReceiver
 */
class ReleaseReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "os.nex.tv.RELEASE") Kiosk.release(context)
    }
}
