package os.nex.tv

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.util.Log

/**
 * Apps Android que se muestran en NEX-OS: la Play Store, Chrome y lo que instaló el usuario.
 * Solo se permiten la Play Store y Chrome entre las apps de sistema.
 * Los APK sueltos no se pueden instalar (DISALLOW_INSTALL_UNKNOWN_SOURCES, ver Kiosk).
 */
object AndroidApps {
    private const val TAG = "nex-apps"
    const val PLAY_STORE = "com.android.vending"
    const val CHROME = "com.android.chrome"
    private val ALLOWED_SYSTEM_PACKAGES = setOf(PLAY_STORE, CHROME)

    /** Necesarios para que la Play Store pueda iniciar sesión e instalar dentro del modo kiosko. */
    val PLAY_SUPPORT = listOf(PLAY_STORE, "com.google.android.gms", "com.google.android.gsf")

    /** Prefijo de URL con el que la UI pide abrir una app Android (lo atrapa UiServer). */
    const val LAUNCH_PREFIX = "/android/"

    data class App(val pkg: String, val label: String)

    /** Play Store primero, después Chrome y las apps del usuario por nombre. */
    fun list(ctx: Context): List<App> {
        val pm = ctx.packageManager
        val found = LinkedHashMap<String, App>()
        for (category in listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER)) {
            val intent = Intent(Intent.ACTION_MAIN).addCategory(category)
            for (ri in runCatching { pm.queryIntentActivities(intent, 0) }.getOrDefault(emptyList())) {
                val ai = ri.activityInfo?.applicationInfo ?: continue
                val pkg = ai.packageName
                if (pkg == ctx.packageName || pkg in found) continue
                val system = ai.flags and ApplicationInfo.FLAG_SYSTEM != 0
                if (system && pkg !in ALLOWED_SYSTEM_PACKAGES) continue
                if (!ai.enabled) continue
                found[pkg] = App(pkg, ai.loadLabel(pm).toString().trim().ifEmpty { pkg })
            }
        }
        val play = found.remove(PLAY_STORE)
        return listOfNotNull(play?.copy(label = "Play Store")) + found.values.sortedBy { it.label.lowercase() }
    }

    fun installed(ctx: Context, pkg: String): Boolean =
        runCatching { ctx.packageManager.getPackageInfo(pkg, 0) }.isSuccess

    /** Abre la app si está permitida (equipo activo y en la lista). */
    fun launch(ctx: Context, pkg: String): Boolean {
        if (Agent.mode != "active" || list(ctx).none { it.pkg == pkg }) return false
        val pm: PackageManager = ctx.packageManager
        val intent = pm.getLeanbackLaunchIntentForPackage(pkg) ?: pm.getLaunchIntentForPackage(pkg) ?: return false
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { ctx.startActivity(intent) }
            .onFailure { Log.w(TAG, "no se pudo abrir $pkg", it) }
            .isSuccess
    }
}
