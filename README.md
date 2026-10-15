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

La imagen final se genera en:

```text
output/firmware/update.img
```

## Instalar en el TV box

Para instalar por lotes en TV box RK3318/RK3328 (relevamiento del modelo, flasheo en
paralelo, vinculación por QR y verificación desde el panel) seguí
[apps/nex-os/docs/INSTALACION_TALLER.md](apps/nex-os/docs/INSTALACION_TALLER.md).

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
