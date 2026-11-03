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

[ "${RK_NEX_MDM:-}" ] || exit 0

# --- Gestión remota (nex-agent) ---
# Sin configuración no se genera una imagen "sin dueño": el build falla.
[ -s "$SOURCE_DIR/nex-agent.conf" ] || {
	echo "Missing nex-agent.conf. Run tools/nex-os/build.sh with NEX_MDM_URL/NEX_MDM_ANON_KEY." >&2
	exit 1
}
for bin in jq curl dnsmasq; do
	[ -x "$TARGET_DIR/usr/bin/$bin" ] || [ -x "$TARGET_DIR/usr/sbin/$bin" ] || {
		echo "nex-agent needs '$bin' in the rootfs (buildroot/configs/rockchip/network/nex-mdm.config)." >&2
		exit 1
	}
done

install -D -m 0755 "$SOURCE_DIR/nex-agent" "$TARGET_DIR/usr/bin/nex-agent"
install -D -m 0600 "$SOURCE_DIR/nex-agent.conf" "$TARGET_DIR/etc/nex-agent.conf"
install -d -m 0700 "$TARGET_DIR/var/lib/nex-agent"

POLICY_DIR="$TARGET_DIR/etc/chromium/policies/managed"
install -D -m 0644 "$SOURCE_DIR/policies/nex-hardening.json" "$POLICY_DIR/nex-hardening.json"
# Valor inicial fallo-cerrado: solo la UI local hasta que el agente sincronice.
install -D -m 0644 "$SOURCE_DIR/policies/nex-mdm-urls.json" "$POLICY_DIR/nex-mdm-urls.json"

# La UI lee el estado público del agente en /agent/ (solo lectura, sin secretos).
ln -sfn /run/nex-agent/public "$TARGET_DIR/opt/nex-os/www/agent"

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
