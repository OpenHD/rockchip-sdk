#!/bin/bash
# Compila NEX-OS (modo MDM) y lo empaqueta en el APK de Android.
#   NEX_MDM_URL=https://<proyecto>.supabase.co NEX_MDM_ANON_KEY=<clave> apps/nex-tv-android/build.sh
# Resultado: apps/nex-tv-android/app/build/outputs/apk/release/app-release.apk
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SOURCE_DIR=${NEX_OS_SOURCE_DIR:-"$DIR/../nex-os"}
ASSETS="$DIR/app/src/main/assets/www"

MDM_URL=${NEX_MDM_URL:-}
MDM_KEY=${NEX_MDM_ANON_KEY:-}
# NEX_DEMO=1: APK de demostración sin backend (el agente simula al servidor, ver Demo.kt).
DEMO=false
if [ "${NEX_DEMO:-0}" = 1 ]; then
	DEMO=true
	echo "Compilando APK DEMO: no usar en equipos de clientes" >&2
else
	case "$MDM_URL" in
	https://*) ;;
	*) echo "NEX_MDM_URL must be the https:// URL of the MDM Supabase project (or set NEX_DEMO=1)" >&2; exit 1 ;;
	esac
	printf '%s' "$MDM_KEY" | grep -Eq '^[A-Za-z0-9._-]{20,}$' || { echo "NEX_MDM_ANON_KEY is missing or invalid" >&2; exit 1; }
fi

command -v npm >/dev/null || { echo "Node.js/npm are required" >&2; exit 1; }
[ -f "$SOURCE_DIR/package.json" ] || { echo "NEX-OS source not found in $SOURCE_DIR (set NEX_OS_SOURCE_DIR)" >&2; exit 1; }

export VITE_NEX_MDM=1
if [ -n "${NEX_ADMIN_URL:-}" ]; then
	case "$NEX_ADMIN_URL" in
	https://*) export VITE_NEX_ADMIN_URL="$NEX_ADMIN_URL" ;;
	*) echo "NEX_ADMIN_URL must be https://" >&2; exit 1 ;;
	esac
fi

WEB_OUT=$(mktemp -d)
trap 'rm -rf "$WEB_OUT"' EXIT
[ -d "$SOURCE_DIR/node_modules" ] || npm --prefix "$SOURCE_DIR" ci
# El WebView de los TV box Android suele ser viejo: se compila para Chrome 69 (Android 9 sin actualizar).
(cd "$SOURCE_DIR" && npx vite build --outDir "$WEB_OUT" --emptyOutDir --target "${NEX_WEB_TARGET:-chrome69}")

rm -rf "$ASSETS"
mkdir -p "$ASSETS"
cp -a "$WEB_OUT"/. "$ASSETS"/
# El panel de administración no viaja en el TV box. El service worker de la PWA tampoco:
# el APK ya trae los archivos y un caché viejo podría sobrevivir a una actualización.
rm -f "$ASSETS/admin.html" "$ASSETS"/assets/admin-* "$ASSETS/sw.js" "$ASSETS"/workbox-*.js

: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
export ANDROID_HOME
"$DIR/gradlew" -p "$DIR" assembleRelease \
	-Pnex.mdmUrl="$MDM_URL" -Pnex.mdmAnonKey="$MDM_KEY" -Pnex.baseDomains="${NEX_AGENT_BASE_DOMAINS:-}" -Pnex.demo="$DEMO"

echo "APK: $DIR/app/build/outputs/apk/release/app-release.apk"
