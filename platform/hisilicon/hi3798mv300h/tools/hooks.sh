# Phase-one stage contracts. No artifact probing, fallback, flashing or writes.
# Replace a hook only after documenting exact board provenance and validation.
hook_toolchain() {
    echo "ERROR: Missing validated AArch64 toolchain for Hi3798MV300H BSP (compiler prefix, ABI and vendor-kernel compatibility pending)" >&2
    return 1
}
hook_kernel() {
    echo "ERROR: Missing Hi3798MV300H BSP (separate kernel tree and reviewed defconfig required)" >&2
    return 1
}
hook_dtb() {
    echo "ERROR: Missing board DTB for JUW7.820.00218613" >&2
    return 1
}
hook_bootloader() {
    echo "ERROR: Missing board-validated bootloader/BSP for JUW7.820.00218613" >&2
    return 1
}
hook_rootfs() {
    echo "ERROR: Missing reviewed minimal Buildroot configuration for JUW7.820.00218613; existing Rockchip profiles cannot be reused unchanged" >&2
    return 1
}
hook_image() {
    echo "ERROR: Missing validated HiSilicon image/boot contract; partition layout, load addresses and signing requirements unknown" >&2
    return 1
}
