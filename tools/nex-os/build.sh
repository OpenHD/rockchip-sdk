#!/bin/bash
set -euo pipefail

SDK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
LOCAL_SOURCE_DIR="$SDK_DIR/apps/nex-os"
SOURCE_DIR=${NEX_OS_SOURCE_DIR:-"$LOCAL_SOURCE_DIR"}
OUTPUT_DIR=${NEX_OS_OUTPUT_DIR:-"$SDK_DIR/device/rockchip/common/overlays/rootfs/nex-os/www"}
REPOSITORY=${NEX_OS_REPOSITORY:-https://github.com/shadownrx/windows.git}
REF=${NEX_OS_REF:-main}

command -v npm >/dev/null || { echo "Node.js/npm are required" >&2; exit 1; }

if [ ! -f "$SOURCE_DIR/package.json" ]; then
	command -v git >/dev/null || { echo "git is required when apps/nex-os is absent" >&2; exit 1; }
	if [ ! -d "$SOURCE_DIR/.git" ]; then
		git clone --depth 1 --branch "$REF" "$REPOSITORY" "$SOURCE_DIR"
	else
		git -C "$SOURCE_DIR" fetch --depth 1 origin "$REF"
		git -C "$SOURCE_DIR" reset --hard FETCH_HEAD
	fi
fi

LOCK_FILE="$SOURCE_DIR/package-lock.json"
INSTALL_STAMP="$SOURCE_DIR/node_modules/.install-stamp"
NPM_FLAGS="--prefer-offline --no-audit --no-fund"

if [ -f "$LOCK_FILE" ] && [ -f "$INSTALL_STAMP" ] && \
	[ "$(cat "$INSTALL_STAMP")" = "$(sha256sum "$LOCK_FILE" | cut -d' ' -f1)" ]; then
	printf 'Dependencies already match package-lock.json, skipping npm ci\n'
else
	npm --prefix "$SOURCE_DIR" ci $NPM_FLAGS
	if [ -f "$LOCK_FILE" ]; then
		sha256sum "$LOCK_FILE" | cut -d' ' -f1 > "$INSTALL_STAMP"
	fi
fi

npm --prefix "$SOURCE_DIR" run build

rm -rf "$OUTPUT_DIR"
mkdir -p "$(dirname "$OUTPUT_DIR")"
cp -a "$SOURCE_DIR/dist" "$OUTPUT_DIR"
printf 'NEX-OS static files installed in %s\n' "$OUTPUT_DIR"