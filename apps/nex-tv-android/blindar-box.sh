#!/bin/bash
# Cierra las puertas traseras de fábrica de los TV box HiSilicon (TX6698 y parecidos), sin reflashear el firmware.
#   apps/nex-tv-android/blindar-box.sh <ip:puerto> [--dry-run]
#
# Qué hace (lo mismo que la cura RC8 de CureBox, macch-ai/curebox, pero en el lugar):
#   1. Busca el proceso que escucha en TCP/40000 (cmd_root: shell root sin autenticación) y reemplaza su binario por
#      un programa que no abre ningún puerto. El original queda guardado en /system/etc/nex-blindaje/.
#   2. Si el box acepta `adb root` (firmware userdebug), le saca el setuid a su: ninguna app puede volver a pedir root.
#      El técnico sigue entrando con `adb root`. Si `adb root` no anda, su se deja como está (si no, nadie podría
#      volver a instalar) y se avisa.
#   3. Reinicia y verifica: el puerto 40000 cerrado, el servicio de fábrica sin correr, su sin setuid y NEX TV de inicio.
# Va después de install-system.sh y grabar-logo.sh, y antes de install-box.sh (que apaga el ADB).
# Para deshacerlo: restaurar-blindaje.sh <ip:puerto>.
#
# Escribe en la partición del sistema: tener a mano el firmware original y la herramienta para grabarlo.
set -uo pipefail

DRY=0
TARGET=""
while [ $# -gt 0 ]; do
	case "$1" in
	--dry-run) DRY=1 ;;
	-*) echo "Opción desconocida: $1" >&2; exit 2 ;;
	*) TARGET=$1 ;;
	esac
	shift
done
[ -n "$TARGET" ] || { echo "Uso: $0 <ip:puerto> [--dry-run]" >&2; exit 2; }
command -v adb >/dev/null || { echo "Falta adb (Android platform-tools)" >&2; exit 1; }

PORT=40000
BACKUP=/system/etc/nex-blindaje
TMP_SH=/data/local/tmp/nex-blindar.sh
dev() { adb -s "$TARGET" shell "$@" </dev/null | tr -d '\r'; }
step() { echo; echo "== $*"; }
online() { [ "$(adb -s "$TARGET" get-state 2>/dev/null)" = device ]; }
reconnect() {
	local end=$(($(date +%s) + ${1:-60}))
	until online && [ "$(dev getprop sys.boot_completed)" = 1 ]; do
		[ "$(date +%s)" -ge "$end" ] && return 1
		adb connect "$TARGET" >/dev/null 2>&1
		sleep 3
	done
}
# Puertos TCP en LISTEN según /proc/net/tcp y tcp6.
listening() {
	dev cat /proc/net/tcp /proc/net/tcp6 | awk 'NR>1 && $4=="0A" {split($2,a,":"); print a[2]}' |
		while read -r hex; do [ -n "$hex" ] && printf '%d\n' "0x$hex"; done | sort -un
}

step "Conectando con $TARGET"
adb connect "$TARGET" >/dev/null 2>&1
online || { echo "No responde por ADB: $TARGET" >&2; exit 1; }
model=$(dev getprop ro.product.model)
echo "    $model · $(dev getprop ro.build.type) · $(dev getprop ro.hardware) · API $(dev getprop ro.build.version.sdk)"
[ "$(dev getprop ro.hardware)" = bigfish ] || { echo "Este script es para equipos HiSilicon (bigfish)." >&2; exit 1; }
dev su 0 id | grep -q 'uid=0' || { echo "su no da root: ¿ya está blindado? (ver restaurar-blindaje.sh)" >&2; exit 1; }

step "Buscando la puerta trasera (TCP/$PORT)"
if ! listening | grep -qx "$PORT"; then
	echo "    nada escucha en $PORT"
	exe=""
else
	# Proceso dueño del socket: el inodo de /proc/net/tcp contra los fd de cada proceso (como root). Se copia un
	# script al equipo para no anidar comillas.
	FIND_SH=$(mktemp)
	cat >"$FIND_SH" <<'EOF'
port=$1
hex=$(printf %04X "$port")
ino=$(cat /proc/net/tcp /proc/net/tcp6 | awk -v h=":$hex" '$2 ~ (h "$") && $4 == "0A" {print $10; exit}')
[ -n "$ino" ] || exit 0
for p in /proc/[0-9]*; do
	if ls -l "$p/fd" 2>/dev/null | grep -q "socket:\[$ino\]"; then readlink "$p/exe"; exit 0; fi
done
EOF
	adb -s "$TARGET" push "$FIND_SH" /data/local/tmp/nex-buscar.sh >/dev/null
	rm -f "$FIND_SH"
	exe=$(dev su 0 sh /data/local/tmp/nex-buscar.sh "$PORT" | head -1)
	dev rm -f /data/local/tmp/nex-buscar.sh
	[ -n "$exe" ] || { echo "No se pudo identificar el programa que escucha en $PORT." >&2; exit 1; }
	echo "    $exe"
	case "$exe" in
	/system/* | /vendor/*) ;;
	*) echo "El programa no está en /system ni /vendor ($exe): no se toca." >&2; exit 1 ;;
	esac
	# Nunca se reemplaza un binario compartido del sistema: si lo que escucha es toybox, sh o app_process (por
	# ejemplo, un "nc" lanzado por otro programa), cambiarlo dejaría el equipo sin arrancar.
	if [[ "$(basename "$exe")" =~ ^(toybox|toolbox|busybox|sh|mksh|bash|app_process(32|64)?|linker(64)?|su|init|logwrapper|adbd|servicemanager|hwservicemanager|vold|netd|surfaceflinger|zygote.*|.*\.so)$ ]]; then
		echo "Lo que escucha en $PORT es $exe, un programa compartido del sistema: no se toca." >&2
		echo "Este equipo necesita la reparación completa del firmware (CureBox)." >&2
		exit 1
	fi
	# Y solo si init lo arranca como servicio propio por esa ruta exacta (así es cmd_root en el firmware de fábrica).
	# Las comillas simples llegan al shell del equipo: el patrón tiene que viajar entero a grep.
	rc=$(dev su 0 grep -lsE "'^service [^ ]+ $exe( |\$)'" /init*.rc /system/etc/init/*.rc /vendor/etc/init/*.rc /system/etc/*.rc /vendor/etc/*.rc 2>/dev/null)
	if [ -z "$rc" ]; then
		echo "Ningún servicio de init arranca $exe: no se puede neutralizar con seguridad. No se cambió nada." >&2
		exit 1
	fi
	echo "    lo arranca el servicio de init en: $(echo $rc)"
	label=$(dev su 0 ls -Z "$exe" | awk '{print $1}')
	echo "    contexto SELinux: $label"
fi

step "Root para el técnico (adb root)"
ADB_ROOT=0
if [ "$DRY" = 1 ]; then
	echo "    [simulación] probaría adb root"
else
	out=$(adb -s "$TARGET" root 2>&1)
	if grep -qi "production" <<<"$out"; then
		echo "    no disponible ($out)"
	else
		sleep 3
		reconnect 60 || { echo "El equipo no volvió después de adb root." >&2; exit 1; }
		if dev id | grep -q 'uid=0'; then ADB_ROOT=1; echo "    disponible"; fi
		adb -s "$TARGET" unroot >/dev/null 2>&1
		sleep 3
		reconnect 60 || { echo "El equipo no volvió después de adb unroot." >&2; exit 1; }
	fi
fi
SU=$(dev ls /system/xbin/su /system/bin/su 2>/dev/null | head -1)
if [ "$ADB_ROOT" = 1 ] && [ -n "$SU" ]; then
	echo "    se le saca el setuid a $SU (el técnico entra con adb root)"
elif [ -n "$SU" ]; then
	echo "    AVISO: sin adb root, $SU se deja como está para poder volver a instalar"
fi

# Script que corre como root en el equipo. Guarda cada original (archivo, permisos y contexto) en $BACKUP.
ROOT_SH=$(mktemp)
trap 'rm -f "$ROOT_SH"' EXIT
cat >"$ROOT_SH" <<EOF
set -e
for part in system vendor; do
	b=\$(readlink -f /dev/block/by-name/\$part 2>/dev/null || true)
	if [ -b "\$b" ]; then blockdev --setrw "\$b"; fi
done
mount -o rw,remount /
mount -o rw,remount /vendor 2>/dev/null || true
mkdir -p $BACKUP
chmod 700 $BACKUP
EOF
if [ -n "$exe" ]; then
	name=$(basename "$exe")
	cat >>"$ROOT_SH" <<EOF
if [ ! -e $BACKUP/$name.orig ]; then
	cp -p "$exe" $BACKUP/$name.orig
	chmod 000 $BACKUP/$name.orig
	echo "$exe|\$(stat -c %a "$exe")|$label|\$(stat -c %u:%g "$exe")" > $BACKUP/$name.info
fi
# En lugar del servicio: un programa que no hace nada y no termina (si terminara, init lo relanzaría sin parar).
printf '#!/system/bin/sh\n# NEX: servicio de fábrica desactivado (shell root sin autenticación en TCP/$PORT).\n# Original en $BACKUP/$name.orig. Ver restaurar-blindaje.sh.\nwhile :; do /system/bin/sleep 86400; done\n' > "$exe"
chown root:shell "$exe"
chmod 755 "$exe"
chcon "$label" "$exe" 2>/dev/null || true
EOF
fi
if [ "$ADB_ROOT" = 1 ] && [ -n "$SU" ]; then
	cat >>"$ROOT_SH" <<EOF
[ -e $BACKUP/su.info ] || echo "$SU|\$(stat -c %a "$SU")||\$(stat -c %u:%g "$SU")" > $BACKUP/su.info
chmod 0755 "$SU"
EOF
fi
cat >>"$ROOT_SH" <<'EOF'
sync
mount -o ro,remount / || true
mount -o ro,remount /vendor 2>/dev/null || true
echo ok
EOF

step "Blindando"
if [ -z "$exe" ] && ! { [ "$ADB_ROOT" = 1 ] && [ -n "$SU" ]; }; then
	echo "    no hay nada para cambiar"
	exit 0
fi
if [ "$DRY" = 1 ]; then
	echo "    [simulación] como root:"
	sed 's/^/      /' "$ROOT_SH"
	echo "    [simulación] después reiniciaría el equipo y verificaría"
	exit 0
fi
adb -s "$TARGET" push "$ROOT_SH" "$TMP_SH" >/dev/null || { echo "No se pudo copiar al equipo" >&2; exit 1; }
out=$(dev su 0 sh "$TMP_SH" 2>&1)
dev rm -f "$TMP_SH"
if [ "$(tail -1 <<<"$out")" != ok ]; then
	echo "$out" | sed 's/^/    /'
	echo "Falló: el equipo NO se reinicia. Revisar el error (restaurar-blindaje.sh deshace lo que se haya hecho)." >&2
	exit 1
fi
echo "    listo"

step "Reiniciando"
adb -s "$TARGET" reboot
sleep 15
reconnect 300 || { echo "El equipo no volvió en 5 minutos: revisar la pantalla." >&2; exit 1; }
sleep 10

step "Verificación"
fail=0
ok() { echo "    ✓ $*"; }
bad() { echo "    ✗ $*"; fail=1; }
if listening | grep -qx "$PORT"; then bad "el puerto $PORT sigue abierto"; else ok "puerto $PORT cerrado"; fi
if [ -n "$exe" ]; then
	if dev ps -A -o ARGS | grep -v grep | grep -q "^$exe\$"; then bad "$(basename "$exe") sigue corriendo"; else ok "$(basename "$exe") no corre"; fi
fi
if [ "$ADB_ROOT" = 1 ] && [ -n "$SU" ]; then
	if dev su 0 id 2>/dev/null | grep -q 'uid=0'; then bad "su sigue dando root"; else ok "su ya no da root a las apps"; fi
fi
if dev cmd shortcut get-default-launcher | grep -q "{os.nex.tv/"; then ok "NEX TV sigue siendo el inicio"; else bad "NEX TV no es el inicio"; fi
echo "    puertos abiertos: $(listening | tr '\n' ' ')"
[ "$fail" = 0 ] || { echo; echo "Hay verificaciones que fallaron. Para deshacer: restaurar-blindaje.sh $TARGET" >&2; exit 1; }
echo
echo "Listo. Seguir con install-box.sh $TARGET --apk nex-tv.apk (apaga el ADB)."
