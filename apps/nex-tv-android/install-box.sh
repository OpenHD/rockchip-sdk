#!/bin/bash
# Instala NEX TV en un TV box Android y lo deja protegido, en un solo paso (taller).
#   apps/nex-tv-android/install-box.sh <ip:puerto> [--apk ruta] [--tz zona] [--keep-adb] [--dry-run]
#   ej.: apps/nex-tv-android/install-box.sh 192.168.0.112:3222 --apk nex-tv.apk
# Instala el APK, deja NEX como pantalla de inicio, desactiva el adware de fábrica conocido, fija la zona horaria,
# activa la protección (Guard) y, si el firmware lo permite, hace a NEX dueño del equipo (Device Owner).
# Verifica todo y recién entonces apaga el ADB, que en muchos boxes viene abierto en la red.
# Para volver a entrar después: PIN técnico de NEX → Abrir Ajustes de Android → Preferencias del dispositivo →
# Información → 7 veces OK en Compilación (la primera vez) → Opciones de desarrollador → Depuración USB, o resetear
# el equipo. Ver README, "Instalar en el equipo (taller)".
set -uo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APK="$DIR/app/build/outputs/apk/release/app-release.apk"
TZ_NAME=America/Argentina/Buenos_Aires
KEEP_ADB=0
DRY=0
TARGET=""
while [ $# -gt 0 ]; do
	case "$1" in
	--apk) APK=$2; shift ;;
	--tz) TZ_NAME=$2; shift ;;
	--keep-adb) KEEP_ADB=1 ;;
	--dry-run) DRY=1 ;;
	-*) echo "Opción desconocida: $1" >&2; exit 2 ;;
	*) TARGET=$1 ;;
	esac
	shift
done
[ -n "$TARGET" ] || { echo "Uso: $0 <ip:puerto> [--apk ruta] [--tz zona] [--keep-adb] [--dry-run]" >&2; exit 2; }
command -v adb >/dev/null || { echo "Falta adb (Android platform-tools)" >&2; exit 1; }
[ -f "$APK" ] || { echo "No existe el APK: $APK" >&2; exit 1; }

PKG=os.nex.tv
GUARD=os.nex.tv/os.nex.tv.Guard
# Adware y proxy de fábrica encontrados en boxes HiSilicon TX6 (nov. 2026). Primero el plugin del fabricante,
# que instala los demás y los puede volver a activar.
ADWARE=(
	com.example.himac    # le manda comandos al shell root de fábrica (cmd_root, TCP/40000)
	com.lz.sysplugin     # plugin del fabricante: instala apps en silencio, control remoto y proxy
	com.android.tvh      # publicidad superpuesta ("AD") y protector de pantalla con anuncios
	com.android.network  # cliente de proxy (ShadowsocksR)
	com.charon.rocketfly # "CleanUp": app con permisos de sistema instalada en silencio
	com.tv.napp          # "Netflix" falso (reproductor IPTV ofuscado)
	# Apps que el firmware reinstala en cada reset y la empresa no quiere (igual que Heal.kt):
	com.simple.appstore.flymarket # "GetApps": tienda de apps alternativa
	org.xbmc.kodi                 # "KD Player": Kodi con otro nombre
	com.hpplay.happyplay.aw       # HappyCast: duplicar la pantalla del celular
	com.agileapps.airplay         # Airplay: duplicar la pantalla del celular
	org.mozilla.tv.firefox        # Firefox
	# Otra variante del firmware TX6698 (nov. 2026), igual que Heal.kt:
	com.android.gms.service       # "servicios de Google" falsos: instala apps y cambia ajustes seguros
	com.android.vending.update    # "actualizador de Play" falso, con accesibilidad y administrador del equipo
	com.android.network.cserver   # servidor de control remoto del fabricante
	com.android.network.iotvads   # publicidad
	com.huawei.qx                 # "Huawei" falso: corre al arrancar y dibuja sobre otras apps
	a.b.c                         # sin nombre: corre al arrancar y dibuja sobre otras apps
	com.flymobi.dramashort        # app de series cortas instalada de fábrica
)

dev() { adb -s "$TARGET" shell "$@" </dev/null | tr -d '\r'; }
# Cambia el estado del equipo: con --dry-run solo lo muestra.
change() {
	if [ "$DRY" = 1 ]; then echo "    [simulación] adb shell $*"; else dev "$@" 2>&1 | sed 's/^/    /'; fi
}
step() { echo; echo "== $*"; }
installed() { dev pm list packages "$1" | grep -qx "package:$1"; }

step "Conectando con $TARGET"
adb connect "$TARGET" >/dev/null 2>&1
[ "$(adb -s "$TARGET" get-state 2>/dev/null)" = device ] || { echo "No responde por ADB: $TARGET" >&2; exit 1; }
echo "    $(dev getprop ro.product.model) · Android $(dev getprop ro.build.version.release) (API $(dev getprop ro.build.version.sdk))"

step "Instalando NEX TV"
if [ "$DRY" = 1 ]; then
	echo "    [simulación] adb install -r $APK"
else
	out=$(adb -s "$TARGET" install -r "$APK" 2>&1)
	echo "$out" | tail -1 | sed 's/^/    /'
	grep -q '^Success' <<<"$out" || { echo "No se pudo instalar (¿APK firmado con otra clave?)" >&2; exit 1; }
fi

step "NEX como pantalla de inicio"
change cmd package set-home-activity "$PKG/.MainActivity"

step "Desactivando el adware de fábrica"
for p in "${ADWARE[@]}"; do
	if installed "$p"; then
		change pm disable-user --user 0 "$p"
		# Desactivar no cierra el proceso que ya corre: se cierra acá para que no siga hasta el próximo reinicio.
		change am force-stop "$p"
	else
		echo "    $p: no está"
	fi
done
change settings put secure screensaver_enabled 0

step "Zona horaria: $TZ_NAME"
change settings put global auto_time_zone 0
change service call alarm 3 s16 "$TZ_NAME"

step "Sin el aviso de pantalla completa de Android"
change settings put secure immersive_mode_confirmations confirmed

step "Protección de NEX (Guard)"
cur=$(dev settings get secure enabled_accessibility_services)
case "$cur" in
*"$GUARD"*) echo "    ya estaba activa" ;;
null | "") change settings put secure enabled_accessibility_services "$GUARD" ;;
*) change settings put secure enabled_accessibility_services "$cur:$GUARD" ;;
esac
change settings put secure accessibility_enabled 1

step "Dueño del equipo (Device Owner)"
if ! dev pm list features | grep -qx 'feature:android.software.device_admin'; then
	echo "    el firmware no lo permite (sin android.software.device_admin): protege Guard"
elif dev dumpsys device_policy | grep -q "ComponentInfo{$PKG/"; then
	echo "    NEX ya es dueño del equipo"
elif [ "$(dev dumpsys account | grep -c 'Account {')" != 0 ]; then
	echo "    hay cuentas cargadas: quitarlas y volver a correr el script"
else
	change dpm set-device-owner --user 0 "$PKG/.AdminReceiver"
fi
change am start -n "$PKG/.MainActivity"

step "Verificación"
fail=0
ok() { echo "    ✓ $*"; }
bad() { echo "    ✗ $*"; fail=1; }
ver=$(dev dumpsys package "$PKG" | grep -m1 -o 'versionName=[^ ]*' | cut -d= -f2)
if [ -n "$ver" ]; then ok "NEX TV $ver instalado"; else bad "NEX TV no está instalado"; fi
if dev cmd shortcut get-default-launcher | grep -q "{$PKG/"; then ok "NEX es la pantalla de inicio"; else bad "NEX no es la pantalla de inicio"; fi
disabled=$(dev pm list packages -d)
for p in "${ADWARE[@]}"; do
	installed "$p" || continue
	if grep -qx "package:$p" <<<"$disabled"; then ok "$p desactivado"; else bad "$p sigue activo"; fi
done
if dev ps -A -o NAME | grep -qxE 'com\.example\.himac|com\.lz\.sysplugin|com\.android\.tvh|com\.android\.network|com\.android\.gms\.service|com\.huawei\.qx|a\.b\.c|hp_special_ndk'; then
	bad "quedan procesos del adware corriendo"
else
	ok "sin procesos del adware"
fi
if dev settings get secure enabled_accessibility_services | grep -q "$GUARD"; then ok "protección de NEX activa"; else bad "protección de NEX inactiva"; fi
tz=$(dev getprop persist.sys.timezone)
if [ "$tz" = "$TZ_NAME" ]; then ok "zona horaria $tz"; else bad "zona horaria $tz (se esperaba $TZ_NAME)"; fi
if [ "$(dev settings get secure screensaver_enabled)" = 0 ]; then ok "protector de pantalla apagado"; else bad "protector de pantalla encendido"; fi

step "ADB"
if [ "$DRY" = 1 ]; then
	echo "    [simulación] se apagaría al final si todo dio bien"
elif [ "$fail" != 0 ]; then
	echo "    queda ABIERTO: hay verificaciones que fallaron. Corregir y volver a correr el script."
	exit 1
elif [ "$KEEP_ADB" = 1 ]; then
	echo "    queda abierto (--keep-adb)"
else
	echo "    apagando: la conexión se corta acá. Para volver a entrar: PIN técnico de NEX → Abrir Ajustes de Android →"
	echo "    Preferencias del dispositivo → Información → 7 veces OK en Compilación (la primera vez, para que aparezcan"
	echo "    las Opciones de desarrollador) → atrás → Opciones de desarrollador → Depuración USB."
	dev settings put global adb_enabled 0
fi
echo
echo "Listo. Falta vincular el equipo desde el panel de la empresa con el código que muestra NEX."
