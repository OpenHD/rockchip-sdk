#!/bin/bash -e

source "${RK_POST_HELPER:-$(dirname "$(realpath "$0")")/../post-hooks/post-helper}"

[ "$RK_ROOTFS_STRIP_MODULES" ] || exit 0

message "Strip kernel modules..."

source "$RK_SCRIPTS_DIR/kernel-helper"

find "$TARGET_DIR" -name "*.ko" \
	-exec ${RK_KERNEL_TOOLCHAIN}strip --strip-unneeded -v {} \;
