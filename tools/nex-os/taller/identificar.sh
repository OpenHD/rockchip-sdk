#!/bin/bash
# Relevamiento de un TV box con su Android original, por ADB (red o USB).
# Junta lo necesario para elegir o crear el perfil de placa: SoC, RAM, almacenamiento,
# chip Wi-Fi y el árbol de dispositivos original (pines de LED, IR, Wi-Fi).
#
# Uso: tools/nex-os/taller/identificar.sh [ip-del-tvbox]
#   Con IP: activar "Depuración ADB" en el Android del equipo (Opciones de desarrollador).
#   Sin IP: equipo conectado por USB con ADB habilitado.
set -euo pipefail

command -v adb >/dev/null || { echo "Falta adb (paquete android-tools-adb / platform-tools)" >&2; exit 1; }

if [ -n "${1:-}" ]; then
	adb connect "$1:5555" >/dev/null
	export ANDROID_SERIAL="$1:5555"
fi
adb wait-for-device

sh_() { adb shell "$@" 2>/dev/null | tr -d '\r'; }

model=$(sh_ getprop ro.product.model)
out="relevamiento-$(echo "${model:-tvbox}" | tr -c 'A-Za-z0-9_-' '_')-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$out"

{
	echo "Modelo:        $model"
	echo "Fabricante:    $(sh_ getprop ro.product.manufacturer)"
	echo "Plataforma:    $(sh_ getprop ro.board.platform)"
	echo "Hardware:      $(sh_ getprop ro.hardware)"
	echo "Android:       $(sh_ getprop ro.build.version.release)"
	echo "DT model:      $(sh_ cat /proc/device-tree/model)"
	echo "DT compatible: $(sh_ cat /proc/device-tree/compatible | tr '\0' ' ')"
	echo "RAM real:      $(sh_ grep MemTotal /proc/meminfo)"
	echo "Almacenamiento:"
	sh_ 'for b in /sys/block/mmcblk* /sys/block/rknand* /sys/block/nand*; do [ -e "$b/size" ] && echo "  $(basename $b): $(( $(cat $b/size) / 2048 )) MB"; done'
	echo "Wi-Fi (SDIO):"
	sh_ 'for d in /sys/bus/sdio/devices/*; do [ -e "$d/vendor" ] && echo "  vendor=$(cat $d/vendor) device=$(cat $d/device)"; done'
	echo "Módulos: $(sh_ lsmod | awk 'NR>1 {print $1}' | tr '\n' ' ')"
} | tee "$out/resumen.txt"

sh_ cat /proc/cpuinfo > "$out/cpuinfo.txt"
# Árbol de dispositivos original: se usa para portar LED, IR y Wi-Fi al DTS de NEX-OS.
adb pull /proc/device-tree "$out/device-tree" >/dev/null 2>&1 || true
if command -v dtc >/dev/null && [ -d "$out/device-tree" ]; then
	dtc -I fs -O dts -o "$out/original.dts" "$out/device-tree" 2>/dev/null && echo "DTS original: $out/original.dts"
fi

plat=$(sh_ getprop ro.board.platform)
case "$plat$(sh_ cat /proc/device-tree/compatible | tr '\0' ' ')" in
*rk3328* | *rk3318*) echo "✔ RK3318/RK3328: compatible con el perfil rockchip_rk3328_nex_tvbox_defconfig" ;;
*rk3528* | *rk3566*) echo "⚠ $plat: Rockchip, pero necesita otro perfil de placa" ;;
*) echo "✘ $plat: no es Rockchip RK3318/RK3328, este SDK no lo soporta" ;;
esac
grep -q "rknand\|nand" "$out/resumen.txt" && echo "⚠ Almacenamiento NAND: verificar soporte antes de flashear (el perfil asume eMMC)"
echo "Relevamiento guardado en $out/"
