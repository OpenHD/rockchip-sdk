#!/bin/bash -e
# Modo TV cerrado: quita las vías de acceso local que permitirían saltar el
# bloqueo remoto. Corre al final de los overlays (prefijo zz-).
# Recuperación de un equipo endurecido: solo reflasheando por USB (Maskrom).

[ "$RK_NEX_MDM" ] && [ "$RK_NEX_MDM_HARDEN" ] || exit 0

TARGET_DIR="$1"
[ -d "$TARGET_DIR" ] || exit 1
cd "$TARGET_DIR"

message "NEX-OS: applying closed TV mode hardening..."

# ADB: shell root por USB.
rm -f usr/bin/adbd usr/bin/adbd-auth adb_keys etc/profile.d/adbd.sh
if [ -f etc/profile.d/usbdevice.sh ]; then
	sed -i -e '/^export USB_FUNCS=/{s/\badb\b//g;s/"  */"/;s/  *"/"/;s/   */ /g}' \
		etc/profile.d/usbdevice.sh
fi

# frecon: terminal en pantalla (VT) con shell.
rm -f etc/init.d/S35frecon etc/systemd/system/*/frecon.service

# Consola serie: Buildroot está configurado con shell root sin contraseña.
if [ -f etc/inittab ]; then
	sed -i -E 's#^([^#:]*::respawn:)-?/bin/(ba)?sh\b.*#\1-/bin/login \# hardened#' etc/inittab
fi

# Sin contraseña de root utilizable (la de fábrica es pública: "rockchip").
[ -f etc/shadow ] && sed -i 's#^root:[^:]*:#root:!:#' etc/shadow

# Accesos remotos y terminales gráficas.
rm -f etc/init.d/S50dropbear etc/init.d/S50sshd usr/bin/weston-terminal

# Marca usada por S99nex-os para no permitir desactivar el kiosk.
touch etc/nex-os-hardened
