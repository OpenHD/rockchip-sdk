#!/bin/bash -e

[ -z "$RK_EXTRA_FONTS_DISABLED" ] || exit 0
if [ "$RK_EXTRA_FONTS_DEFAULT" -a "$POST_OS" != yocto ]; then
	notice "No extra fonts for $POST_OS by default"
	exit 0
fi

TARGET_DIR="$1"
[ "$TARGET_DIR" ] || exit 1

OVERLAY_DIR="$(dirname "$(realpath "$0")")"
cd "$OVERLAY_DIR"

for f in *.tar; do
	message "Installing extra font(${f%.tar}) to $TARGET_DIR..."
	tar xf "$f" -C "$TARGET_DIR"
done
