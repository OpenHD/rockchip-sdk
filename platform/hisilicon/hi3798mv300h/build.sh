#!/bin/bash
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
source "$ROOT/platform/common/nex.conf"
source "$HERE/../platform.conf"
source "$HERE/configs/soc.conf"
source "$HERE/boards/juw7.820.00218613/board.conf"
source "$HERE/tools/hooks.sh"
[ "$#" -le 1 ] || { echo "ERROR: Expected one stage" >&2; exit 2; }
stage=${1:-all}
case "$stage" in
    help|--help|-h)
        echo "Stages: show-config check toolchain kernel dtb bootloader rootfs image all"
        echo "show-config is read-only; all build stages fail until reviewed BSP integration exists."
        exit 0 ;;
    show-config)
        printf '%s\n' "PLATFORM=$PLATFORM" "SOC=$SOC" "ARCH=$ARCH" "BOARD=$BOARD" \
            "SOC_STATUS=$SOC_STATUS" "BOARD_STATUS=$BOARD_STATUS" \
            "ROOTFS_BACKEND=buildroot (planned reuse)" \
            "OUTPUT=$ROOT/output/$PLATFORM/$SOC/$BOARD (reserved; not created)"
        exit 0 ;;
    toolchain|kernel|dtb|bootloader|rootfs|image) "hook_$stage" ;;
    all|check)
        status=0
        for component in toolchain kernel dtb bootloader rootfs image; do
            "hook_$component" || status=1
        done
        exit "$status" ;;
    *) echo "ERROR: Unsupported HiSilicon stage '$stage'" >&2; exit 2 ;;
esac
