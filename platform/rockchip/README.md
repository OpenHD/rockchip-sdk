# Rockchip adapter boundary

Legacy implementation stays in `device/rockchip/common`; root `Makefile` and
`rkflash.sh` retain their original symlinks. Calls without platform selectors
are delegated verbatim by `platform/dispatch.sh`. Explicit `--soc rockchip`
accepts the existing SDK arguments, including `chip:defconfig`.

No tree migration: the SDK derives paths through realpath and expects its
existing directory layout. `envsetup.sh` already has a missing target in this
checkout; repairing the vendor SDK is outside this port.
