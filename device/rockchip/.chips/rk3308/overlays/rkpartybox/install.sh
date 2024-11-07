#!/bin/bash -e

TARGET_DIR="$1"
[ "$TARGET_DIR" ] || exit 1

OVERLAY_DIR="$(dirname "$(realpath "$0")")"

message "Installing rkpartybox overlay to $TARGET_DIR..."

$RK_RSYNC "$OVERLAY_DIR/usr" "$TARGET_DIR/"

rm $TARGET_DIR/etc/init.d/S05async-commit.sh -rf
rm $TARGET_DIR/etc/init.d/S20urandom -rf
# rm $TARGET_DIR/etc/init.d/S40network -rf
rm $TARGET_DIR/etc/init.d/S41dhcpcd -rf
rm $TARGET_DIR/etc/init.d/S80dnsmasq -rf
rm $TARGET_DIR/etc/init.d/S50dropbear -rf
rm $TARGET_DIR/etc/init.d/S49chrony -rf

if [ -x "$TARGET_DIR/etc/init.d/S30dbus" ]; then
       mv $TARGET_DIR/etc/init.d/S30dbus $TARGET_DIR/etc/init.d/S03dbus
fi

if [ -x "$TARGET_DIR/etc/init.d/S36wifibt-init.sh" ]; then
       mv $TARGET_DIR/etc/init.d/S36wifibt-init.sh $TARGET_DIR/etc/init.d/S03wifibt-init.sh
fi

if [ -x "$TARGET_DIR/etc/init.d/S40bluetoothd" ]; then
      mv $TARGET_DIR/etc/init.d/S40bluetoothd $TARGET_DIR/etc/init.d/S30bluetoothd
fi
