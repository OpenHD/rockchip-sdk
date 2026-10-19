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

Resultado: `app/build/outputs/apk/release/app-release.apk` (prototipo: firmado con la clave de debug).

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

## Diferencias con la versión Linux

- **Filtro:** el WebView bloquea toda petición y navegación fuera de la lista blanca (más Supabase), y registra
  el dominio para el reporte anti-piratería. No hay dnsmasq ni iptables: el equipo informa `dns_filter: false`,
  `firewall: false` y `webview_filter: true`.
- **`hardened`** es `true` cuando la app es Device Owner. Si no lo es, el servidor recibe `image_not_hardened`.
- **`hardware_id`:** `sha256` de la serie de Android + el CID del eMMC si se puede leer.

## Pendiente (prototipo)

- Abrir apps Android de la lista blanca (Netflix, YouTube): hoy las apps del catálogo son web.
- Pantalla de Wi-Fi dentro de NEX-OS: en modo kiosko no se puede abrir la configuración de Android.
- Bloquear el reset de fábrica y ADB (se dejan abiertos para poder recuperar los equipos de prueba).
- Firma de release propia y actualización remota del APK.
