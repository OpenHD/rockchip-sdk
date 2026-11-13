#!/bin/bash
# Deshace blindar-box.sh: vuelve a poner el servicio de fábrica y los permisos de su tal como estaban, desde las
# copias de /system/etc/nex-blindaje/. Solo para diagnosticar o volver al firmware de fábrica.
#   apps/nex-tv-android/restaurar-blindaje.sh <ip:puerto> [--dry-run]
# Necesita root: usa su si todavía da root y, si no, adb root.
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

BACKUP=/system/etc/nex-blindaje
TMP_SH=/data/local/tmp/nex-restaurar.sh
dev() { adb -s "$TARGET" shell "$@" </dev/null | tr -d '\r'; }
online() { [ "$(adb -s "$TARGET" get-state 2>/dev/null)" = device ]; }
reconnect() {
	local end=$(($(date +%s) + ${1:-60}))
	until online && [ "$(dev getprop sys.boot_completed)" = 1 ]; do
		[ "$(date +%s)" -ge "$end" ] && return 1
		adb connect "$TARGET" >/dev/null 2>&1
		sleep 3
	done
}

adb connect "$TARGET" >/dev/null 2>&1
online || { echo "No responde por ADB: $TARGET" >&2; exit 1; }

if dev su 0 id 2>/dev/null | grep -q 'uid=0'; then
	runroot() { dev su 0 sh "$@"; }
else
	out=$(adb -s "$TARGET" root 2>&1)
	grep -qi production <<<"$out" && { echo "No hay forma de obtener root (ni su ni adb root)." >&2; exit 1; }
	sleep 3
	reconnect 60 || { echo "El equipo no volvió después de adb root." >&2; exit 1; }
	dev id | grep -q 'uid=0' || { echo "adb root no dio root." >&2; exit 1; }
	runroot() { dev sh "$@"; }
fi

infos=$(runroot -c "'ls $BACKUP/*.info 2>/dev/null'")
[ -n "$infos" ] || { echo "No hay nada para restaurar ($BACKUP vacío)." >&2; exit 0; }
echo "Se restaura:"
for f in $infos; do echo "    $(runroot -c "'cat $f'")"; done

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
for info in $BACKUP/*.info; do
	IFS='|' read -r path mode label owner < "\$info"
	name=\$(basename "\$info" .info)
	if [ -e "$BACKUP/\$name.orig" ]; then
		cp "$BACKUP/\$name.orig" "\$path"
		chown "\${owner:-0:0}" "\$path"
	fi
	chmod "\$mode" "\$path"
	[ -n "\$label" ] && chcon "\$label" "\$path" 2>/dev/null || true
done
rm -rf $BACKUP
sync
mount -o ro,remount / || true
mount -o ro,remount /vendor 2>/dev/null || true
echo ok
EOF

if [ "$DRY" = 1 ]; then
	echo "[simulación] como root:"
	sed 's/^/    /' "$ROOT_SH"
	exit 0
fi
adb -s "$TARGET" push "$ROOT_SH" "$TMP_SH" >/dev/null || { echo "No se pudo copiar al equipo" >&2; exit 1; }
out=$(runroot "$TMP_SH" 2>&1)
dev rm -f "$TMP_SH"
[ "$(tail -1 <<<"$out")" = ok ] || { echo "$out" | sed 's/^/    /'; echo "Falló la restauración." >&2; exit 1; }
adb -s "$TARGET" unroot >/dev/null 2>&1 || true
echo "Restaurado. Reiniciando el equipo."
adb -s "$TARGET" reboot
