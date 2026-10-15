# Instalación de NEX-OS en TV box (taller, por lotes)

Procedimiento para dejar TV box **RK3318/RK3328** con NEX-OS listos para entregar:
flasheados, vinculados a la empresa cliente y verificados desde el panel.

> El flasheo **borra el Android original**. Con la imagen endurecida (modo TV cerrado) el equipo ya no tiene
> ADB ni consola: solo se recupera reflasheando por USB. Por eso el respaldo del firmware original y la
> verificación de la primera unidad de cada modelo son obligatorios.

## Resumen

| Paso | Cuándo | Herramienta |
|---|---|---|
| 1. Relevar el modelo | Una vez por modelo nuevo | `tools/nex-os/taller/identificar.sh` |
| 2. Preparar la imagen | Una vez por modelo y por versión | `tools/nex-os/build.sh` + `./build.sh` |
| 3. Unidad piloto | Una vez por modelo | Imagen de desarrollo (sin endurecer) |
| 4. Flasheo por lotes | Cada lote | FactoryTool (Windows) o `flash-lote.sh` (Linux) |
| 5. Vincular y verificar | Cada equipo | TV + panel `/admin` (QR) |
| 6. Etiquetar y embalar | Cada equipo | — |

## Qué hace falta en el taller

- **PC con Windows o Linux.**
  - Windows: `tools/windows/DriverAssitant_v5.13.zip` (driver Rockchip) y `tools/windows/FactoryTool_v1.91.zip`
    (varios equipos a la vez) o `RKDevTool_Release_v3.31.zip` (de a uno).
  - Linux: `tools/linux/Linux_Upgrade_Tool` (lo usa `flash-lote.sh`).
- **Cables USB macho-macho (A-A)**, uno por puesto, y un hub USB con fuente propia para flashear en paralelo.
- Un escarbadientes o clip para el botón de reset (suele estar dentro del conector AV).
- Un celular con el panel abierto (sesión iniciada con MFA) para escanear los QR de vinculación.
- Red Wi-Fi o cable para que cada equipo se conecte a internet en la primera prueba.

## 1. Relevar el modelo (una vez por modelo)

Los TV box se venden con el mismo nombre comercial y placas distintas. La imagen tiene que coincidir con la
placa: SoC, tipo de memoria, almacenamiento y chip Wi-Fi.

1. Abrir la carcasa de un equipo y anotar:
   - el texto serigrafiado de la placa (ej. `RK3318_V1.4`, `HK1_RBOX`);
   - el chip principal (debe decir RK3318 o RK3328);
   - la memoria (DDR3/DDR4/LPDDR3) y el almacenamiento (eMMC o NAND).
2. Con el Android original funcionando, activar *Opciones de desarrollador → Depuración ADB* y correr:
   ```sh
   tools/nex-os/taller/identificar.sh 192.168.1.50   # IP del TV box
   ```
   El script deja `relevamiento-<modelo>-<fecha>/` con:
   - `resumen.txt`: SoC, RAM real, almacenamiento y chip Wi-Fi;
   - `original.dts`: el árbol de dispositivos original, que se usa para portar LED, control remoto (IR) y Wi-Fi.
3. Criterios:
   - **RK3318/RK3328 con eMMC**: compatible con el perfil `rockchip_rk3328_nex_tvbox_defconfig`.
   - **NAND**: no flashear hasta validar el soporte.
   - **Otro SoC** (Amlogic, Allwinner): no compatible con este SDK.
   - **RAM**: con 1 GB, Chromium + NEX-OS anda justo; para streaming en HD conviene 2 GB. Muchos equipos
     anuncian 4 GB y tienen menos: confiar en el `MemTotal` del relevamiento.

### Perfil de placa

`device/rockchip/.chips/rk3328/rockchip_rk3328_nex_tvbox_defconfig` usa el DTS del **A95X Z2**
(`rk3318-a95x-z2.dts`, ya incluido en el kernel) y activa el fragmento de kernel del MDM.

Para un modelo con otra placa:

1. Copiar el DTS a `kernel/arch/arm64/boot/dts/rockchip/rk3318-<modelo>.dts` y agregarlo al `Makefile` de esa carpeta.
2. Ajustar con el `original.dts` del relevamiento:
   - Wi-Fi (`sdio_pwrseq`, `reset-gpios`);
   - LED (`gpio-leds`);
   - receptor IR (`ir-receiver`, `gpios`).
3. Crear `rockchip_rk3328_nex_<modelo>_defconfig` con el `RK_KERNEL_DTS_NAME` nuevo.

**Control remoto:** NEX-OS se maneja con flechas, OK y "atrás". En la unidad piloto hay que confirmar que
el control original envía esas teclas. Si no las envía, hay que cargar el mapa de teclas del control en el DTS.

## 2. Preparar la imagen

En un PC Linux x86_64 con el SDK, desde la raíz del repositorio:

```sh
./build.sh rk3328:rockchip_rk3328_nex_tvbox_defconfig

NEX_MDM_URL=https://<proyecto>.supabase.co \
NEX_MDM_ANON_KEY=<clave pública de Supabase> \
NEX_ADMIN_URL=https://<dominio-del-panel>/admin \
tools/nex-os/build.sh

./build.sh
```

Resultado: `output/firmware/update.img`, más `MiniLoaderAll.bin` para equipos en modo Maskrom.

- **Producción:** dejar `RK_NEX_MDM_HARDEN=y` (es el valor por defecto).
- **Unidad piloto:** generar además una imagen de desarrollo con `RK_NEX_MDM_HARDEN` desactivado (`./build.sh menuconfig`).
  Tiene ADB y consola, así que sirve para depurar.
- Anotar el SHA-256 de cada `update.img` que sale a producción. `flash-lote.sh` lo registra en el log de cada equipo.

## 3. Unidad piloto (una vez por modelo)

Antes de flashear un lote, con **un** equipo y la imagen de desarrollo:

- [ ] Arranca y muestra la pantalla de vinculación con el logo.
- [ ] Wi-Fi o Ethernet funcionan. El agente sincroniza: el equipo aparece en el panel tras vincularlo.
- [ ] El control remoto mueve el foco (flechas), abre apps (OK) y vuelve (atrás).
- [ ] Sale video y audio por HDMI.
- [ ] Netflix, YouTube y las demás apps habilitadas reproducen. Si Netflix no reproduce, falta Widevine:
      no venderlo para ese modelo.
- [ ] En el panel, pestaña **Equipos**: no aparece la alerta "⚠ filtro DNS caído / sin firewall".
- [ ] Bloquear desde el panel: en menos de 1 minuto el TV muestra la pantalla de bloqueo, el panel dice
      "✓ bloqueo confirmado" y llega el aviso por Telegram o email.
- [ ] Reflashear la imagen de producción y repetir la prueba de bloqueo.

## 4. Flasheo por lotes

### Poner un TV box en modo de flasheo

1. Equipo **apagado y sin fuente**.
2. Mantener apretado el botón de reset (dentro del conector AV, con el escarbadientes).
3. Conectar el cable USB A-A entre el PC y el puerto USB del TV box marcado como OTG. Si no está marcado,
   suele ser el USB 2.0 más cercano al conector de alimentación.
4. Soltar el botón a los 3 segundos. El PC detecta un dispositivo Rockchip en modo **Loader** o **Maskrom**.

Si el equipo no entra (algunos modelos no tienen botón): forzar Maskrom puenteando a masa el pin CLK del eMMC
mientras se conecta el USB. El punto suele estar marcado en la placa; lo hace un técnico.

### Opción A: Windows, varios equipos en paralelo (recomendado para lotes grandes)

1. Instalar `DriverAssitant` y descomprimir `FactoryTool_v1.91.zip`.
2. Abrir `FactoryTool.exe` → **Firmware** → elegir `update.img` → modo **Upgrade**.
3. Pulsar **Run**. Cada equipo que se conecta al hub en modo de flasheo se flashea solo y la grilla muestra su
   estado en verde o rojo.
4. Desconectar los equipos en verde y conectar los siguientes.

### Opción B: Linux, de a un equipo, con respaldo y registro

```sh
sudo tools/nex-os/taller/flash-lote.sh --backup output/firmware/update.img
```

- Muestra la información de la imagen y pide confirmar que es la del modelo del lote.
- Para cada equipo: espera a que se conecte, guarda el firmware original completo en `backups/` (con
  `--backup`), flashea NEX-OS y registra el resultado en `taller-<fecha>.csv`.
- Si el respaldo falla, **no flashea** ese equipo.
- `upgrade_tool` no permite elegir entre varios equipos sin intervención, así que el script exige que haya
  uno solo conectado.

**Respaldo:** el firmware original ocupa lo mismo que el almacenamiento del equipo (4–16 GB), así que hace falta
disco. Conviene respaldar al menos los equipos de un modelo nuevo y los de clientes que puedan querer volver a
Android. Para restaurar uno: `upgrade_tool WL 0 backups/original-….img` con el equipo en modo Loader.

## 5. Vincular y verificar cada equipo

1. Conectar el equipo a HDMI, red y alimentación. Arranca en la **pantalla de vinculación** con un QR y un código.
2. Escanear el QR con el celular, que ya tiene el panel abierto. El panel abre **Equipos → Vincular equipo** con el
   código cargado. Elegir la empresa del cliente, poner el nombre (ej. "Juan Pérez – Living") y **Vincular**.
   Sin QR: escribir el código a mano.
3. En la fila del equipo comprobar:
   - **● en línea**;
   - sin alertas "⚠" (modo cerrado, filtro DNS y firewall deben estar activos);
   - "Pagado hasta" cargado si el cliente tiene cobro mensual.
4. Prueba rápida: **Bloquear** → esperar "✓ bloqueo confirmado" → **Desbloquear**.

## 6. Etiquetar y entregar

- Etiqueta con el nombre que se le puso en el panel y los primeros 8 caracteres del ID (columna "Equipo").
- La fila del CSV del taller (fecha, resultado, SHA de la imagen) queda como registro de qué se instaló.
- Si un equipo se reflashea después (garantía, reparación), **vuelve solo a su empresa** y conserva el bloqueo y el
  "pagado hasta": el agente se identifica por el hardware (serie del SoC + eMMC). El panel avisa
  "Equipo reinstalado/reseteado".

## Problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El PC no detecta el equipo | Driver, cable o puerto USB equivocado | Reinstalar DriverAssitant, probar el otro USB del TV box, usar otro cable A-A |
| Detecta en Maskrom pero falla el flasheo | Memoria DDR no soportada por el loader | Revisar el tipo de RAM del relevamiento; probar con RKDevTool para ver el error |
| Flashea OK pero no da imagen | DTS equivocado para esa placa | Volver al relevamiento y armar el perfil del modelo (paso 1) |
| Pantalla "Iniciando el equipo…" fija | Sin red o agente sin configuración | Revisar la red; si persiste, la imagen se compiló sin `NEX_MDM_URL` |
| El control remoto no responde | Mapa de teclas IR distinto | Ajustar el DTS con el `original.dts` (paso 1) |
| "⚠ filtro DNS caído / sin firewall" en el panel | Kernel sin el fragmento `nex-mdm.config` | Recompilar con el perfil `rockchip_rk3328_nex_tvbox_defconfig` |
| "Imagen sin modo TV cerrado" | Se instaló la imagen de desarrollo | Reflashear con la de producción |
