# JUW7.820.00218613

Identificación aportada por el usuario, sin verificación independiente runtime:

- SoC family: HiSilicon Hi3798MV300-class.
- Probable variant: Hi3798MV300H, pendiente de confirmar por boot log.
- Chip marking: MRBCV3010D000H.
- Board: JUW7.820.00218613.
- PCB marking: HI3798MV300 DMS.
- Arquitectura objetivo: ARM64/AArch64, pendiente de verificar en runtime.

RAM, eMMC, UART, red, Wi-Fi, reguladores, particiones y secure boot desconocidos.
No hay DTB, BSP, bootloader ni firmware aprobados para esta placa. No usar
Poplar/CV200 ni firmware de otra board MV300 como sustitutos silenciosos.
Ver docs/platforms/hisilicon-hi3798mv300h.md para el plan y las barreras de build.
