#!/bin/bash
set -euo pipefail

TARGET_DIR=$1
SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

[ -d "$SOURCE_DIR/www" ] || {
	echo "NEX-OS is not built. Run tools/nex-os/build.sh first." >&2
	exit 1
}

mkdir -p "$TARGET_DIR/opt/nex-os" "$TARGET_DIR/etc/default" "$TARGET_DIR/etc/init.d"
rm -rf "$TARGET_DIR/opt/nex-os/www"
cp -a "$SOURCE_DIR/www" "$TARGET_DIR/opt/nex-os/"
cp "$SOURCE_DIR/S99nex-os" "$TARGET_DIR/etc/init.d/S99nex-os"
cp "$SOURCE_DIR/nex-os.default" "$TARGET_DIR/etc/default/nex-os"
chmod 0755 "$TARGET_DIR/etc/init.d/S99nex-os"

# Weston lee órdenes en caliente (apagar/prender la pantalla) de este archivo.
mkdir -p "$TARGET_DIR/etc/profile.d"
echo 'export WESTON_DRM_CONFIG=/tmp/.weston_drm.conf' > "$TARGET_DIR/etc/profile.d/nex-weston.sh"

# Tecla power: pantalla on/off en vez de suspender (ver nex-power-key.sh).
if [ -d "$TARGET_DIR/etc/input-event-daemon.conf.d" ]; then
	install -D -m 0755 "$SOURCE_DIR/nex-power-key.sh" "$TARGET_DIR/usr/bin/nex-power-key.sh"
	cat > "$TARGET_DIR/etc/input-event-daemon.conf.d/power-key.conf" <<'CONF'
[Keys]
*POWER:1      = /usr/bin/nex-power-key.sh press
*POWER:0      = /usr/bin/nex-power-key.sh release
CONF
fi

[ "${RK_NEX_MDM:-}" ] || exit 0

# --- Gestión remota (nex-agent) ---
# Sin configuración no se genera una imagen "sin dueño": el build falla.
[ -s "$SOURCE_DIR/nex-agent.conf" ] || {
	echo "Missing nex-agent.conf. Run tools/nex-os/build.sh with NEX_MDM_URL/NEX_MDM_ANON_KEY." >&2
	exit 1
}
# Sin la clave pública de firma el equipo nunca aceptaría una configuración.
ls "$SOURCE_DIR"/mdm-sign.d/*.pem >/dev/null 2>&1 || {
	echo "Missing mdm-sign.d/*.pem. Run tools/nex-os/build.sh with NEX_MDM_SIGN_PUBKEY." >&2
	exit 1
}
for bin in jq curl dnsmasq openssl; do
	[ -x "$TARGET_DIR/usr/bin/$bin" ] || [ -x "$TARGET_DIR/usr/sbin/$bin" ] || {
		echo "nex-agent needs '$bin' in the rootfs (buildroot/configs/rockchip/network/nex-mdm.config)." >&2
		exit 1
	}
done

install -D -m 0755 "$SOURCE_DIR/nex-agent" "$TARGET_DIR/usr/bin/nex-agent"
install -D -m 0600 "$SOURCE_DIR/nex-agent.conf" "$TARGET_DIR/etc/nex-agent.conf"
# Varias claves aceptadas: la actual y las de reserva (rotación sin reflashear).
rm -rf "$TARGET_DIR/etc/nex-agent/mdm-sign.d" "$TARGET_DIR/etc/nex-agent/release.d" \
	"$TARGET_DIR/etc/nex-agent/mdm-sign.pub.pem" "$TARGET_DIR/etc/nex-agent/release.pub.pem"
install -d -m 0755 "$TARGET_DIR/etc/nex-agent/mdm-sign.d"
install -m 0644 "$SOURCE_DIR"/mdm-sign.d/*.pem "$TARGET_DIR/etc/nex-agent/mdm-sign.d/"
# Sin clave de releases el equipo ignora las actualizaciones remotas.
if ls "$SOURCE_DIR"/release.d/*.pem >/dev/null 2>&1; then
	install -d -m 0755 "$TARGET_DIR/etc/nex-agent/release.d"
	install -m 0644 "$SOURCE_DIR"/release.d/*.pem "$TARGET_DIR/etc/nex-agent/release.d/"
else
	echo "WARNING: no release keys: remote firmware updates disabled in this image." >&2
fi
# Número de build (entero creciente): el equipo solo instala releases mayores.
if [ -s "$SOURCE_DIR/nex-os.build" ]; then
	install -D -m 0644 "$SOURCE_DIR/nex-os.build" "$TARGET_DIR/etc/nex-os-build"
else
	date -u +%s > "$TARGET_DIR/etc/nex-os-build"
fi
echo "NEX-OS build number: $(cat "$TARGET_DIR/etc/nex-os-build")"

# Relay de la UI hacia el agente (Wi-Fi, código de desbloqueo).
install -D -m 0755 "$SOURCE_DIR/cgi-nex" "$TARGET_DIR/opt/nex-os/www/cgi-bin/nex"

# Usuarios sin privilegios: nex-www (servidor web local) y nex-ui (Chromium).
add_user() { # nombre uid grupos-extra
	grep -q "^$1:" "$TARGET_DIR/etc/group" || echo "$1:x:$2:" >> "$TARGET_DIR/etc/group"
	grep -q "^$1:" "$TARGET_DIR/etc/passwd" ||
		echo "$1:x:$2:$2:NEX-OS:/nonexistent:/bin/false" >> "$TARGET_DIR/etc/passwd"
	if [ -f "$TARGET_DIR/etc/shadow" ] && ! grep -q "^$1:" "$TARGET_DIR/etc/shadow"; then
		echo "$1:!:::::::" >> "$TARGET_DIR/etc/shadow"
	fi
	for g in $3; do
		grep -q "^$g:" "$TARGET_DIR/etc/group" || continue
		grep -Eq "^$g:[^:]*:[^:]*:(.*,)?$1(,.*)?$" "$TARGET_DIR/etc/group" && continue
		sed -i -E "s/^($g:[^:]*:[^:]*:)(.+)$/\1\2,$1/; s/^($g:[^:]*:[^:]*:)$/\1$1/" "$TARGET_DIR/etc/group"
	done
}
add_user nex-www 950 ""
add_user nex-ui 951 "video audio input render"
# El kiosk usa estos usuarios (S99nex-os). NEX_UI_USER=root solo para diagnosticar.
sed -i '/^NEX_UI_USER=/d; /^NEX_WWW_USER=/d' "$TARGET_DIR/etc/default/nex-os"
{
	echo "NEX_UI_USER=${NEX_UI_USER:-nex-ui}"
	echo "NEX_WWW_USER=nex-www"
} >> "$TARGET_DIR/etc/default/nex-os"

# Hora: estos equipos no tienen RTC; chrony corrige de golpe cualquier desvío
# (el agente además adelanta el reloj a la última hora conocida).
if [ -d "$TARGET_DIR/etc" ] && [ -x "$TARGET_DIR/usr/sbin/chronyd" ]; then
	cat > "$TARGET_DIR/etc/chrony.conf" <<'CHRONY'
pool pool.ntp.org iburst
makestep 1 -1
CHRONY
fi

POLICY_DIR="$TARGET_DIR/etc/chromium/policies/managed"
install -D -m 0644 "$SOURCE_DIR/policies/nex-hardening.json" "$POLICY_DIR/nex-hardening.json"
# Valor inicial fallo-cerrado: solo la UI local hasta que el agente sincronice.
install -D -m 0644 "$SOURCE_DIR/policies/nex-mdm-urls.json" "$POLICY_DIR/nex-mdm-urls.json"

# La UI lee el estado público del agente en /agent/ (solo lectura, sin secretos).
ln -sfn /run/nex-agent/public "$TARGET_DIR/opt/nex-os/www/agent"

# Piso para el reloj sin RTC (ver clock_guard en nex-agent).
date -u +%s > "$TARGET_DIR/etc/nex-os-build-epoch"

git -C "$SOURCE_DIR" describe --always --dirty 2>/dev/null \
	> "$TARGET_DIR/etc/nex-os-version" || echo unknown > "$TARGET_DIR/etc/nex-os-version"

# dnsmasq del sistema escucharía en 0.0.0.0:53 y chocaría con el filtro local.
rm -f "$TARGET_DIR/etc/init.d/S80dnsmasq"

# init lo relanza si muere o si alguien lo mata.
if [ -f "$TARGET_DIR/etc/inittab" ]; then
	sed -i '/nex-agent/d' "$TARGET_DIR/etc/inittab"
	echo "::respawn:/usr/bin/nex-agent # nex-agent" >> "$TARGET_DIR/etc/inittab"
fi
if [ -d "$TARGET_DIR/lib/systemd/system" ] || [ -d "$TARGET_DIR/usr/lib/systemd/system" ]; then
	UNIT_DIR="$TARGET_DIR/usr/lib/systemd/system"
	mkdir -p "$UNIT_DIR" "$TARGET_DIR/etc/systemd/system/multi-user.target.wants"
	cat > "$UNIT_DIR/nex-agent.service" <<'UNIT'
[Unit]
Description=NEX-OS remote management agent
After=network.target

[Service]
ExecStart=/usr/bin/nex-agent
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT
	ln -sfn /usr/lib/systemd/system/nex-agent.service \
		"$TARGET_DIR/etc/systemd/system/multi-user.target.wants/nex-agent.service"
fi
