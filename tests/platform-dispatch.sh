#!/bin/bash
# Isolated routing regression: never invokes the real vendor build/flash tools.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/device/rockchip/common/scripts"
cp "$ROOT/build.sh" "$TMP/build.sh"
cp -R "$ROOT/platform" "$TMP/platform"
cat > "$TMP/device/rockchip/common/scripts/build.sh" <<'MOCK'
#!/bin/bash
printf '<%s>\n' "$@"
exit 7
MOCK
expect_fail() {
    local expected=$1; shift
    local result=0
    "$@" > "$TMP/result" 2>&1 || result=$?
    [ "$result" -eq "$expected" ] || { cat "$TMP/result"; exit 1; }
}
for entry in "$ROOT/build.sh" "$ROOT/platform/dispatch.sh" "$ROOT/platform/hisilicon/hi3798mv300h/build.sh" "$ROOT/platform/hisilicon/hi3798mv300h/tools/hooks.sh"; do
    bash -n "$entry"
done
expect_fail 7 bash "$TMP/build.sh" rk3588:rockchip_defconfig 'argument with spaces' make-targets
printf '<%s>\n' rk3588:rockchip_defconfig 'argument with spaces' make-targets > "$TMP/expected"
cmp "$TMP/expected" "$TMP/result"
expect_fail 7 bash "$TMP/build.sh" --soc rockchip kernel
[ "$(cat "$TMP/result")" = '<kernel>' ]
expect_fail 7 bash "$TMP/build.sh"
expect_fail 7 bash -c 'source "$1" kernel' _ "$TMP/build.sh"
[ "$(cat "$TMP/result")" = '<kernel>' ]
bash "$TMP/build.sh" --board=juw7.820.00218613 --soc=hi3798mv300h show-config > "$TMP/config"
for value in SOC=hi3798mv300h ARCH=arm64 BOARD=juw7.820.00218613; do
    rg -Fx "$value" "$TMP/config" > /dev/null
done
for stage in all check toolchain kernel dtb bootloader rootfs image; do
    expect_fail 1 bash "$TMP/build.sh" --soc hi3798mv300h --board juw7.820.00218613 "$stage"
done
expect_fail 1 bash "$TMP/build.sh" --soc hi3798mv300h --board juw7.820.00218613
rg -F 'Missing Hi3798MV300H BSP' "$TMP/result" > /dev/null
rg -F 'Missing board DTB for JUW7.820.00218613' "$TMP/result" > /dev/null
for soc in unknown '../rockchip' hi3798cv200; do
    expect_fail 2 bash "$TMP/build.sh" --soc "$soc" --board juw7.820.00218613
done
expect_fail 2 bash "$TMP/build.sh" --board juw7.820.00218613
expect_fail 2 bash "$TMP/build.sh" --soc hi3798mv300h --board wrong
expect_fail 2 bash "$TMP/build.sh" --soc hi3798mv300h --board
expect_fail 2 bash "$TMP/build.sh" --soc= --board wrong
expect_fail 2 bash "$TMP/build.sh" --soc rockchip --soc rockchip
expect_fail 2 bash "$TMP/build.sh" --soc hi3798mv300h --board juw7.820.00218613 flash
expect_fail 2 bash "$TMP/build.sh" --soc hi3798mv300h --board juw7.820.00218613 rootfs extra
[ ! -e "$TMP/output" ]
[ "$(readlink "$ROOT/Makefile")" = device/rockchip/common/Makefile ]
[ "$(readlink "$ROOT/rkflash.sh")" = device/rockchip/common/scripts/rkflash.sh ]
echo 'PASS: legacy delegation, selection, stage failures, no output writes'
