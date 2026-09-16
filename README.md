# NEX-OS TV Box

Firmware Rockchip con NEX-OS integrado como escritorio principal.

## Arquitectura

```text
Kernel Rockchip -> Linux/Buildroot -> Weston/Wayland -> NEX-OS shell
```

El repositorio contiene tanto el SDK/firmware como el código fuente web:

- `apps/nex-os/`: aplicación React/Vite, AssemblyScript y PWA.
- `buildroot/`: sistema Linux y paquetes del rootfs.
- `kernel/`: kernel Linux existente.
- `device/rockchip/`: perfiles de placa, overlays y scripts Rockchip.
- `tools/nex-os/`: compilación y empaquetado de NEX-OS dentro del rootfs.

NEX-OS reemplaza el escritorio y la interfaz visible de Chromium. Weston se
configura sin panel ni launchers de demostración, y el dispositivo inicia
directamente en el shell de NEX-OS. Chromium permanece únicamente como runtime
gráfico interno para renderizar la aplicación web; el usuario no interactúa
con un navegador separado.

Chromium arranca en modo kiosk (`device/rockchip/common/overlays/rootfs/nex-os/S99nex-os`)
con aceleración por GPU (EGL/Mali), decodificación de video por hardware
(RKMPP) y trabajo en segundo plano deshabilitado, ya que solo corre una
pestaña en primer plano. Para ajustar esas flags en una placa puntual, definí
`RK_NEX_OS_CHROMIUM_FLAGS` en `/etc/default/nex-os` dentro de la imagen.

## Requisitos de compilación

- Linux x86_64.
- Node.js 18 o superior y npm.
- Dependencias del SDK Rockchip y toolchain correspondiente a la placa.
- Un `chip` y `defconfig` que coincidan exactamente con el TV box y su memoria DDR.

## Compilar el escritorio y el firmware

Desde la raíz del repositorio:

```sh
tools/nex-os/build.sh
find device/rockchip/.chips -type f -name '*defconfig' | sort
./build.sh <chip>:<defconfig>
./build.sh
```

`tools/nex-os/build.sh` compila `apps/nex-os` y copia el resultado estático al
overlay del rootfs. `node_modules`, `dist` y la caché de fuentes no se
versionan.

Desde la V2, el script reutiliza `node_modules` entre compilaciones: solo
corre `npm ci` cuando cambia `package-lock.json` (comparando un hash guardado
en `node_modules/.install-stamp`), lo que evita reinstalar dependencias en
cada build del firmware. La compilación del kernel y de Buildroot ya usa
`ccache` y paralelismo por defecto (`BR2_CCACHE=y`, `BR2_JLEVEL=0`), así que
las recompilaciones incrementales son notablemente más rápidas.

La imagen final se genera en:

```text
output/firmware/update.img
```

## Instalar en el TV box

1. Realiza una copia de seguridad del sistema actual.
2. Confirma el modelo, SoC, memoria DDR y `defconfig` compatible.
3. Conecta el TV box por USB en modo Maskrom/Loader.
4. Desde la raíz del repositorio ejecuta:

```sh
./rkflash.sh update
```

El flasheo reemplaza el sistema del dispositivo. No uses una imagen de otra
placa: una configuración incorrecta puede impedir el arranque.

## Desarrollo de NEX-OS

```sh
cd apps/nex-os
npm install
npm run dev
npm run build
npm run lint
```

La interfaz puede usar Supabase y APIs externas; esas funciones necesitan
conectividad de red en el dispositivo. El backend opcional de música está en
`apps/nex-os/server/` y no forma parte del firmware kiosk por defecto.

Para más detalles consulta [tools/nex-os/README.md](tools/nex-os/README.md).
