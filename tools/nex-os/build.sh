#!/bin/bash
set -euo pipefail

SDK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
LOCAL_SOURCE_DIR="$SDK_DIR/apps/nex-os"
SOURCE_DIR=${NEX_OS_SOURCE_DIR:-"$LOCAL_SOURCE_DIR"}
OUTPUT_DIR=${NEX_OS_OUTPUT_DIR:-"$SDK_DIR/device/rockchip/common/overlays/rootfs/nex-os/www"}
REPOSITORY=${NEX_OS_REPOSITORY:-https://github.com/shadownrx/windows.git}
REF=${NEX_OS_REF:-main}

command -v npm >/dev/null || { echo "Node.js/npm are required" >&2; exit 1; }

if [ ! -f "$SOURCE_DIR/package.json" ]; then
	command -v git >/dev/null || { echo "git is required when apps/nex-os is absent" >&2; exit 1; }
	if [ ! -d "$SOURCE_DIR/.git" ]; then
		git clone --depth 1 --branch "$REF" "$REPOSITORY" "$SOURCE_DIR"
	else
		git -C "$SOURCE_DIR" fetch --depth 1 origin "$REF"
		git -C "$SOURCE_DIR" reset --hard FETCH_HEAD
	fi
fi

# Gestión remota: la UI falla cerrado si no encuentra el estado de nex-agent.
AGENT_CONF="$SDK_DIR/device/rockchip/common/overlays/rootfs/nex-os/nex-agent.conf"
MDM_URL=${NEX_MDM_URL:-${VITE_SUPABASE_URL:-}}
MDM_KEY=${NEX_MDM_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}
if [ "${NEX_MDM:-1}" = 1 ]; then
	case "$MDM_URL" in
	https://*) ;;
	*) echo "NEX_MDM_URL must be the https:// URL of the MDM Supabase project (or set NEX_MDM=0)" >&2; exit 1 ;;
	esac
	printf '%s' "$MDM_KEY" | grep -Eq '^[A-Za-z0-9._-]{20,}$' || {
		echo "NEX_MDM_ANON_KEY is missing or invalid" >&2; exit 1; }
	umask 077
	{
		printf 'NEX_MDM_URL="%s"\n' "$MDM_URL"
		printf 'NEX_MDM_ANON_KEY="%s"\n' "$MDM_KEY"
		printf 'NEX_AGENT_BASE_DOMAINS="%s"\n' "${NEX_AGENT_BASE_DOMAINS:-}"
	} > "$AGENT_CONF"
	umask 022

	# Claves públicas (ver tools/nex-os/keys/). Se aceptan varias separadas por ":"
	# para poder rotar sin reflashear (la imagen trae la actual y las de reserva).
	# La del MDM es obligatoria; la de releases habilita las actualizaciones remotas.
	OVERLAY_DIR="$SDK_DIR/device/rockchip/common/overlays/rootfs/nex-os"
	copy_pubkeys() { # <pem[:pem...]> <directorio destino> <required|optional> <variable>
		rm -rf "${OVERLAY_DIR:?}/$2"
		if [ -z "$1" ]; then
			[ "$3" = required ] && { echo "$4 is required (public key PEM, several separated by :)" >&2; exit 1; }
			return 0
		fi
		mkdir -p "$OVERLAY_DIR/$2"
		n=0
		IFS=: read -r -a pems <<< "$1"
		for pem in "${pems[@]}"; do
			[ -n "$pem" ] || continue
			openssl pkey -pubin -in "$pem" -noout 2>/dev/null || { echo "$4: $pem is not a public key PEM" >&2; exit 1; }
			n=$((n + 1))
			openssl pkey -pubin -in "$pem" -out "$OVERLAY_DIR/$2/key$n.pem"
		done
		[ "$n" -ge 2 ] || echo "WARNING: $4 has a single key: if it leaks, every box must be reflashed (add a backup key)" >&2
	}
	copy_pubkeys "${NEX_MDM_SIGN_PUBKEY:-}" mdm-sign.d required NEX_MDM_SIGN_PUBKEY
	copy_pubkeys "${NEX_RELEASE_PUBKEY:-}" release.d optional NEX_RELEASE_PUBKEY
	# Número de build creciente (las releases firmadas lo usan para no volver atrás).
	NEX_OS_BUILD=${NEX_OS_BUILD:-$(date -u +%s)}
	case "$NEX_OS_BUILD" in '' | *[!0-9]*) echo "NEX_OS_BUILD must be an integer" >&2; exit 1 ;; esac
	echo "$NEX_OS_BUILD" > "$OVERLAY_DIR/nex-os.build"
	printf 'NEX-OS build number: %s (firmá el release con este número)\n' "$NEX_OS_BUILD"
	export VITE_NEX_MDM=1
	# Panel para el QR de vinculación (ej. https://nex.example.com/admin). Opcional.
	if [ -n "${NEX_ADMIN_URL:-}" ]; then
		case "$NEX_ADMIN_URL" in
		https://*) export VITE_NEX_ADMIN_URL="$NEX_ADMIN_URL" ;;
		*) echo "NEX_ADMIN_URL must be https://" >&2; exit 1 ;;
		esac
	fi
fi

npm --prefix "$SOURCE_DIR" ci
npm --prefix "$SOURCE_DIR" run build

rm -rf "$OUTPUT_DIR"
mkdir -p "$(dirname "$OUTPUT_DIR")"
cp -a "$SOURCE_DIR/dist" "$OUTPUT_DIR"
# El panel de administración no viaja en el TV box: menos superficie de ataque en el equipo.
rm -f "$OUTPUT_DIR/admin.html" "$OUTPUT_DIR"/assets/admin-*
printf 'NEX-OS static files installed in %s\n' "$OUTPUT_DIR"