# HiSilicon Hi3798MV300H: fase inicial

## Análisis de arquitectura existente

El inventario cubre las entradas raíz y los subsistemas device, kernel,
u-boot, rkbin, buildroot, debian, yocto, prebuilts, tools, rtos, app/apps y docs.
El SDK domina el repositorio; NEX web vive en apps/nex-os y su empaquetador en
tools/nex-os. No se realizó una auditoría línea por línea de los árboles vendor.

| Componente | Acoplamiento y decisión |
| --- | --- |
| build.sh | Era enlace a device/rockchip/common/scripts/build.sh; el SDK deriva rutas con realpath, usa RK_*, .chips/.chip, output/.config y hooks init/pre/build/post. Se conserva íntegro detrás del despachador. |
| Makefile | Enlace al Makefile Rockchip; Kconfig RK_*, consulta build.sh make-targets y delega targets al SDK. Se conserva. HiSilicon se invoca mediante build.sh explícito. |
| envsetup.sh | Enlace a buildroot/build/envsetup.sh, ausente en este checkout. El propio build vendor elimina el enlace. No se redefine para el port. |
| device/ | Perfiles Rockchip en .chips, configuración común, overlays y scripts vendor. No son configuración común multi-SoC. |
| kernel/ | Linux 5.10.209 con integración Rockchip. Contiene Hi3798CV200/Poplar y drivers HiSilicon genéricos; no constituyen BSP de esta placa. No se mezcla un kernel vendor nuevo aquí. |
| u-boot/ | Base 2017.09, integración Rockchip y soporte Poplar/CV200. No se selecciona para MV300H. |
| rkbin/ | DDR/loader/trust y herramientas Rockchip. No reutilizable como boot chain HiSilicon. |
| rkflash.sh | upgrade_tool, MiniLoaderAll, parameter.txt, trust/uboot/update.img y escritura al dispositivo. Exclusivamente Rockchip; no se ejecuta en esta fase. |
| buildroot/ | Motor y paquetes reutilizables. Perfiles rockchip, overlays, post-build, multimedia y fragmentos vendor requieren separación. |
| debian/ | Base rootfs potencialmente reutilizable; mk-rootfs-bullseye instala overlays, firmware Rockchip y paquetes gráficos. No usar sin revisar. |
| yocto/ | BitBake/Poky/OpenEmbedded disponibles; meta-rockchip, MACHINE y rksdk.conf/post-rootfs acoplados al SDK. No existe machine validada para esta placa. |
| tools/ | Herramientas Linux/mac/Windows Rockchip y tools/nex-os. Este último permite NEX_OS_OUTPUT_DIR, pero su destino por defecto es el overlay Rockchip. |
| prebuilts/ | Compiladores Linux x86 ARM/AArch64 disponibles; presencia no prueba compatibilidad ABI con un futuro BSP HiSilicon. |
| rtos/ | BSP Rockchip; no forma parte del milestone Linux HiSilicon. |

## Integración elegida

Se añade platform/ como frontera, sin mover el SDK ni duplicar motores rootfs.
Orden de configuración: platform/common/nex.conf (fuentes NEX),
platform/hisilicon/platform.conf (familia), configs/soc.conf (SoC/arquitectura
solicitados), boards/juw7.820.00218613/board.conf (identidad/estado).
Rockchip conserva su configuración y todos sus scripts. No se exportan estas
variables al flujo legacy ni se guarda selección global. Cada invocación nueva
requiere un par exacto SoC/board; no hay detección física automática sin runtime.

HiSilicon tiene hooks explícitos en tools/hooks.sh para toolchain, kernel, DTB,
bootloader, rootfs e imagen. Hoy son barreras que devuelven error, no comandos
vendor inventados. Copiar un archivo no autoriza su uso. La integración futura
necesita procedencia, compatibilidad y una implementación revisada por etapa.
La salida reservada es output/hisilicon/hi3798mv300h/juw7.820.00218613;
actualmente no se crea ni se escribe ningún artefacto.

## Hardware y estado

Datos de identificación aportados por el usuario: familia HiSilicon
Hi3798MV300-class, chip MRBCV3010D000H, board JUW7.820.00218613 y PCB
HI3798MV300 DMS. Hi3798MV300H es una variante probable, pendiente de confirmar
por boot log. ARCH=arm64 es el objetivo solicitado, no una medición del runtime.
No se conocen RAM, almacenamiento, UART, periféricos, layout o boot chain.

No existe todavía un BSP aprobado, DTB de board, defconfig kernel, toolchain
validada, configuración mínima rootfs ni contrato de imagen. El port no produce
firmware arrancable. El soporte CV200/Poplar encontrado no demuestra
compatibilidad; tampoco un firmware de otra placa MV300.

## Build previsto y pruebas actuales

```sh
./build.sh --soc hi3798mv300h --board juw7.820.00218613 show-config
./build.sh --soc hi3798mv300h --board juw7.820.00218613 check
./build.sh --soc hi3798mv300h --board juw7.820.00218613
bash tests/platform-dispatch.sh
```

show-config termina con éxito; check/all terminan con código 1 y enumeran
componentes faltantes. Etapas individuales: toolchain, kernel, dtb, bootloader,
rootfs, image. Selectores inválidos o etapas desconocidas devuelven código 2.
No hay flags de flash ni escape al SDK Rockchip desde este target.

Para comprobar Rockchip en Linux x86_64 con dependencias del SDK:

```sh
./build.sh help
make help
./build.sh <chip>:<defconfig>
./build.sh
```

Usar exactamente el perfil previamente funcional y comparar logs, configuración
y artefactos con el baseline; también puede usarse --soc rockchip seguido de
los mismos argumentos. Las pruebas locales verifican delegación, argumentos,
exit status y rutas intactas mediante un SDK simulado en un directorio temporal.
Eso no sustituye una compilación real ni una prueba de arranque.

El flujo futuro debe reutilizar buildroot/ con salida O= aislada y una
configuración mínima específica revisada: BusyBox/init/shell antes de gráficos.
No se inventa ahora defconfig ni se incluyen perfiles/post-build Rockchip.
Debian y Yocto son alternativas posteriores, tras disponer de kernel/ABI y
machine/configuración propios. tools/nex-os/build.sh admite destino explícito;
su reutilización y extracción de overlays comunes se evaluarán cuando llegue
la etapa NEX runtime, sin copiar Chromium/Mali/Rockchip a esta placa.

## Bring-up previsto y riesgos

1. Capturar identificación y boot log del sistema existente por un método
   documentado de solo lectura. Confirmar SoC, arquitectura y revisión de PCB.
2. Identificar UART y niveles eléctricos con evidencia; no asumir pinout,
   voltaje ni baudrate. Inventariar RAM, almacenamiento y periféricos.
3. Obtener BSP y fuentes con procedencia/licencia, configuración board y DTB;
   revisar clocks, reguladores, DDR, memoria y ABI. Mantener árbol kernel aparte.
4. Documentar boot chain, secure boot y recuperación. Solo tras validar un
   método de carga no persistente, planear Linux mínimo/initramfs hasta shell.
5. Comprobar UART, init, memoria y temporizadores; almacenamiento inicialmente
   sin escrituras. Luego validar drivers y rootfs antes de NEX runtime/UI.

No se proporcionan offsets, particiones, direcciones de carga ni comandos de
flasheo. DDR/DTB incorrectos pueden colgar el arranque o activar recursos de
forma insegura; bootloaders y firmware ajenos pueden impedir recuperación.
No flashear, escribir eMMC ni modificar imágenes reales durante esta fase.
El primer milestone verificable en hardware sigue siendo Linux mínimo hasta
shell; ni la UI ni la aceleración gráfica son requisitos de este primer paso.
