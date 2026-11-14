#!/bin/bash
# Instala NEX TV como app de sistema privilegiada en TV boxes con firmware de prueba (userdebug, con su): así
# sobrevive a un reset de fábrica, se actualiza sola sin pedir confirmación y al arrancar vuelve a proteger el
# equipo (Heal). Después del reinicio, correr install-box.sh como siempre.
#   apps/nex-tv-android/install-system.sh <ip:puerto> [--apk ruta] [--bootanim zip] [--device-admin] [--dry-run]
# --bootanim reemplaza la animación de arranque de fábrica (/system/media/bootanimation.zip) por la de NEX. La de
#   fábrica queda en el equipo como bootanimation.zip.factory (solo la primera vez).
# --device-admin además declara android.software.device_admin, para que NEX pueda ser dueño del equipo.
# Escribe en la partición del sistema: un error puede dejar el equipo sin arrancar. Tener a mano el firmware
# original del box y la herramienta para grabarlo. Ver README, "Instalar en el equipo (taller)".
set -uo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APK="$DIR/app/build/outputs/apk/release/app-release.apk"
BOOTANIM=""
DEVICE_ADMIN=0
DRY=0
TARGET=""
while [ $# -gt 0 ]; do
	case "$1" in
	--apk) APK=$2; shift ;;
	--bootanim) BOOTANIM=$2; shift ;;
	--device-admin) DEVICE_ADMIN=1 ;;
	--dry-run) DRY=1 ;;
	-*) echo "Opción desconocida: $1" >&2; exit 2 ;;
	*) TARGET=$1 ;;
	esac
	shift
done
[ -n "$TARGET" ] || { echo "Uso: $0 <ip:puerto> [--apk ruta] [--bootanim zip] [--device-admin] [--dry-run]" >&2; exit 2; }
command -v adb >/dev/null || { echo "Falta adb (Android platform-tools)" >&2; exit 1; }
[ -f "$APK" ] || { echo "No existe el APK: $APK" >&2; exit 1; }
if [ -n "$BOOTANIM" ]; then
	[ -f "$BOOTANIM" ] || { echo "No existe la animación: $BOOTANIM" >&2; exit 1; }
	# Android solo reproduce la animación si el zip tiene desc.txt y ningún archivo comprimido.
	# Se lee el listado entero antes de buscar: con pipefail, grep -q cortaría el pipe y unzip fallaría.
	list=$(unzip -v "$BOOTANIM") || { echo "La animación no es un zip válido: $BOOTANIM" >&2; exit 1; }
	grep -qE ' desc\.txt$' <<<"$list" || { echo "La animación no tiene desc.txt: $BOOTANIM" >&2; exit 1; }
	if awk 'NF >= 8 && $1 ~ /^[0-9]+$/ && $2 ~ /^[A-Za-z]/ && $2 != "Stored"' <<<"$list" | grep -q .; then
		echo "La animación tiene archivos comprimidos: armarla con zip -0" >&2; exit 1
	fi
	BOOTANIM_SHA=$(shasum -a 256 "$BOOTANIM" | cut -d' ' -f1)
fi

PKG=os.nex.tv
TMP_APK=/data/local/tmp/nex-tv.apk
TMP_SH=/data/local/tmp/nex-install-system.sh
TMP_ANIM=/data/local/tmp/nex-bootanimation.zip
ANIM=/system/media/bootanimation.zip
dev() { adb -s "$TARGET" shell "$@" </dev/null | tr -d '\r'; }
step() { echo; echo "== $*"; }
online() { [ "$(adb -s "$TARGET" get-state 2>/dev/null)" = device ]; }

step "Conectando con $TARGET"
adb connect "$TARGET" >/dev/null 2>&1
online || { echo "No responde por ADB: $TARGET" >&2; exit 1; }
echo "    $(dev getprop ro.product.model) · $(dev getprop ro.build.type) · API $(dev getprop ro.build.version.sdk)"
[ "$(dev getprop ro.debuggable)" = 1 ] || { echo "Firmware cerrado (ro.debuggable=0): no se puede escribir el sistema" >&2; exit 1; }
# Root: su o, en un equipo ya blindado (blindar-box.sh le saca el setuid a su), adb root.
if dev su 0 id | grep -q 'uid=0'; then
	runroot() { dev su 0 sh "$@"; }
elif ! grep -qi production <<<"$(adb -s "$TARGET" root 2>&1)" && sleep 3 && adb connect "$TARGET" >/dev/null 2>&1 &&
	sleep 2 && dev id | grep -q 'uid=0'; then
	runroot() { dev sh "$@"; }
	echo "    root con adb root (su ya no da root: equipo blindado)"
else
	echo "Sin root en este equipo (ni su ni adb root)" >&2
	exit 1
fi

# Lo corre root en el equipo; ante el primer error se detiene y el equipo no se reinicia.
ROOT_SH=$(mktemp)
trap 'rm -f "$ROOT_SH"' EXIT
cat >"$ROOT_SH" <<EOF
set -e
# El kernel arranca con la partición del sistema marcada de solo lectura (blockdev --getro = 1).
sys=\$(readlink -f /dev/block/by-name/system 2>/dev/null || true)
if [ -b "\$sys" ]; then blockdev --setrw "\$sys"; fi
mount -o rw,remount /
mkdir -p /system/priv-app/NexTv
cp $TMP_APK /system/priv-app/NexTv/NexTv.apk
chown -R root:root /system/priv-app/NexTv
chmod 755 /system/priv-app/NexTv
chmod 644 /system/priv-app/NexTv/NexTv.apk
chcon -R u:object_r:system_file:s0 /system/priv-app/NexTv 2>/dev/null || true
EOF
if [ "$DEVICE_ADMIN" = 1 ]; then
	cat >>"$ROOT_SH" <<'EOF'
printf '<?xml version="1.0" encoding="utf-8"?>\n<permissions>\n    <feature name="android.software.device_admin" />\n</permissions>\n' >/system/etc/permissions/nex-device-admin.xml
chmod 644 /system/etc/permissions/nex-device-admin.xml
chcon u:object_r:system_file:s0 /system/etc/permissions/nex-device-admin.xml 2>/dev/null || true
EOF
fi
if [ -n "$BOOTANIM" ]; then
	cat >>"$ROOT_SH" <<EOF
if [ -f $ANIM ] && [ ! -f $ANIM.factory ]; then cp $ANIM $ANIM.factory; fi
cp $TMP_ANIM $ANIM
chown root:root $ANIM
chmod 644 $ANIM
chcon u:object_r:system_file:s0 $ANIM 2>/dev/null || true
EOF
fi
cat >>"$ROOT_SH" <<'EOF'
sync
mount -o ro,remount / || true
echo ok
EOF

step "Copiando NEX TV a la partición del sistema"
if [ "$DRY" = 1 ]; then
	echo "    [simulación] adb push $APK $TMP_APK"
	[ -z "$BOOTANIM" ] || echo "    [simulación] adb push $BOOTANIM $TMP_ANIM"
	echo "    [simulación] como root:"
	sed 's/^/      /' "$ROOT_SH"
	echo "    [simulación] después reiniciaría el equipo y verificaría"
	exit 0
fi
adb -s "$TARGET" push "$APK" "$TMP_APK" >/dev/null && adb -s "$TARGET" push "$ROOT_SH" "$TMP_SH" >/dev/null &&
	{ [ -z "$BOOTANIM" ] || adb -s "$TARGET" push "$BOOTANIM" "$TMP_ANIM" >/dev/null; } ||
	{ echo "No se pudo copiar al equipo" >&2; exit 1; }
out=$(runroot "$TMP_SH" 2>&1)
dev rm -f "$TMP_APK" "$TMP_SH" "$TMP_ANIM"
if [ "$(tail -1 <<<"$out")" != ok ]; then
	echo "$out" | sed 's/^/    /'
	echo "Falló la copia al sistema: el equipo NO se reinicia. Revisar el error." >&2
	exit 1
fi
echo "    listo"

step "Reiniciando"
adb -s "$TARGET" reboot
sleep 15
end=$(($(date +%s) + 300))
until online && [ "$(dev getprop sys.boot_completed)" = 1 ]; do
	[ "$(date +%s)" -ge "$end" ] && { echo "El equipo no volvió en 5 minutos: revisar la pantalla." >&2; exit 1; }
	adb connect "$TARGET" >/dev/null 2>&1
	sleep 5
done
sleep 10

step "Verificación"
fail=0
ok() { echo "    ✓ $*"; }
bad() { echo "    ✗ $*"; fail=1; }
info=$(dev dumpsys package "$PKG")
if grep -q 'codePath=/system/priv-app/NexTv' <<<"$info"; then ok "NEX está en la partición del sistema"; else bad "NEX no aparece en el sistema"; fi
if grep -q 'PRIVILEGED' <<<"$info"; then ok "NEX es app privilegiada"; else bad "NEX no es app privilegiada"; fi
for p in INSTALL_PACKAGES DELETE_PACKAGES WRITE_SECURE_SETTINGS CHANGE_COMPONENT_ENABLED_STATE SET_TIME_ZONE; do
	if grep -q "android.permission.$p: granted=true" <<<"$info"; then ok "permiso $p"; else bad "falta el permiso $p"; fi
done
if [ "$DEVICE_ADMIN" = 1 ]; then
	if dev pm list features | grep -qx 'feature:android.software.device_admin'; then
		ok "el firmware ya permite que NEX sea dueño del equipo"
	else
		bad "no quedó declarada android.software.device_admin"
	fi
fi
if [ -n "$BOOTANIM" ]; then
	if [ "$(dev sha256sum "$ANIM" | cut -d' ' -f1)" = "$BOOTANIM_SHA" ]; then ok "animación de arranque de NEX"; else bad "la animación de arranque no quedó igual"; fi
fi
[ "$fail" = 0 ] || exit 1
echo
echo "Listo. Ahora correr install-box.sh $TARGET --apk <el mismo APK> para terminar la instalación."
