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
apps/nex-tv-android/build.sh
```

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

## Instalar en el equipo (taller)

Requiere ADB por red o USB y que el equipo **no tenga cuentas** (recién reseteado), si no Android rechaza el Device Owner.

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

- **Filtro:** el WebView bloquea toda petición y navegación fuera de la lista blanca (más Supabase), y registra
  el dominio para el reporte anti-piratería. No hay dnsmasq ni iptables: el equipo informa `dns_filter: false`,
  `firewall: false` y `webview_filter: true`.
- **`hardened`** es `true` cuando la app es Device Owner. Si no lo es, el servidor recibe `image_not_hardened`.
- **`hardware_id`:** `sha256` de la serie de Android + el CID del eMMC si se puede leer.

## Pendiente (prototipo)

- Pantalla de Wi-Fi dentro de NEX-OS: en modo kiosko no se puede abrir la configuración de Android.
- Bloquear el reset de fábrica y ADB (se dejan abiertos para poder recuperar los equipos de prueba).
- Firma de release propia y actualización remota del APK.
