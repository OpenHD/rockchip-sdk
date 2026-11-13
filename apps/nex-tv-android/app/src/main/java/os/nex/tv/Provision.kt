package os.nex.tv

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Formas de hacer a NEX TV Device Owner sin ADB (ver README):
 *  - QR al configurar el equipo de fábrica: Android descarga el APK y llama a ProvisioningActivity.
 *  - Root: el técnico toca "Activar NEX" y la app corre `dpm set-device-owner` con su.
 */
object Provision {
    private const val TAG = "nex-provision"
    private val SU_PATHS = listOf(
        "/system/xbin/su", "/system/bin/su", "/sbin/su", "/su/bin/su",
        "/system/sbin/su", "/vendor/bin/su", "/debug_ramdisk/su",
    )

    private fun su(): String? = SU_PATHS.firstOrNull { File(it).exists() }

    fun hasRoot(): Boolean = su() != null

    /** Pide root (el box puede mostrar un cartel para permitirlo) y se registra como Device Owner. */
    @Synchronized
    fun ownWithRoot(ctx: Context): JSONObject {
        fun result(ok: Boolean, error: String? = null) = JSONObject().put("ok", ok).put("error", error ?: JSONObject.NULL)
        if (Kiosk.isOwner(ctx)) return result(true)
        val su = su() ?: return result(false, "Este equipo no tiene root.")
        val component = Kiosk.admin(ctx).flattenToShortString()
        val output = StringBuilder()
        return runCatching {
            // Igual que la instalación por ADB: sin el aviso "Viewing full screen" que le roba el foco al control.
            val command = "dpm set-device-owner --user 0 $component && settings put secure immersive_mode_confirmations confirmed"
            val process = ProcessBuilder(su, "-c", command).redirectErrorStream(true).start()
            val reader = Thread { runCatching { process.inputStream.bufferedReader().forEachLine { output.appendLine(it) } } }
            reader.start()
            // Hasta 60 s: el box puede esperar a que el técnico acepte el cartel de root.
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60)
            while (isAlive(process) && System.nanoTime() < deadline) Thread.sleep(250)
            if (isAlive(process)) {
                process.destroy()
                return result(false, "No se aceptó el permiso de root a tiempo.")
            }
            reader.join(1000)
            val text = output.toString()
            Log.i(TAG, "dpm por root: ${text.trim().take(300)}")
            when {
                Kiosk.isOwner(ctx) -> { relaunch(ctx); result(true) }
                text.contains("account", ignoreCase = true) ->
                    result(false, "Hay cuentas en el equipo. Quitalas en Ajustes de Android o reseteá el equipo de fábrica.")
                text.contains("already", ignoreCase = true) ->
                    result(false, "El equipo ya tiene otro administrador. Reseteá el equipo de fábrica.")
                else -> result(false, "No se pudo activar NEX con root.")
            }
        }.getOrElse {
            Log.w(TAG, "falló la activación por root", it)
            result(false, "No se pudo pedir root.")
        }
    }

    private fun isAlive(process: Process) = runCatching { process.exitValue(); false }.getOrDefault(true)

    /** Reabre NEX TV desde cero: onResume aplica las políticas de Device Owner y entra en kiosko. */
    fun relaunch(ctx: Context) {
        runCatching {
            ctx.startActivity(Intent(ctx, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        }.onFailure { Log.w(TAG, "no se pudo reabrir NEX TV", it) }
    }
}

/**
 * Pasos del QR en Android 10+ (el sistema los exige al DPC): elegir "equipo totalmente administrado"
 * y confirmar que se cumplen las políticas. En Android 9 el sistema no los llama.
 */
class ProvisioningActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        when (intent?.action) {
            DevicePolicyManager.ACTION_GET_PROVISIONING_MODE -> setResult(RESULT_OK, Intent()
                .putExtra(DevicePolicyManager.EXTRA_PROVISIONING_MODE, DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE))
            DevicePolicyManager.ACTION_ADMIN_POLICY_COMPLIANCE -> setResult(RESULT_OK)
            else -> setResult(RESULT_CANCELED)
        }
        finish()
    }
}
