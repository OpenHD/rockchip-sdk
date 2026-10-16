#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# No platform options: pass every argument verbatim to the original SDK.
selected=0
for arg in "$@"; do
    case "$arg" in --soc|--soc=*|--board|--board=*) selected=1 ;; esac
done
if [ "$selected" = 0 ]; then
    exec bash "$ROOT/device/rockchip/common/scripts/build.sh" "$@"
fi
soc= board=
args=()
fail() { echo "ERROR: $*" >&2; exit 2; }
while [ "$#" -gt 0 ]; do
    case "$1" in
        --soc|--board)
            [ "$#" -ge 2 ] && [ -n "$2" ] && [[ "$2" != -* ]] || fail "Missing value for $1"
            if [ "$1" = --soc ]; then
                [ -z "$soc" ] || fail "Duplicate --soc"
                soc=$2
            else
                [ -z "$board" ] || fail "Duplicate --board"
                board=$2
            fi
            shift 2 ;;
        --soc=*) [ -z "$soc" ] || fail "Duplicate --soc"; soc=${1#*=}; [ -n "$soc" ] || fail "Empty --soc"; shift ;;
        --board=*) [ -z "$board" ] || fail "Duplicate --board"; board=${1#*=}; [ -n "$board" ] || fail "Empty --board"; shift ;;
        *) args+=("$1"); shift ;;
    esac
done
case "$soc:$board" in
    hi3798mv300h:juw7.820.00218613)
        exec bash "$ROOT/platform/hisilicon/hi3798mv300h/build.sh" ${args[@]+"${args[@]}"} ;;
    rockchip:)
        exec bash "$ROOT/device/rockchip/common/scripts/build.sh" ${args[@]+"${args[@]}"} ;;
    *) fail "Unsupported SoC/board pair '$soc:$board'. Use --soc hi3798mv300h --board juw7.820.00218613, or legacy Rockchip chip:defconfig." ;;
esac
