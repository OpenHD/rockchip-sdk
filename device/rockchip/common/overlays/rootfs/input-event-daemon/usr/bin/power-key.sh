#!/bin/sh

EVENT=${1:-short-press}

LONG_PRESS_TIMEOUT=3 # s
DEBOUNCE=2 # s
PID_FILE=/var/run/power_key.pid
LOCK_FILE=/var/run/.power_key.lock

log()
{
	logger -t $(basename $0) "[$$]: $@"
}

# HACK: Monitoring power state changes and update the modified time
while ! pgrep -x inotifywait >/dev/null; do
	inotifywait -e modify /sys/power/state >/dev/null 2>&1
	# Avoid race with freezing processes
	sleep .2
	touch /sys/power/state
done&

parse_wakeup_time()
{
	LAST_MODIFY="$(stat -c "%Y" /sys/power/state)"
	NOW="$(date "+%s")"
	WAKE_TIME="$(expr "$NOW" - "$LAST_MODIFY")"

	log "Last state changed: $(date -d "@$LAST_MODIFY" "+%D %T")..."
}

short_press()
{
	log "Power key short press..."

	if which systemctl >/dev/null; then
		SUSPEND_CMD="systemctl suspend"
	elif which pm-suspend >/dev/null; then
		SUSPEND_CMD="pm-suspend"
	else
		SUSPEND_CMD="echo -n mem > /sys/power/state"
	fi

	# Debounce
	if [ -f $LOCK_FILE ]; then
		log "Too close to the latest request..."
		return 0
	fi

	if parse_wakeup_time; then
		if [ "$WAKE_TIME" -le $DEBOUNCE ]; then
			log "We might just resumed!"
			return 0
		fi
	fi

	log "Prepare to suspend..."

	touch $LOCK_FILE
	sh -c "$SUSPEND_CMD"
	{ sleep $DEBOUNCE && rm $LOCK_FILE; }&
}

long_press()
{
	log "Power key long press (${LONG_PRESS_TIMEOUT}s)..."

	log "Prepare to power off..."

	poweroff
}

log "Received power key event: $@..."

case "$EVENT" in
	press)
		# Lock it
		exec 3<$0
		flock -x 3

		start-stop-daemon -K -q -p $PID_FILE || true
		start-stop-daemon -S -q -b -m -p $PID_FILE -x /bin/sh -- \
			-c "sleep $LONG_PRESS_TIMEOUT; $0 long-press"

		# Unlock
		flock -u 3
		;;
	release)
		# Avoid race with press event
		sleep .5

		start-stop-daemon -K -q -p $PID_FILE && short_press
		;;
	short-press)
		short_press
		;;
	long-press)
		long_press
		;;
esac
