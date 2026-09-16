#!/bin/bash
set -euo pipefail

TARGET_DIR=$1
SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

[ -d "$SOURCE_DIR/www" ] || {
	echo "NEX-OS is not built. Run tools/nex-os/build.sh first." >&2
	exit 1
}

mkdir -p "$TARGET_DIR/opt/nex-os" "$TARGET_DIR/etc/default" "$TARGET_DIR/etc/init.d"
cp -a "$SOURCE_DIR/www" "$TARGET_DIR/opt/nex-os/"
cp "$SOURCE_DIR/S99nex-os" "$TARGET_DIR/etc/init.d/S99nex-os"
cp "$SOURCE_DIR/nex-os.default" "$TARGET_DIR/etc/default/nex-os"
chmod 0755 "$TARGET_DIR/etc/init.d/S99nex-os"