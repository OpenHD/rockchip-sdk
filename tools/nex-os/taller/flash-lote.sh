#!/bin/bash
# Flasheo por lotes de NEX-OS en TV box, de a un equipo por vez (Linux).
# Para varios a la vez en paralelo usar FactoryTool en Windows (ver INSTALACION_TALLER.md).
#
# Uso: tools/nex-os/taller/flash-lote.sh [--backup] [update.img]
#   --backup  guarda una copia completa del firmware original de cada equipo antes de borrarlo
#             (recomendado: permite devolverlo a Android y sirve como respaldo ante reclamos).
#
# Por cada equipo: conectarlo en modo Loader/Maskrom (botón reset + cable USB A-A),
# esperar "OK" y desconectarlo. El resultado queda en taller-<fecha>.csv.
set -uo pipefail

SDK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
TOOL=${UPGRADE_TOOL:-$SDK_DIR/tools/linux/Linux_Upgrade_Tool/Linux_Upgrade_Tool/upgrade_tool}
BACKUP=0
[ "${1:-}" = "--backup" ] && { BACKUP=1; shift; }
IMAGE=${1:-$SDK_DIR/output/firmware/update.img}
LOADER=${NEX_LOADER:-$SDK_DIR/output/firmware/MiniLoaderAll.bin}
LOG=taller-$(date +%Y%m%d).csv

[ -x "$TOOL" ] || { echo "No encuentro upgrade_tool en $TOOL" >&2; exit 1; }
[ -s "$IMAGE" ] || { echo "No encuentro la imagen $IMAGE (ejecutá ./build.sh)" >&2; exit 1; }
[ "$(id -u)" = 0 ] || echo "Aviso: sin root, upgrade_tool puede no ver el USB (usá sudo o una regla udev)."

ut() { "$TOOL" "$@" 2>&1; }

echo "Imagen: $IMAGE"
SHA=$(sha256sum "$IMAGE" | cut -c1-16)
echo "SHA-256: $SHA…"
ut SFI "$IMAGE" | grep -iE "chip|version|loader" | head -n 5
read -r -p "¿La imagen corresponde al modelo de este lote? [s/N] " ok
[ "$ok" = s ] || [ "$ok" = S ] || exit 1
[ -f "$LOG" ] || echo "fecha,location_id,modo,flash_mb,backup,resultado,imagen_sha" > "$LOG"

wait_device() {
	while :; do
		list=$(ut LD)
		n=$(printf '%s\n' "$list" | grep -c "LocationID=")
		if [ "$n" -gt 1 ]; then
			echo "Hay $n equipos conectados: dejá uno solo." >&2
		elif [ "$n" = 1 ]; then
			printf '%s\n' "$list" | grep "LocationID="
			return 0
		fi
		sleep 1
	done
}

wait_unplug() {
	while ut LD | grep -q "LocationID="; do sleep 1; done
}

count=0
while :; do
	echo
	echo "== Equipo $((count + 1)): conectalo en modo Loader/Maskrom (Ctrl+C para terminar) =="
	line=$(wait_device)
	loc=$(printf '%s' "$line" | sed -n 's/.*LocationID=\([0-9a-fA-F]*\).*/\1/p')
	mode=$(printf '%s' "$line" | sed -n 's/.*Mode=\([A-Za-z]*\).*/\1/p')
	echo "Detectado: LocationID=$loc modo=$mode"

	if [ "$mode" = Maskrom ]; then
		[ -s "$LOADER" ] || { echo "Maskrom requiere $LOADER" >&2; exit 1; }
		ut DB "$LOADER" >/dev/null
		sleep 2
	fi

	size=$(ut RFI | sed -n 's/.*Flash Size:[[:space:]]*\([0-9]*\)MB.*/\1/p' | head -n 1)
	bk=no
	if [ $BACKUP = 1 ]; then
		if [ -n "$size" ] && [ "$size" -gt 0 ]; then
			mkdir -p backups
			file="backups/original-$(date +%Y%m%d-%H%M%S)-$loc.img"
			echo "Respaldando $size MB del firmware original en $file…"
			if ut RL 0 $((size * 2048)) "$file" | grep -qi "fail\|error"; then
				echo "✘ Falló el respaldo: no se flashea este equipo."
				echo "$(date -Iseconds),$loc,$mode,$size,error,backup_fallido,$SHA" >> "$LOG"
				wait_unplug
				continue
			fi
			bk=$file
		else
			echo "✘ No pude leer el tamaño del almacenamiento: no se flashea sin respaldo."
			wait_unplug
			continue
		fi
	fi

	echo "Flasheando NEX-OS…"
	if ut UF "$IMAGE" | tee /dev/stderr | grep -qi "Upgrade firmware ok"; then
		result=ok
		echo "✔ OK. Desconectá el equipo: arranca en la pantalla de vinculación."
	else
		result=error
		echo "✘ Error. Revisá el cable/driver y repetí con este equipo."
	fi
	echo "$(date -Iseconds),$loc,$mode,${size:-},$bk,$result,$SHA" >> "$LOG"
	[ $result = ok ] && count=$((count + 1))
	wait_unplug
done
