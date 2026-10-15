#!/bin/sh
# Genera el par de claves de RELEASES (offline, RSA-3072, firma RS256) de NEX MDM v8.
#
#   tools/nex-os/keys/gen-release-key.sh <directorio de salida>
#
# Crea en el directorio:
#   release.key.pem   privada, PEM PKCS8, permisos 0600 → NUNCA a Supabase ni a un servidor: firma offline
#   release.pub.pem   pública, PEM SPKI                 → /etc/nex-agent/release.pub.pem en el firmware
# e imprime el kid (primeros 16 hex de sha256 del SPKI DER).
#
# Es distinta de la clave MDM online: si se filtra la del servidor, igual no se puede instalar firmware.
# Generala en una máquina offline (o un medio cifrado) y firmá cada release con tools/nex-os/release/sign-release.sh.
# No pisa claves existentes.
set -eu

usage() {
	echo "uso: $0 <directorio de salida>" >&2
	exit 2
}

[ $# -eq 1 ] && [ -n "$1" ] || usage
command -v openssl >/dev/null 2>&1 || { echo "error: falta openssl" >&2; exit 1; }

OUT=$1
PRIV=$OUT/release.key.pem
PUB=$OUT/release.pub.pem

umask 077
mkdir -p "$OUT"
for f in "$PRIV" "$PUB"; do
	if [ -e "$f" ]; then
		echo "error: ya existe $f; no se pisa una clave existente (movela o elegí otro directorio)" >&2
		exit 1
	fi
done

TMP_RAW=$(mktemp "$OUT/.release.raw.XXXXXX")
TMP_PRIV=$(mktemp "$OUT/.release.key.XXXXXX")
TMP_PUB=$(mktemp "$OUT/.release.pub.XXXXXX")
trap 'rm -f "$TMP_RAW" "$TMP_PRIV" "$TMP_PUB"' EXIT INT TERM

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$TMP_RAW" 2>/dev/null
openssl pkcs8 -topk8 -nocrypt -in "$TMP_RAW" -out "$TMP_PRIV"
openssl pkey -in "$TMP_PRIV" -pubout -out "$TMP_PUB"

head -n 1 "$TMP_PRIV" | grep -q '^-----BEGIN PRIVATE KEY-----$' || { echo "error: la privada no quedó en PKCS8" >&2; exit 1; }
BITS=$(openssl pkey -in "$TMP_PRIV" -text -noout | sed -n 's/.*Private-Key: (\([0-9]*\) bit.*/\1/p' | head -n 1)
[ "$BITS" = "3072" ] || { echo "error: la clave generada no es de 3072 bits ($BITS)" >&2; exit 1; }

chmod 600 "$TMP_PRIV"
chmod 644 "$TMP_PUB"
# ln falla si el destino apareció mientras tanto: nunca se pisa una clave.
ln "$TMP_PRIV" "$PRIV"
ln "$TMP_PUB" "$PUB" || { rm -f "$PRIV"; echo "error: apareció $PUB mientras se generaba" >&2; exit 1; }

KID=$(openssl pkey -pubin -in "$PUB" -outform DER | openssl dgst -sha256 | awk '{print $NF}' | cut -c1-16)

cat <<MSG
Clave de releases generada (RSA-3072):
  privada: $PRIV (0600)
  pública: $PUB
  kid:     $KID

1. Incluí la pública en el firmware como /etc/nex-agent/release.pub.pem.
   Los equipos solo instalan actualizaciones firmadas con esta clave.
2. Guardá la privada OFFLINE (medio cifrado + copia de respaldo). No la subas a Supabase ni al repo:
   quien la tenga puede instalar firmware en todos los equipos.
3. Para cada release:
     tools/nex-os/release/sign-release.sh <update.img> <build> $PRIV
MSG
