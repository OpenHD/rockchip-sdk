# NEX-OS en la imagen Rockchip

Esta integración conserva el kernel y el arranque actuales. NEX-OS se compila
como el shell de escritorio del dispositivo sobre Weston/Wayland. NEX-OS
reemplaza la interfaz visible y los launchers de Chromium; Chromium queda como
runtime gráfico interno para renderizar la aplicación web. Weston queda
configurado sin panel ni launchers de demostración, por lo que NEX-OS es el
único escritorio visible desde el arranque.

## Preparar los archivos web

El código fuente está integrado en `apps/nex-os/`. Desde la raíz del SDK, con
Node.js 18 o superior:

```sh
tools/nex-os/build.sh
```

El resultado se coloca en el overlay local y no se versiona. El script solo usa
GitHub como respaldo si falta `apps/nex-os/package.json`.

## Activar la imagen

En la configuración del chip deben estar habilitados:

```text
BR2_PACKAGE_WAYLAND=y
BR2_PACKAGE_WESTON=y
BR2_PACKAGE_WESTON_DRM=y
BR2_PACKAGE_CHROMIUM_WAYLAND=y  # runtime gráfico interno de NEX-OS
```

Después se construye normalmente:

```sh
./build.sh <chip>:<defconfig>
./build.sh rootfs
```

El overlay `nex-os` se instala cuando están habilitados los overlays de
rootfs. Para desactivar el kiosk, cambie `RK_NEX_OS=0` en
`/etc/default/nex-os` dentro de la imagen.

El backend de NEX-OS, Supabase y las APIs externas no forman parte de la imagen;
la interfaz web necesita conectividad de red para las funciones que las usan.

## Instalación en otro TV box

No se debe usar una imagen genérica: el `chip` y el `defconfig` deben coincidir
con la placa y su memoria DDR. Para consultar perfiles disponibles:

```sh
find device/rockchip/.chips -type f -name '*defconfig' | sort
```

Ejemplo para una placa RK3568 de referencia:

```sh
CHIP=rk3566_rk3568
DEFCONFIG=rockchip_rk3568_evb1_ddr4_v10_defconfig

tools/nex-os/build.sh
./build.sh "$CHIP:$DEFCONFIG"
./build.sh
```

La imagen se genera en `output/firmware/update.img`. Con el TV box apagado,
conéctelo por USB en modo Maskrom/Loader y ejecute desde el SDK:

```sh
./rkflash.sh update
```

El flasheo reemplaza el sistema del dispositivo. Debe hacerse una copia de
seguridad y confirmar primero el modelo exacto; una configuración incorrecta
puede impedir el arranque.