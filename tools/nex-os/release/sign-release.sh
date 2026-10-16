#!/bin/sh
# Firma un release de firmware para NEX MDM v8 (OTA).
#
#   tools/nex-os/release/sign-release.sh <update.img> <build> <release.key.pem>
#
# Imprime sha256, tamaño y la firma base64 (RS256 con la clave de releases) sobre el string ASCII
#   nex-update:v1:<build>:<sha256>
# que es exactamente lo que verifica el equipo con /etc/nex-agent/release.pub.pem antes de instalar.
# <build> es el entero de /etc/nex-os-build de esa imagen: el equipo solo instala builds mayores al suyo.
#
# Después: subir la imagen a una URL https y publicarla desde el panel (Firmware) o con
# mdm_publish_release(version, build, url, sha256, size, sig, notas).
set -eu

usage() {
	echo "uso: $0 <update.img> <build> <release.key.pem>" >&2
	exit 2
}

[ $# -eq 3 ] || usage
IMG=$1
BUILD=$2
KEY=$3
command -v openssl >/dev/null 2>&1 || { echo "error: falta openssl" >&2; exit 1; }
[ -f "$IMG" ] && [ -r "$IMG" ] || { echo "error: no existe o no se puede leer $IMG" >&2; exit 1; }
[ -f "$KEY" ] && [ -r "$KEY" ] || { echo "error: no existe o no se puede leer $KEY" >&2; exit 1; }
# Entero positivo sin ceros a la izquierda (mismo rango que la columna build int de la base).
case "$BUILD" in
	''|*[!0-9]*|0*) echo "error: build debe ser un entero positivo sin ceros a la izquierda" >&2; exit 1 ;;
esac
[ ${#BUILD} -le 9 ] || { echo "error: build demasiado grande" >&2; exit 1; }

SHA=$(openssl dgst -sha256 < "$IMG" | awk '{print $NF}')
SIZE=$(wc -c < "$IMG" | tr -d ' ')
case "$SHA" in
	[0-9a-f]*) [ ${#SHA} -eq 64 ] || { echo "error: sha256 inesperado" >&2; exit 1; } ;;
	*) echo "error: sha256 inesperado" >&2; exit 1 ;;
esac
[ "$SIZE" -gt 0 ] || { echo "error: la imagen está vacía" >&2; exit 1; }

MSG="nex-update:v1:$BUILD:$SHA"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/nex-sign.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM
printf '%s' "$MSG" > "$TMP/msg"

openssl dgst -sha256 -sign "$KEY" -out "$TMP/sig.bin" "$TMP/msg"
# Autoverificación con la pública derivada de la misma clave (igual que el equipo, openssl dgst -verify).
openssl pkey -in "$KEY" -pubout -out "$TMP/pub.pem"
openssl dgst -sha256 -verify "$TMP/pub.pem" -signature "$TMP/sig.bin" "$TMP/msg" >/dev/null \
	|| { echo "error: la firma no verifica" >&2; exit 1; }
SIG=$(openssl base64 -A -in "$TMP/sig.bin")
KID=$(openssl pkey -pubin -in "$TMP/pub.pem" -outform DER | openssl dgst -sha256 | awk '{print $NF}' | cut -c1-16)

cat <<OUT
build:   $BUILD
sha256:  $SHA
size:    $SIZE
mensaje: $MSG
kid:     $KID (debe coincidir con /etc/nex-agent/release.pub.pem del firmware)
sig:     $SIG
OUT
