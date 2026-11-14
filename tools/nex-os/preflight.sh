#!/bin/bash
# Verificación previa al build de NEX-OS para TV box (RK3318/RK3328).
# Revisa lo que hace fallar ./build.sh horas después o genera una imagen inútil:
# host, sistema de archivos, partes del SDK que no están en git, Node y claves.
#
# Uso: tools/nex-os/preflight.sh      (exit 1 si hay errores)
set -uo pipefail

SDK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ERR=0
WARN=0
ok() { printf '  ✔ %s\n' "$*"; }
bad() { printf '  ✘ %s\n' "$*"; ERR=$((ERR + 1)); }
warn() { printf '  ⚠ %s\n' "$*"; WARN=$((WARN + 1)); }

echo "== Host"
if [ "$(uname -s)" = Linux ] && [ "$(uname -m)" = x86_64 ]; then
	ok "Linux x86_64"
else
	bad "$(uname -s) $(uname -m): el SDK y su toolchain (prebuilts/gcc/linux-x86) necesitan Linux x86_64"
fi
free_gb=$(df -Pk "$SDK_DIR" | awk 'NR == 2 {print int($4 / 1048576)}')
[ "${free_gb:-0}" -ge 100 ] && ok "${free_gb} GB libres" || warn "${free_gb:-?} GB libres: el build completo usa ~100 GB"
for t in git make gcc g++ python3 rsync bc bison flex unzip cpio file; do
	command -v $t >/dev/null || bad "falta '$t' (ver tools/nex-os/README.md, dependencias del host)"
done

echo "== Checkout"
probe="$SDK_DIR/.nex-case-probe"
rm -f "$probe" "$probe.A" "$probe.a"
touch "$probe.a" && touch "$probe.A"
if [ "$(ls -a "$SDK_DIR" | grep -c '^\.nex-case-probe\.[aA]$')" = 2 ]; then
	ok "sistema de archivos sensible a mayúsculas"
else
	bad "sistema de archivos SIN distinción de mayúsculas (macOS/Windows): el kernel tiene pares como xt_DSCP.h/xt_dscp.h y queda corrupto. Cloná en un disco Linux (ext4)"
fi
rm -f "$probe.a" "$probe.A"
if git -C "$SDK_DIR" diff --quiet -- kernel/include/uapi/linux/netfilter 2>/dev/null; then
	ok "headers netfilter del kernel intactos"
else
	bad "kernel/include/uapi/linux/netfilter aparece modificado (checkout en disco sin mayúsculas)"
fi

echo "== Partes del SDK Rockchip fuera de git (external/)"
# Paquetes que la imagen de TV box usa sí o sí (Buildroot los toma de external/).
for d in chromium libmali mpp linux-rga gstreamer-rockchip rkwifibt rkscript alsa-config recovery rkupdate; do
	[ -d "$SDK_DIR/external/$d" ] && ok "external/$d" ||
		bad "falta external/$d (viene con el SDK Linux de Rockchip V1.2.0, mismo release que este kernel 5.10)"
done
ls "$SDK_DIR"/external/chromium/chromium-ozone-wayland_*_aarch64.tar.xz* >/dev/null 2>&1 &&
	ok "Chromium aarch64 precompilado" ||
	bad "falta external/chromium/chromium-ozone-wayland_<versión>_aarch64.tar.xz"

echo "== UI y gestión remota"
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then
	ok "Node $(node -v)"
else
	bad "Node.js 18 o superior requerido"
fi
if [ "${NEX_MDM:-1}" = 1 ]; then
	case "${NEX_MDM_URL:-}" in https://*) ok "NEX_MDM_URL" ;; *) bad "NEX_MDM_URL (https:// del proyecto Supabase del MDM)" ;; esac
	[ -n "${NEX_MDM_ANON_KEY:-}" ] && ok "NEX_MDM_ANON_KEY" || bad "NEX_MDM_ANON_KEY"
	[ -n "${NEX_MDM_SIGN_PUBKEY:-}" ] && ok "NEX_MDM_SIGN_PUBKEY" ||
		bad "NEX_MDM_SIGN_PUBKEY (tools/nex-os/keys/gen-mdm-sign-key.sh)"
	[ -n "${NEX_RELEASE_PUBKEY:-}" ] && ok "NEX_RELEASE_PUBKEY" ||
		warn "sin NEX_RELEASE_PUBKEY: la imagen no aceptará actualizaciones remotas"
	[ -n "${NEX_ADMIN_URL:-}" ] || warn "sin NEX_ADMIN_URL: la vinculación muestra solo el código, sin QR"
else
	warn "NEX_MDM=0: imagen sin gestión remota"
fi

echo "== Flasheo"
ut="$SDK_DIR/tools/linux/Linux_Upgrade_Tool/Linux_Upgrade_Tool/upgrade_tool"
[ -x "$ut" ] && ok "upgrade_tool" || warn "upgrade_tool no ejecutable ($ut)"

echo
if [ $ERR -gt 0 ]; then
	echo "✘ $ERR error(es), $WARN aviso(s): corregí lo marcado antes de ./build.sh"
	exit 1
fi
echo "✔ Listo para compilar ($WARN aviso(s)). Siguiente: tools/nex-os/build.sh && ./build.sh rockchip_rk3328_nex_tvbox_dev_defconfig"
