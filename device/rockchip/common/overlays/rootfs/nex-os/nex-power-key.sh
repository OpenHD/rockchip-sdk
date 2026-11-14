#!/bin/sh
# Tecla power del control en NEX-OS (input-event-daemon, ver install.sh).
#
# Estos TV box no despiertan bien de un suspend ni se prenden con el control
# después de un poweroff, así que:
# - toque corto: apaga/prende la pantalla (weston, config dinámica) y, al
#   apagar, reinicia Chromium para cortar el audio de lo que se esté viendo;
# - mantener 3 s: reinicia el equipo.

EVENT=${1:-short-press}
LONG_PRESS_TIMEOUT=3
PID_FILE=/run/nex-power-key.pid
OFF_FILE=/run/nex-os/display_off
WESTON_DRM_CONFIG=${WESTON_DRM_CONFIG:-/tmp/.weston_drm.conf}

log() { logger -t nex-power-key -- "$*"; }

short_press() {
	mkdir -p /run/nex-os
	if [ -e "$OFF_FILE" ]; then
		log "pantalla encendida"
		echo "compositor:state:on" > "$WESTON_DRM_CONFIG"
		rm -f "$OFF_FILE"
	else
		log "pantalla apagada"
		touch "$OFF_FILE"
		# "off": sin entrada; solo esta tecla (leída por input-event-daemon) la prende.
		echo "compositor:state:off" > "$WESTON_DRM_CONFIG"
		killall chromium 2>/dev/null
	fi
}

case "$EVENT" in
press)
	start-stop-daemon -K -q -p $PID_FILE || true
	start-stop-daemon -S -q -b -m -p $PID_FILE -x /bin/sh -- \
		-c "sleep $LONG_PRESS_TIMEOUT; $0 long-press"
	;;
release)
	start-stop-daemon -K -q -p $PID_FILE && short_press
	;;
short-press)
	short_press
	;;
long-press)
	log "reinicio por tecla power"
	reboot
	;;
esac
