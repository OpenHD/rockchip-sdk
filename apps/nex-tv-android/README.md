# NEX-OS para TV box Android

NEX-OS como pantalla de inicio de un TV box Android (probado para el ORYX TX6698, HiSilicon Hi3798MV310).
El usuario solo ve NEX-OS; Android queda por debajo, igual que Linux/Buildroot en las cajas Rockchip.

```text
Android -> APK NEX-OS (launcher + Device Owner) -> WebView -> NEX-OS (modo MDM)
```

| Pieza | Archivo | Equivale en Linux a |
|---|---|---|
| Agente (vinculación, sync, bloqueo, logo, eventos) | `Agent.kt` | `nex-agent` |
| Servidor de la UI y filtro de dominios | `UiServer.kt` | `busybox httpd` + políticas de Chromium + dnsmasq |
| Escritorio a pantalla completa | `MainActivity.kt` | Chromium `--kiosk` |
| Modo TV cerrado | `Kiosk.kt` | `zz-nex-hardening` |

La UI (`apps/nex-os/src/mdm/`) y el backend Supabase (`schema-mdm-v6..v8.sql`) son los mismos:
el agente publica `/agent/ui-state.json` con el mismo formato.

## Compilar

Requiere JDK 17+, Android SDK (`ANDROID_HOME`, por defecto `~/Library/Android/sdk`) y Node.js.

```sh
NEX_MDM_URL=https://<proyecto>.supabase.co \
NEX_MDM_ANON_KEY=<clave anon pública> \
NEX_ADMIN_URL=https://<panel>/admin \
NEX_TECH_PIN=<4 dígitos> \
apps/nex-tv-android/build.sh
```

- `NEX_TECH_PIN`: PIN del acceso técnico, obligatorio salvo con `NEX_DEMO=1` (el del código es solo para demo). Es el
  mismo en todos los equipos de ese APK y viaja dentro del APK: frena al usuario, no a quien desarme la app.
- `NEX_OS_SOURCE_DIR`: fuente de NEX-OS (por defecto `apps/nex-os`).
- `NEX_WEB_TARGET`: navegador objetivo de la web (por defecto `chrome69`, el WebView de Android 9 sin actualizar).

Resultado: `app/build/outputs/apk/release/app-release.apk`.

**Firma.** Para equipos de clientes, compilar siempre con la clave definitiva de NEX TV:

```sh
NEX_KEYSTORE=/ruta/nex-tv-release.jks NEX_KEYSTORE_PASSWORD=… apps/nex-tv-android/build.sh
```

Android solo acepta actualizaciones firmadas con la misma clave, y el QR de alta fija su huella: si se pierde
la clave, los equipos instalados no se pueden volver a actualizar. Sin `NEX_KEYSTORE` el APK se firma con la
clave de debug de la máquina, que sirve solo para pruebas.

## Actualizaciones

- `NEX_BUILD`: entero positivo sin ceros iniciales (por defecto `1`); es el `versionCode` de Android.
  Cada release debe aumentarlo.
- `NEX_VERSION`: versión visible (por defecto `0.1.0`).
- `NEX_RELEASE_PUB`: ruta a la clave pública RSA SPKI PEM de releases. Para rotación se pueden indicar
  varias rutas separadas por espacios (las rutas no deben contener espacios). Sin claves, la actualización
  remota queda desactivada.

Firmar el APK con `tools/nex-os/release/sign-release.sh` (también funciona para un APK) y publicarlo desde
la página Firmware del panel con plataforma `android`, usando el mismo build que al compilar.
El agente verifica la firma de release, el tamaño y SHA-256 antes de instalar, incluso sin vincular o bloqueado.
Android también rechaza actualizaciones que no estén firmadas con el keystore de NEX TV instalado.
Como Device Owner instala sin interacción; si Android pide confirmación, se registra el fallo sin abrirla.

## Instalar en el equipo (taller)

`install-box.sh` hace todo en un paso: instala el APK, deja NEX como pantalla de inicio, desactiva el adware de fábrica
conocido, fija la zona horaria, activa la protección (`Guard`), hace a NEX dueño del equipo si el firmware lo permite,
verifica todo y al final apaga el ADB. Si alguna verificación falla, el ADB queda abierto para corregir.

```sh
apps/nex-tv-android/install-box.sh <ip-del-equipo>:<puerto> --apk nex-tv.apk
```

`--dry-run` muestra qué haría sin tocar el equipo. `--keep-adb` deja el ADB abierto (pruebas en el taller).

**Firmwares sin Device Owner.** Algunos boxes no declaran `android.software.device_admin` (por ejemplo el TX6698 con
Hi3798MV300H) y `dpm set-device-owner` falla siempre. Ahí protege `Guard`, un servicio de accesibilidad que vuelve al
inicio si se abre una app no permitida (Ajustes de Android, otro launcher) y, con el equipo bloqueado o sin vincular,
solo deja NEX. Es más débil que el kiosko: no evita el reset con el botón físico y NEX no se actualiza solo, porque
Android pide confirmar cada instalación. Para volver a entrar con el ADB apagado: PIN técnico → "Abrir Ajustes de
Android (10 min)" → Preferencias del dispositivo → Información → 7 veces OK en Compilación (la primera vez: las
Opciones de desarrollador vienen ocultas) → atrás → Opciones de desarrollador → Depuración USB. Probado en el TX6698:
el ADB vuelve a responder en el puerto 3222 a los segundos.

**NEX como app de sistema (firmwares de prueba).** Si el firmware es `userdebug` y trae `su`, `install-system.sh`
copia NEX a `/system/priv-app` antes de `install-box.sh`. Así sobrevive a un reset de fábrica (que solo borra los
datos), se actualiza sola sin pedir confirmación (`INSTALL_PACKAGES`) y al arrancar `Heal` vuelve a proteger el
equipo: desactiva el adware y el launcher de fábrica, activa `Guard` y fija la zona horaria. Después de un reset
vuelve a la pantalla de vinculación: hasta que la empresa lo vincule, solo se puede usar NEX. `--device-admin` además
declara `android.software.device_admin`. Escribe en la partición del sistema: tener a mano el firmware original.

```sh
apps/nex-tv-android/install-system.sh <ip-del-equipo>:<puerto> --apk nex-tv.apk
```

**A mano, con Device Owner.** Requiere ADB por red o USB y que el equipo **no tenga cuentas** (recién reseteado), si
no Android rechaza el Device Owner.

```sh
adb connect <ip-del-equipo>:5555
adb install -r app-release.apk
adb shell dpm set-device-owner --user 0 os.nex.tv/.AdminReceiver
# Sin esto Android tapa NEX-OS con el aviso "Viewing full screen" y le roba el foco al control.
adb shell settings put secure immersive_mode_confirmations confirmed
adb shell am start -n os.nex.tv/.MainActivity
```

Al ser Device Owner, NEX-OS queda fijo como pantalla de inicio, en modo kiosko (sin Home, recientes ni barra
de estado) y Android no deja instalar APKs de orígenes desconocidos (MagisTV y similares).

En Android 14+ el `--user 0` es obligatorio (sin él responde "already some accounts" aunque no haya cuentas).

### Sin ADB

- **Root:** si el box trae root, NEX TV muestra "Activar NEX (técnico)" en la pantalla de inicio o de vinculación.
  Con el PIN de técnico corre el mismo `dpm set-device-owner` con `su` (`Provision.kt`). Requiere que no haya cuentas.
- **QR:** en un box reseteado, tocar 6 veces la pantalla de bienvenida y escanear el QR que genera
  `generar-qr.sh <URL https del APK>` (fuera del repo, junto a las claves). Solo funciona si el box trae el asistente de
  configuración de Google. Android descarga el APK, verifica la huella del certificado y llama a `AdminReceiver`
  (Android 10+ además usa `ProvisioningActivity`). El aviso "Viewing full screen" puede aparecer una vez: aceptarlo.
- **Firmware:** el proveedor integra el APK como app de sistema y corre `dpm set-device-owner` en el primer arranque.

Salida de emergencia (solo desde ADB):

```sh
adb shell am broadcast -a os.nex.tv.RELEASE -n os.nex.tv/.ReleaseReceiver
```

## Play Store y apps Android

- La Play Store es libre para el usuario: aparece como mosaico y lo que instala aparece solo en el escritorio
  (`AndroidApps.kt`). Chrome también aparece si está preinstalado y navega sin el filtro de dominios de NEX.
  Las demás apps de sistema (Configuración, explorador de archivos) no se muestran.
- Los mosaicos viajan en `ui-state.json` como apps `web` con `launch_url` `https://appassets.androidplatform.net/android/<paquete>`;
  `UiServer` convierte esa navegación en "abrir la app". La UI web no cambia.
- El modo kiosko solo deja correr NEX-OS, la Play Store, Chrome, los servicios de Google y las apps del usuario. El botón Home
  vuelve a NEX-OS.
- Al bloquearse el equipo la lista queda solo en NEX-OS: Android cierra la app abierta y no deja abrir otra.
- Los APK sueltos siguen bloqueados (`DISALLOW_INSTALL_UNKNOWN_SOURCES`).

## Diferencias con la versión Linux

- **Inicio:** muestra solo las apps Android (Play Store y las instaladas, con su ícono) y Ajustes. Las apps web del
  catálogo de la empresa no aparecen: el WebView no tiene Widevine y no reproduce Netflix, Disney+, Prime Video ni
  Spotify. Para ofrecer un servicio en el box, se instala su app Android.
- **Filtro:** el WebView bloquea toda petición y navegación fuera de la lista blanca (más Supabase), y registra
  el dominio para el reporte anti-piratería. No hay dnsmasq ni iptables: el equipo informa `dns_filter: false`,
  `firewall: false` y `webview_filter: true`.
- **`hardened`** es `true` cuando la app es Device Owner. Si no lo es, el servidor recibe `image_not_hardened`.
- **`hardware_id`:** `sha256` de la serie de Android + el CID del eMMC si se puede leer.

## Pendiente (prototipo)

- Pantalla de Wi-Fi dentro de NEX-OS: en modo kiosko no se puede abrir la configuración de Android.
- Bloquear el reset de fábrica y ADB (se dejan abiertos para poder recuperar los equipos de prueba).
