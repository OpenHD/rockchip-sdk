#!/bin/bash
# Compila NEX-OS (modo MDM) y lo empaqueta en el APK de Android.
#   NEX_MDM_URL=https://<proyecto>.supabase.co NEX_MDM_ANON_KEY=<clave> NEX_TECH_PIN=<4 dígitos> apps/nex-tv-android/build.sh
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

# El build debe coincidir con versionCode y con el manifiesto firmado de la release.
[[ "${NEX_BUILD:-1}" =~ ^[1-9][0-9]*$ ]] || { echo "NEX_BUILD debe ser un entero positivo sin ceros iniciales" >&2; exit 1; }
RELEASE_KEYS=""
if [ -n "${NEX_RELEASE_PUB:-}" ]; then
	read -r -a PUB_PATHS <<< "$NEX_RELEASE_PUB"
	for pub in "${PUB_PATHS[@]}"; do
		[ -f "$pub" ] || { echo "NEX_RELEASE_PUB no existe: $pub" >&2; exit 1; }
		body=$(sed '/^-----BEGIN PUBLIC KEY-----$/d; /^-----END PUBLIC KEY-----$/d' "$pub" | tr -d '\r\n')
		[[ "$body" =~ ^[A-Za-z0-9+/]+={0,2}$ ]] || { echo "Clave SPKI PEM inválida: $pub" >&2; exit 1; }
		RELEASE_KEYS="${RELEASE_KEYS:+$RELEASE_KEYS }$body"
	done
elif [ "$DEMO" = false ]; then
	echo "AVISO: APK sin NEX_RELEASE_PUB, actualizaciones desactivadas." >&2
fi

command -v npm >/dev/null || { echo "Node.js/npm are required" >&2; exit 1; }
[ -f "$SOURCE_DIR/package.json" ] || { echo "NEX-OS source not found in $SOURCE_DIR (set NEX_OS_SOURCE_DIR)" >&2; exit 1; }

export VITE_NEX_MDM=1
# PIN del acceso técnico (la pantalla pide 4 dígitos): obligatorio en los APK para clientes. El del código es solo
# para demo; sin este control, un APK de cliente saldría con el PIN que figura en el repo.
if [ "$DEMO" = false ]; then
	[[ "${NEX_TECH_PIN:-}" =~ ^[0-9]{4}$ ]] && [ "$NEX_TECH_PIN" != 2468 ] ||
		{ echo "NEX_TECH_PIN debe ser el PIN técnico de 4 dígitos, distinto del de demo" >&2; exit 1; }
	export VITE_NEX_TECH_PIN="$NEX_TECH_PIN"
fi
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

# NEX_KEYSTORE: clave definitiva (contraseña en NEX_KEYSTORE_PASSWORD). Sin ella se firma con la de debug,
# que sirve para probar pero no para equipos de clientes: después no se podrían actualizar.
SIGN=()
if [ -n "${NEX_KEYSTORE:-}" ]; then
	[ -f "$NEX_KEYSTORE" ] || { echo "NEX_KEYSTORE no existe: $NEX_KEYSTORE" >&2; exit 1; }
	[ -n "${NEX_KEYSTORE_PASSWORD:-}" ] || { echo "Falta NEX_KEYSTORE_PASSWORD" >&2; exit 1; }
	SIGN=(-Pnex.keystore="$NEX_KEYSTORE")
elif [ "$DEMO" = false ]; then
	echo "AVISO: APK sin NEX_KEYSTORE, firmado con la clave de debug. No instalar en equipos de clientes." >&2
fi

: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
export ANDROID_HOME
"$DIR/gradlew" -p "$DIR" assembleRelease \
	-Pnex.mdmUrl="$MDM_URL" -Pnex.mdmAnonKey="$MDM_KEY" -Pnex.baseDomains="${NEX_AGENT_BASE_DOMAINS:-}" -Pnex.demo="$DEMO" \
	-Pnex.build="${NEX_BUILD:-1}" -Pnex.version="${NEX_VERSION:-0.1.0}" -Pnex.releasePubKey="$RELEASE_KEYS" \
	${SIGN[@]+"${SIGN[@]}"}

echo "APK: $DIR/app/build/outputs/apk/release/app-release.apk"
