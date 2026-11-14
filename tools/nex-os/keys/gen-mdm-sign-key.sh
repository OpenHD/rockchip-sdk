#!/bin/sh
# Genera el par de claves MDM online (RSA-3072, firma RS256) de NEX MDM v8.
#
#   tools/nex-os/keys/gen-mdm-sign-key.sh <directorio de salida>
#
# Crea en el directorio:
#   mdm-sign.key.pem   privada, PEM PKCS8, permisos 0600 → secreto NEX_SIGNING_KEY de las Edge Functions
#   mdm-sign.pub.pem   pública, PEM SPKI                 → /etc/nex-agent/mdm-sign.pub.pem en el firmware
# e imprime el kid (primeros 16 hex de sha256 del SPKI DER) y cómo cargar el secreto.
#
# No pisa claves existentes. La privada no se versiona: guardala fuera del repo (y con backup offline).
# Es distinta de la clave de releases (offline), que firma las actualizaciones de firmware.
set -eu

usage() {
	echo "uso: $0 <directorio de salida>" >&2
	exit 2
}

[ $# -eq 1 ] && [ -n "$1" ] || usage
command -v openssl >/dev/null 2>&1 || { echo "error: falta openssl" >&2; exit 1; }

OUT=$1
PRIV=$OUT/mdm-sign.key.pem
PUB=$OUT/mdm-sign.pub.pem

umask 077
mkdir -p "$OUT"
for f in "$PRIV" "$PUB"; do
	if [ -e "$f" ]; then
		echo "error: ya existe $f; no se pisa una clave existente (movela o elegí otro directorio)" >&2
		exit 1
	fi
done

TMP_RAW=$(mktemp "$OUT/.mdm-sign.raw.XXXXXX")
TMP_PRIV=$(mktemp "$OUT/.mdm-sign.key.XXXXXX")
TMP_PUB=$(mktemp "$OUT/.mdm-sign.pub.XXXXXX")
trap 'rm -f "$TMP_RAW" "$TMP_PRIV" "$TMP_PUB"' EXIT INT TERM

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$TMP_RAW" 2>/dev/null
# Normaliza a PKCS8 sin cifrar ("BEGIN PRIVATE KEY"), que es lo que importa WebCrypto.
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
Claves MDM generadas (RSA-3072):
  privada: $PRIV (0600)
  pública: $PUB
  kid:     $KID

1. Cargá la privada como secreto de las Edge Functions (mdm-sync firma, isp-api publica el JWKS):
     supabase secrets set NEX_SIGNING_KEY="\$(cat '$PRIV')"
   y volvé a desplegar:
     supabase functions deploy mdm-sync
     supabase functions deploy isp-api --no-verify-jwt
2. Incluí la pública en el firmware como /etc/nex-agent/mdm-sign.pub.pem.
3. Comprobá que el JWKS publique este kid:
     curl -s https://<proyecto>.supabase.co/functions/v1/isp-api/jwks
4. Guardá la privada fuera del repo (gestor de secretos + backup offline) y borrala de esta máquina si no la necesitás.
MSG
