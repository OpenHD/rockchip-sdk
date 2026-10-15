#!/bin/bash
# Pruebas de nex-agent con un servidor falso (curl simulado, firmas reales).
# Uso: tools/nex-os/tests/test-agent.sh  (necesita bash, jq, openssl, sha256sum)
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
AGENT_SRC=${1:-$HERE/../../../device/rockchip/common/overlays/rootfs/nex-os/nex-agent}
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
mkdir -p "$T"/{userdata,run,etc/nex-agent,policies,keys}
export PATH=$HERE/bin:$PATH

openssl genrsa -out "$T/keys/mdm.key" 3072 2>/dev/null
openssl rsa -in "$T/keys/mdm.key" -pubout -out "$T/etc/nex-agent/mdm-sign.pub.pem" 2>/dev/null
openssl genrsa -out "$T/keys/rel.key" 3072 2>/dev/null
openssl rsa -in "$T/keys/rel.key" -pubout -out "$T/etc/nex-agent/release.pub.pem" 2>/dev/null
openssl genrsa -out "$T/keys/evil.key" 3072 2>/dev/null
echo 100 > "$T/etc/nex-os-build"

sed -e "s#/userdata/nex-agent#$T/userdata/nex-agent#g" -e "s#/run/nex-agent#$T/run/nex-agent#g" \
    -e "s#/etc/nex-agent/#$T/etc/nex-agent/#g" -e "s#/run/nex-policies#$T/policies#g" \
    -e "s#/etc/nex-os-build#$T/etc/nex-os-build#g" -e "s#/var/lib/nex-agent#$T/varlib#g" \
    -e '$d' "$AGENT_SRC" > "$T/agent.sh"
# shellcheck disable=SC1090
. "$T/agent.sh"
set +e
mkdir -p "$STATE_DIR" "$RUN_DIR" "$PUBLIC_DIR"
MDM_URL=https://mdm.example.com MDM_KEY=anon-key-for-tests-123
HW=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
hardware_id() { echo "$HW"; }
logger() { :; }
OTA_CMD="$T/ota-called"
cat > "$T/ota-called" <<EOF
#!/bin/sh
echo "\$1" > "$T/ota-arg"
exit 1
EOF
chmod +x "$T/ota-called"

SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
DEV=11111111-2222-3333-4444-555555555555
NOW=1790000000
export FAKE_NOW=$NOW

# make_resp <jq-ajustes> [clave]: respuesta firmada de mdm-sync
make_resp() {
	key=${2:-$T/keys/mdm.key}
	payload=$(jq -nc --arg hw "$HW" --arg s "$SECRET" --arg d "$DEV" --argjson ep "${EPOCH:-$NOW}" '
		{kind: "nex-config", v: 1, status: "paired", server_epoch: $ep, server_time: "x",
		 payment: null, device: {id: $d, name: "TV 1"}, locked: false, lock_reason: null,
		 company: {id: "c1", name: "ISP", lock_message: "Pagá", offline_lock_days: 7, logo_path: null},
		 apps: [{id: "yt", name: "YouTube", kind: "web", launch_url: "https://youtube.com",
		         domains: ["youtube.com"], pass_attestation: true}],
		 blocked_domains: [], hardware_id: $hw, unlock_secret: $s, attestation_eligible: true,
		 attestation: "jwt.x.y", update: null}' | jq -c "$1")
	sig=$(printf '%s' "$payload" | openssl dgst -sha256 -sign "$key" | openssl base64 -A)
	jq -nc --arg p "$payload" --arg s "$sig" '{status: "paired", payload: $p, sig: $s}'
}
RESP=""
curl() {
	url=${*: -1}
	cat > /dev/null 2>&1 || true
	case "$url" in
	*functions/v1/mdm-sync) printf '%s' "$RESP" ;;
	*rest/v1/rpc/mdm_device_register) echo '{"status":"paired"}' ;;
	*rest/v1/rpc/*) echo '{}' ;;
	https://cdn.example.com/*) # descarga de la actualización
		out=""; prev=""; for a in "$@"; do [ "$prev" = -o ] && out=$a; prev=$a; done
		cp "$T/update.img" "$out" ;;
	*) return 22 ;;
	esac
}

pass=0; fail=0
check() { if eval "$2"; then pass=$((pass+1)); echo "ok   - $1"; else fail=$((fail+1)); echo "FAIL - $1"; fi; }
code_for() { # día
	day=$(date -u -d "@$(($1 * 86400))" +%Y%m%d)
	h=$(printf '%s' "$DEV:$day" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -c1-8)
	printf '%08d' $((0x$h % 100000000))
}
run_cycle() { compute_mode; process_inbox; compute_mode; }

ensure_token
setup_inbox

RESP=$(make_resp '.')
sync_remote; check "sync firmado se acepta" '[ -s "$CONFIG_FILE" ]'
run_cycle; check "equipo activo" '[ "$MODE" = active ]'
publish_ui_state
check "ui-state sin unlock_secret" '! grep -q "$SECRET" "$PUBLIC_DIR/ui-state.json"'
check "ui-state con atestación y pass_attestation" 'jq -e ".attestation == \"jwt.x.y\" and .apps[0].pass_attestation == true" "$PUBLIC_DIR/ui-state.json" >/dev/null'
check "ui-state updated_at" 'jq -e ".updated_at == $NOW" "$PUBLIC_DIR/ui-state.json" >/dev/null'

# Manipulación de la configuración guardada en userdata
perl -pi -e 's/"offline_lock_days":7/"offline_lock_days":9999/' "$SIGNED_PAYLOAD"
load_config; run_cycle; check "payload editado se descarta (espera)" '[ "$MODE" = starting ]'

RESP=$(make_resp '.' "$T/keys/evil.key"); sync_remote
check "firma con otra clave se rechaza" '[ ! -s "$CONFIG_FILE" ]'
RESP=$(make_resp '.hardware_id = "bbbb"'); sync_remote
check "configuración de otro hardware se rechaza" '[ ! -s "$CONFIG_FILE" ]'
RESP=$(jq -nc '{status: "paired", company: {id: "c"}, apps: [], locked: false}'); sync_remote
check "respuesta sin firma (v7) se rechaza" '[ ! -s "$CONFIG_FILE" ]'

# Bloqueo manual + código offline
RESP=$(make_resp '.locked = true | .lock_reason = "Deuda"'); sync_remote; run_cycle
check "bloqueo manual" '[ "$MODE" = locked ] && [ "$LOCK_KIND" = manual ]'
echo '{"action":"unlock_code","code":"00000000"}' > "$INBOX_DIR/1.json"; run_cycle
check "código inválido" 'grep -q "^invalid" "$UNLOCK_RESULT" && [ "$MODE" = locked ]'
echo "{\"action\":\"unlock_code\",\"code\":\"$(code_for $((NOW / 86400)))\"}" > "$INBOX_DIR/2.json"; run_cycle
check "código válido desbloquea 72 h" '[ "$MODE" = active ] && [ "$UNLOCK_UNTIL" = $((NOW + 259200)) ]'
publish_ui_state
check "ui-state informa el desbloqueo" 'jq -e ".unlock.result == \"ok\" and .unlock.until == $((NOW + 259200))" "$PUBLIC_DIR/ui-state.json" >/dev/null'
read -r c d u < "$OVERRIDE_FILE"; echo "$c $d 9999999999" > "$OVERRIDE_FILE"; run_cycle
check "override editado (más tiempo) no vale" '[ "$MODE" = locked ]'
echo "$c $d $u" > "$OVERRIDE_FILE"
FAKE_NOW=$((NOW + 259201)); run_cycle
check "override vence a las 72 h" '[ "$MODE" = locked ]'
FAKE_NOW=$NOW; run_cycle
check "ayer también vale (zona horaria)" 'true'
sync_remote
check "sync con conexión descarta el override" '[ ! -e "$OVERRIDE_FILE" ]'
run_cycle; check "vuelve a mandar el servidor (bloqueado)" '[ "$MODE" = locked ]'
for i in 1 2 3 4 5; do echo '{"action":"unlock_code","code":"12345678"}' > "$INBOX_DIR/f$i.json"; done
run_cycle
echo "{\"action\":\"unlock_code\",\"code\":\"$(code_for $((NOW / 86400)))\"}" > "$INBOX_DIR/z.json"; run_cycle
check "rate limit tras 5 fallos (aun con código bueno)" 'grep -q "^rate_limited" "$UNLOCK_RESULT" && [ "$MODE" = locked ]'
rm -f "$UNLOCK_FAILS"

# Offline: el ancla es server_epoch firmado
RESP=$(EPOCH=$((NOW - 8 * 86400)) make_resp '.'); sync_remote; run_cycle
check "más de 7 días sin conexión bloquea" '[ "$MODE" = locked ] && [ "$LOCK_KIND" = offline ]'
echo "{\"action\":\"unlock_code\",\"code\":\"$(code_for $((NOW / 86400 - 1)))\"}" > "$INBOX_DIR/y.json"; run_cycle
check "código de ayer desbloquea un bloqueo offline" '[ "$MODE" = active ]'
rm -f "$OVERRIDE_FILE"
RESP=$(EPOCH=$((NOW - 15 * 86400)) make_resp '.'); sync_remote; run_cycle
echo "{\"action\":\"unlock_code\",\"code\":\"$(code_for $((NOW / 86400)))\"}" > "$INBOX_DIR/x.json"; run_cycle
check "pasado límite+7 días el código no alcanza" '[ "$MODE" = locked ]'
rm -f "$OVERRIDE_FILE" "$UNLOCK_FAILS"

# Reloj atrasado
unset EPOCH
RESP=$(make_resp '.'); sync_remote
FAKE_NOW=$((NOW - 3600)); run_cycle
check "reloj atrasado bloquea por reloj" '[ "$MODE" = locked ] && [ "$LOCK_KIND" = clock ]'
echo "{\"action\":\"unlock_code\",\"code\":\"$(code_for $((NOW / 86400)))\"}" > "$INBOX_DIR/w.json"; run_cycle
check "el código no sirve contra el bloqueo por reloj" '[ "$MODE" = locked ] && grep -q "^unavailable" "$UNLOCK_RESULT"'
FAKE_NOW=$NOW

# Pedidos inválidos en la bandeja
printf '%s' '{"action":"wifi_connect","ssid":"x","psk":"corta"}' > "$INBOX_DIR/v.json"
wifi_connect() { echo called > "$T/wifi-called"; }
run_cycle; check "psk inválida no llega a wpa_cli" '[ ! -e "$T/wifi-called" ]'
printf '%s' '{"action":"wifi_connect","ssid":"Casa \"1\"","psk":"clave segura"}' > "$INBOX_DIR/u.json"
run_cycle; check "pedido Wi-Fi válido se procesa" '[ -e "$T/wifi-called" ]'

# Actualización firmada
head -c 200000 /dev/urandom > "$T/update.img"
SHA=$(sha256sum "$T/update.img" | cut -c1-64)
SIZE=$(wc -c < "$T/update.img" | tr -d ' ')
RSIG=$(printf 'nex-update:v1:%s:%s' 101 "$SHA" | openssl dgst -sha256 -sign "$T/keys/rel.key" | openssl base64 -A)
RESP=$(make_resp ".update = {version: \"1.1\", build: 101, url: \"https://cdn.example.com/u.img\", sha256: \"$SHA\", size: $SIZE, sig: \"$RSIG\"}")
sync_remote; run_cycle
check "dominio de actualización permitido" 'allowed_domains | grep -qx cdn.example.com'
check_update; wait
check "descarga iniciada" '[ "$(update_state)" = downloading ]'
check_update
check "instalador llamado con la imagen verificada" '[ "$(cat "$T/ota-arg" 2>/dev/null)" = "$UPDATE_DIR/update.img" ]'
check "instalador fallido no se reintenta en bucle" '[ "$(update_state)" = failed ]'

rm -rf "$UPDATE_DIR" "$T/ota-arg"
RSIG=$(printf 'nex-update:v1:%s:%s' 101 "$SHA" | openssl dgst -sha256 -sign "$T/keys/mdm.key" | openssl base64 -A)
RESP=$(make_resp ".update = {version: \"1.1\", build: 101, url: \"https://cdn.example.com/u.img\", sha256: \"$SHA\", size: $SIZE, sig: \"$RSIG\"}")
sync_remote; run_cycle; check_update
check "release firmado con la clave del MDM (no la de releases) se rechaza" '[ "$(update_state)" = failed ] && [ ! -e "$UPDATE_DIR/update.img" ]'

rm -rf "$UPDATE_DIR"
RSIG=$(printf 'nex-update:v1:%s:%s' 90 "$SHA" | openssl dgst -sha256 -sign "$T/keys/rel.key" | openssl base64 -A)
RESP=$(make_resp ".update = {version: \"0.9\", build: 90, url: \"https://cdn.example.com/u.img\", sha256: \"$SHA\", size: $SIZE, sig: \"$RSIG\"}")
sync_remote; run_cycle; check_update
check "build menor (downgrade) se ignora" '[ ! -d "$UPDATE_DIR" ]'

echo "---- $pass ok, $fail fallas"
[ $fail = 0 ]
