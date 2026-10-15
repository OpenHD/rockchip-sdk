# Gestión remota de TV box (MDM NEX-OS)

Especificación acordada para tres funciones:

1. Bloqueo a distancia.
2. Lista blanca de apps y servicios, más detección de apps piratas.
3. Logo de la empresa configurable a distancia.

Estado: **v1 implementada** (fases 1–4 y 6, parte de 5 y 7). Ver "Implementación v1" al final.

## Decisiones

| Tema | Decisión |
|---|---|
| Quién administra | Multi-empresa: NEX es super-admin; cada empresa ve solo sus equipos, su logo y sus apps |
| Backend | Supabase (tablas + Realtime + Storage) y un panel web de administración |
| Alta de equipo | Al primer arranque el equipo muestra un código/QR; la empresa lo ingresa en su panel. Una sola imagen de firmware para todos |
| Bloqueo | Escalonado: `activo → aviso → restringido → bloqueado` (ver "Estados del equipo"). La pantalla de bloqueo lleva el logo, un mensaje configurable y cómo pagar. Reversible a distancia |
| Quién decide bloquear | La empresa (el ISP), desde el panel o desde su sistema de cobranza por API. NEX no calcula deudas |
| Responsabilidad legal | Es del ISP: el contrato con su cliente debe informar el bloqueo por falta de pago. NEX solo da la herramienta |
| Desbloqueo sin internet | Código corto de un solo uso que soporte del ISP le dicta al cliente (ver "Código de desbloqueo offline") |
| Sin conexión | Mantiene el último estado; si pasa N días sin contactar al servidor, se bloquea solo. N lo configura cada empresa (por defecto 7) |
| Apps | **Lista blanca**: solo se abre lo que la empresa activó (ej. Netflix). Todo lo demás queda bloqueado |
| Anti-piratería | Los equipos reportan los intentos bloqueados; NEX los revisa y clasifica en una DB central |
| Telemetría | Solo intentos bloqueados: dominio + ID de equipo + fecha. Nunca la URL completa ni el historial |
| Blindaje | Modo TV cerrado en equipos vinculados (ver más abajo) |
| Logo | Imagen que sube la empresa al panel; aparece en el arranque de NEX-OS, el escritorio y la pantalla de bloqueo |

## Contexto técnico

- El TV box corre **Linux/Buildroot, no Android**, así que no puede instalar APK (MagisTV y similares).
  El riesgo real es que se llegue a sitios o servicios piratas desde el navegador.
- NEX-OS es una app web que corre en Chromium en modo kiosk (`device/rockchip/common/overlays/rootfs/nex-os/S99nex-os`).
  El control se aplica en dos capas:
  - **UI**: el registro de apps (`src/constants/apps.tsx`) se filtra con la lista de la empresa.
  - **Chromium**: las políticas administradas (`/etc/chromium/policies/managed/*.json`, con `URLAllowlist` y `URLBlocklist`)
    bloquean la navegación aunque se salte la UI.
- La app web no puede escribir archivos del sistema. Por eso hace falta un **agente local** (`nex-agent`).

## Arquitectura

```text
Panel web (empresa / super-admin)
        │
     Supabase ── Realtime (cambios inmediatos) + Storage (logos)
        │
  nex-agent (daemon en el TV box, init script)
   ├─ token del equipo, sincronización y polling de respaldo
   ├─ estado cacheado en /var/lib/nex-agent/state.json (último estado + last_seen)
   ├─ escribe las políticas de Chromium y reinicia Chromium si cambian
   ├─ descarga el logo a /var/lib/nex-agent/branding/
   ├─ envía los intentos bloqueados (por lotes)
   └─ API local en 127.0.0.1 (solo lectura para la UI)
        │
  NEX-OS (Chromium kiosk)
   ├─ pantalla de vinculación (código/QR)
   ├─ pantalla de bloqueo
   ├─ menú filtrado por la lista blanca
   └─ logo dinámico (reemplaza el texto `.nex-logo`)
```

El agente es la fuente de verdad en el equipo. La UI solo muestra lo que el agente le informa.
El auto-bloqueo por días sin conexión también lo evalúa el agente.

## Modelo de datos (Supabase)

- `companies`: id, nombre, `offline_lock_days` (por defecto 7), `lock_message`, `logo_path`.
- `company_members`: user_id, company_id, rol (`owner` / `admin`). El super-admin NEX es un rol global.
- `companies` (además): `payment_info` (texto), `payment_url` (se muestra como QR), `support_phone`.
- `devices`: id, company_id, nombre, `state` (`activo` / `aviso` / `restringido` / `bloqueado`), `state_reason`,
  `last_seen_at`, versión de firmware, `token_hash`, `hardware_id` (serie del SoC), `unlock_secret` (cifrado).
- `device_state_log`: device_id, estado anterior y nuevo, quién lo cambió (usuario o API), fecha. Sirve como respaldo
  ante reclamos del cliente final.
- `company_api_keys`: company_id, `key_hash`, nombre, creada, revocada. Para la integración con la cobranza del ISP.
- `pairing_codes`: código corto, device_id, vencimiento (ej. 15 min), usado (bool).
- `app_catalog` (global, lo mantiene NEX): id, nombre, icono, tipo (`web` / `interna`), URL de inicio y dominios necesarios
  (ej. Netflix: `netflix.com`, `nflxvideo.net`, `nflximg.net`...).
- `company_apps`: company_id, app_id, activa (bool).
- `blocked_attempts`: device_id, dominio, fecha. Retención limitada (ej. 90 días).
- `domain_classifications` (global): dominio, estado (`pendiente` / `pirateria` / `legitimo`), nota, revisado_por.

Con RLS:

- Un usuario de empresa solo ve las filas de su `company_id`.
- Un equipo, con su token, solo lee su propia fila, su empresa y sus apps activas, y solo puede insertar `blocked_attempts`.
- El token del equipo **no** es la clave anónima de Supabase: se emite al vincular (Edge Function) y se guarda hasheado.

## Flujos

**Vinculación.** El equipo arranca sin token. El agente pide un código a una Edge Function y NEX-OS lo muestra
como texto y QR. La empresa lo ingresa en el panel, el equipo recibe su token y aplica la configuración.

**Bloqueo.** La empresa pulsa "Bloquear" (o su sistema de cobranza llama a la API) y cambia `devices.state`. El agente lo recibe por Realtime (o por polling cada
pocos minutos como respaldo). Entonces guarda el estado, aplica una política de Chromium que bloquea todo y
NEX-OS muestra la pantalla de bloqueo. El desbloqueo hace el camino inverso.

**Sin conexión.** Si `ahora − last_seen > offline_lock_days`, el agente bloquea con el motivo "sin conexión".
Al volver la conexión se aplica el estado real del servidor.

**Integración con la cobranza del ISP.** Edge Function `set-device-state` autenticada con una API key de la empresa:
recibe `device_id` (o `hardware_id`) y el estado nuevo. El sistema de facturación del ISP la llama cuando hay
atraso y cuando registra el pago, así el desbloqueo es inmediato sin que nadie entre al panel.

**Lista blanca.** La política se arma con los dominios de las apps activas, los dominios propios de NEX
(Supabase, CDN del logo) y `127.0.0.1`. `URLBlocklist: ["*"]` bloquea todo lo demás.

**Reporte y revisión.** Cada navegación bloqueada se registra como dominio y se envía en lotes. En el panel del
super-admin aparecen los dominios más intentados y en cuántos equipos. NEX los marca como piratería o legítimo:

- Un dominio legítimo puede agregarse a una app del catálogo.
- Un dominio de piratería queda en lista negra global, como red de seguridad incluso dentro de apps permitidas.

## Estados del equipo (bloqueo por falta de pago)

Mismo patrón que los celulares financiados (Samsung Knox Guard, Google Device Lock Controller, PayJoy):
primero avisar, después restringir y recién al final bloquear.

| Estado | Qué ve el usuario | Qué funciona |
|---|---|---|
| `activo` | Normal | Todo lo de la lista blanca |
| `aviso` | Banner fijo que no se puede cerrar ("Tu servicio tiene un pago pendiente") + datos de pago | Todo |
| `restringido` | Las apps de streaming aparecen bloqueadas con el mensaje de pago | Menú, pantalla de pago, Configuración básica (red) |
| `bloqueado` | Pantalla completa con logo, mensaje, QR de pago y teléfono de soporte | Solo esa pantalla y la Configuración de red, para que pueda volver a conectarse |

- El ISP elige los pasos y los tiempos (ej. aviso el día 1, restringido el día 5, bloqueado el día 10), ya sea desde
  el panel o desde su sistema de cobranza. NEX no programa los plazos.
- La red nunca se bloquea: el equipo necesita conexión para enterarse del pago y desbloquearse.
- Cada cambio queda en `device_state_log`.

## Código de desbloqueo offline

Para cuando el cliente pagó pero el equipo no tiene internet o no se sincroniza.

- Al vincular, el servidor genera un `unlock_secret` por equipo y se lo entrega al agente junto con el token.
- Código = `HMAC-SHA256(unlock_secret, device_id + fecha)` truncado a 8 dígitos. Vale solo ese día y ese equipo.
- El panel muestra el código del día. Soporte se lo dicta al cliente y este lo ingresa en la pantalla de bloqueo.
- El agente lo valida sin red y pasa a `activo` por un tiempo limitado (ej. 72 h). Al reconectar manda el estado
  del servidor. Si el código se ingresa mal 5 veces, se espera unos minutos antes de permitir otro intento.
- El agente guarda los códigos usados para que no se puedan repetir.

## Modo TV cerrado (equipos vinculados)

- Se ocultan de la UI: Google Chrome libre, NEX Code, Hermes, la terminal y los ajustes sensibles de Configuración.
- Políticas de Chromium: sin DevTools, sin barra de URL ni pestañas nuevas, sin extensiones, sin descargas y sin `file://`.
- Firmware: ADB y la consola serie deshabilitados en las builds de producción, y sin login root por consola.
- `RK_NEX_OS=0` deja de ser una vía para salir del kiosk en producción.
- **Límite conocido:** quien tenga el equipo físicamente siempre puede reflashearlo por USB (Maskrom).
  Para evitarlo hace falta Secure Boot de Rockchip (ver "Anti-manipulación").

## Anti-manipulación

En los celulares, el bloqueo funciona porque sobrevive a un reset y no se puede quitar reflasheando.
Para lograr lo mismo en el TV box:

1. **Re-enrolamiento automático (sin cambiar hardware).** El agente lee el ID único del SoC (OTP/eFuse de Rockchip)
   y lo manda en el primer arranque. Si ese `hardware_id` ya pertenece a una empresa, el equipo se vuelve a vincular
   solo y recupera su estado, incluido `bloqueado`. Así un reset o un reflasheo con la imagen oficial de NEX no sirve
   para quitar el bloqueo.
2. **Rootfs de solo lectura verificado (dm-verity).** Impide borrar o modificar `nex-agent`, las políticas de
   Chromium y el estado sin romper el arranque. El estado editable (`/var/lib/nex-agent`) se firma con HMAC.
3. **Secure Boot de Rockchip.** Se graban en los eFuses las claves de NEX y el equipo solo arranca firmware firmado
   por NEX. Es lo único que impide instalar una imagen ajena por Maskrom. **Es irreversible**: hay que probarlo
   primero en pocas unidades y guardar las claves de firma con mucho cuidado (si se pierden, no se puede actualizar
   el firmware).

## Riesgos y pendientes

- **DRM:** Netflix, Disney+, Prime y otros necesitan Widevine. Chromium en Linux ARM no lo trae
  (`buildroot/package/chromium-wayland` no incluye Widevine). Hay que probar en el equipo real antes de prometer
  estos servicios. Si no funciona, o queda en baja resolución, hay que evaluar otro camino (por ejemplo Android TV).
- **Dominios de servicios:** Netflix y otros usan CDNs que cambian. El catálogo necesita mantenimiento, y los reportes
  de bloqueos ayudan a detectar dominios legítimos que faltan.
- **Privacidad:** avisar al usuario final que se registran los intentos bloqueados (dominio, sin URL completa).
- **Logo de arranque del bootloader/kernel:** fuera de alcance. Solo se cambia el logo dentro de NEX-OS.

## Fases sugeridas

1. Esquema Supabase + RLS + Edge Functions de vinculación y token.
2. `nex-agent` (sincronización, estado offline, políticas de Chromium) + overlay de rootfs.
3. NEX-OS: pantallas de vinculación y de bloqueo, menú filtrado, logo dinámico, modo TV cerrado.
4. Panel web: empresas, equipos (bloquear/desbloquear), apps, logo y mensaje.
5. Estados escalonados, pantalla de pago, API de cobranza para el ISP y código de desbloqueo offline.
6. Reportes de bloqueos + panel de revisión anti-piratería.
7. Endurecimiento del firmware (ADB, consola), re-enrolamiento por `hardware_id` y prueba de Widevine.
8. dm-verity y Secure Boot de Rockchip (primero en un lote piloto).

## Implementación v1

### Qué hay y dónde

| Pieza | Archivo |
|---|---|
| Esquema, RLS, RPC, Storage y catálogo inicial | `supabase/schema-mdm-v6.sql` |
| Agente del equipo | `device/rockchip/common/overlays/rootfs/nex-os/nex-agent` |
| Instalación en el rootfs, políticas de Chromium y kiosk que se relanza solo | `device/rockchip/common/overlays/rootfs/nex-os/` |
| Modo TV cerrado (endurecimiento) | `device/rockchip/common/overlays/rootfs/zz-nex-hardening/install.sh` |
| Opciones `RK_NEX_MDM` y `RK_NEX_MDM_HARDEN` (ambas activadas por defecto) | `device/rockchip/common/configs/post/Config.in.nex-os` |
| Paquetes (jq, curl, dnsmasq, iptables, chrony, CA) | `buildroot/configs/rockchip/network/nex-mdm.config` |
| Kernel: iptables `filter` + match `owner` | `kernel/arch/arm64/configs/nex-mdm.config` |
| UI del TV (espera, vinculación, bloqueo, home con apps) | `src/mdm/` |
| Panel web (`/admin`) | `src/admin/`, `admin.html` |

### Diferencias con el diseño de arriba

- **Sin Edge Functions.** El equipo genera su token de 256 bits y llama a RPC `security definer`
  (`mdm_device_register`, `mdm_device_sync`, `mdm_device_report`) con la anon key. El servidor guarda solo
  `sha256(token)`. El token viaja en el cuerpo HTTPS, nunca en argumentos de procesos.
- **Polling cada 60 s, sin Realtime** (cada 10 s mientras espera vinculación). Un bloqueo tarda como máximo ~1 minuto.
- **Bloqueo por pago con fecha (`paid_until`), no por estados escalonados.** La empresa registra "pagado hasta" en el
  panel. Cuando vence (más los días de gracia), el equipo se bloquea solo, **aunque no tenga internet**: el servidor le
  envía el momento exacto de bloqueo (`lock_at`).
  - N días antes del vencimiento aparece un aviso fijo en el home.
  - Atrasar el reloj no sirve: la hora nunca se toma menor a la última hora del servidor, y si el reloj vuelve
    hacia atrás el equipo se bloquea.
  - Esto no cumple del todo la regla "NEX no programa los plazos": el plazo lo fija el ISP, pero el equipo lo aplica.
    **Decisión pendiente** (ver más abajo).
- **Prioridad de bloqueo:** manual > pago vencido > reloj inválido > días sin conexión.
- **MFA obligatorio.** Todas las RPC de administración exigen sesión `aal2` (TOTP); los usuarios anónimos nunca son admin.
- **Filtrado en tres capas:**
  1. la UI solo muestra las apps habilitadas (y nunca terminal, navegador libre, NEX Code ni ajustes);
  2. Chromium bloquea todo salvo la lista blanca, y los dominios marcados como piratería ganan aunque estén dentro
     de uno permitido;
  3. un dnsmasq local (`127.0.0.1`) resuelve a `0.0.0.0` todo lo no permitido. iptables impide usar otro DNS
     o DNS-over-TLS, y Chromium tiene DoH desactivado. El log de dnsmasq alimenta el reporte anti-piratería.
- **Falla cerrado:**
  - la imagen trae una política de Chromium que solo permite la UI local;
  - la UI muestra "Iniciando…" si no encuentra el estado del agente;
  - el build falla si falta `nex-agent.conf`.

### Cómo nos informa el sistema (v7, `supabase/schema-mdm-v7.sql`)

**Estado real.** En cada sync (cada 60 s) el equipo informa:
- el modo que realmente aplicó (activo o bloqueado, con el motivo);
- si el modo TV cerrado, el filtro DNS y el firewall están activos;
- uptime, espacio libre y versión del agente.

El panel compara ese estado con lo pedido. Muestra "⏳ pendiente de aplicar" hasta que el equipo confirma, y
después "✓ bloqueo confirmado".

**Eventos.** El agente guarda una cola en disco, que se conserva sin internet y se envía en el siguiente sync.

| Evento | Origen | Gravedad |
|---|---|---|
| Bloqueo / desbloqueo aplicado | Equipo | Información |
| Reloj atrasado, política de navegación modificada, imagen sin modo cerrado | Equipo | Crítico |
| Agente reiniciado sin reinicio del equipo, filtro DNS caído, firewall no disponible | Equipo | Aviso |
| Equipo reinstalado o reseteado (re-vinculado solo por hardware) | Servidor | Crítico |
| Sin conexión (N horas, una vez por corte) / de vuelta en línea | Servidor | Aviso |
| Intento de abrir un sitio pirata conocido (uno por equipo, dominio y día) | Servidor | Aviso |

- El servidor solo acepta del equipo los tipos de la lista. "Reinstalado", "sin conexión" y "piratería" los
  genera él mismo: un equipo no puede inventarlos ni ocultarlos.
- **Re-enrolamiento:** el equipo manda un `hardware_id`, que es `sha256` de la serie del SoC + el CID del eMMC.
  Si un token nuevo llega con un hardware que ya pertenece a una empresa, el servidor le pasa la fila existente:
  conserva bloqueo, pagos y nombre, y revoca el token viejo.
  - Límite: 10 re-enrolamientos por día y por hardware.
  - Riesgo aceptado: quien conozca la serie y el CID de otro equipo podría desplazar su token. Eso dispara la
    alerta crítica y el equipo legítimo lo recupera en su siguiente sync.

**Avisos.**
- **Panel:** pestaña **Estado** con contadores (en línea, bloqueados confirmados, cambios sin aplicar,
  problemas de seguridad) y la actividad de 7 días.
- **Telegram y email:** cada empresa los configura en **Avisos**, elige qué categorías recibe y puede mandar
  un aviso de prueba.
- **Resumen diario** de intentos de piratería.
- Los avisos pasan por una cola (`mdm_notifications`) que procesa la Edge Function `supabase/functions/mdm-notify`:
  reintenta 5 veces y no manda duplicados aunque dos ejecuciones se superpongan. El texto es plano, sin HTML,
  para que el nombre de un equipo no pueda inyectar contenido.

**Activar los avisos:**

```sh
supabase secrets set MDM_CRON_SECRET=$(openssl rand -hex 32) \
  TELEGRAM_BOT_TOKEN=<token de @BotFather> TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32) \
  RESEND_API_KEY=<clave de resend.com> MDM_EMAIL_FROM="NEX MDM <avisos@tu-dominio.com>"
supabase functions deploy mdm-notify --no-verify-jwt
# Webhook del bot (para que responda /id con el ID del chat):
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d url="https://<proyecto>.supabase.co/functions/v1/mdm-notify?job=telegram" \
  -d secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Después, programar `?job=tick` cada minuto y `?job=digest` una vez por día con el bloque `cron.schedule` que está
al final de `schema-mdm-v7.sql` (requiere las extensiones `pg_cron` y `pg_net`).

### Puesta en marcha

1. **Supabase**
   - Ejecutar `supabase/schema-mdm-v6.sql` y después `supabase/schema-mdm-v7.sql`.
   - Activar MFA TOTP en *Authentication → Multi-Factor*.
   - Crear la cuenta de NEX y agregarla a `mdm_super_admins` (instrucción al final del script).
2. **Firmware**
   - Agregar `nex-mdm.config` a `RK_KERNEL_CFG_FRAGMENTS`.
   - Compilar con `NEX_MDM_URL=https://<proyecto>.supabase.co NEX_MDM_ANON_KEY=<clave pública> tools/nex-os/build.sh`
     y después `./build.sh`.
   - Para imágenes de desarrollo, desactivar `RK_NEX_MDM_HARDEN`. Una imagen endurecida solo se recupera
     reflasheando.
3. **Panel**
   - Desplegar la app (Vercel) y entrar a `/admin`. Cabeceras: CSP estricta, `frame-ancestors 'none'`, `no-store`.
4. **Instalación en los equipos:** ver [INSTALACION_TALLER.md](INSTALACION_TALLER.md).

### Verificado

- **SQL** (Postgres 16 local con stubs de `auth`/`storage`): 25 pruebas de flujo y de ataque.
  - El script se puede correr dos veces.
  - Permisos: anon sin acceso a tablas; sin MFA o con sesión anónima no hay permisos; otra empresa no puede
    reclamar equipos; `token_hash` es ilegible.
  - Código de un solo uso, con rate limit de 10 intentos por hora.
  - Pago vencido.
  - Reporte con dominios basura (filtrados y con tope).
  - Storage: no se puede subir logo a la carpeta de otra empresa.
  - Desvincular revoca el token.
- **Agente** (simulado con un servidor falso): 13 escenarios.
  - Vinculación, apps, pago por vencer y vencido, vencimiento sin internet, reloj atrasado, días offline,
    bloqueo manual.
  - Seguridad: logo SVG rechazado, `lock_at` corrupto bloquea, inyección en la configuración de dnsmasq filtrada,
    token ausente de `ui-state.json`.
- **Web:** `tsc` y ESLint sin errores en el código nuevo; `vite build` en modo MDM.

### No verificado todavía

- No se probó en un TV box real (dnsmasq, iptables, recarga de políticas de Chromium, init).
- No se probó contra un Supabase real (en particular MFA y Storage).
- No se probó Widevine.

### Pendiente del diseño

Actualizado en v8 (ver las secciones v8 más abajo): la pantalla de Wi-Fi, el código de desbloqueo offline, la API
para el ISP, la configuración firmada (en lugar de la "firma HMAC del estado local") y el re-enrolamiento por
`hardware_id` ya están hechos. Queda:

- Estados `aviso`/`restringido`, `device_state_log`, QR y teléfono de pago.
- **Arranque cerrado:** U-Boot sin consola ni modos de descarga por tecla, recovery sin ADB ni consola serie,
  dm-verity y Secure Boot (AVB + eFuse en RK3328). Sin esto, quien reflashea el equipo por USB lo libera.


## v8: configuración firmada, API para ISP y actualizaciones (servidor)

Archivos: `supabase/schema-mdm-v8.sql`, `supabase/functions/mdm-sync`, `supabase/functions/isp-api`,
`tools/nex-os/keys/gen-mdm-sign-key.sh`, `tools/nex-os/keys/gen-release-key.sh`, `tools/nex-os/release/sign-release.sh`.

### Qué cambia

- **Configuración firmada.** El equipo ya no llama a `rpc/mdm_device_sync` directo sino a la Edge Function
  `mdm-sync`. Esta llama al RPC con la anon key del equipo y, si está vinculado, devuelve
  `{"status":"paired","payload":"<JSON>","sig":"<base64>"}`. `sig` es RS256 (RSA-3072) sobre los bytes exactos de
  `payload`. El equipo lo verifica con `/etc/nex-agent/mdm-sign.pub.pem` y descarta lo que no verifique.
  El `payload` se escapa a ASCII puro (`\uXXXX`), así el shell del equipo no depende del manejo de UTF-8.
- **Campos nuevos del sync:** `hardware_id`, que se completa si faltaba; `unlock_secret`; `external_ref`;
  `attestation_eligible`; `update`; y `pass_attestation` en cada app.
- **`unlock_secret`.** Es por equipo y se genera al crear el equipo. A los equipos existentes se les genera al
  aplicar v8. Se renueva si cambia el token (re-enrolamiento por hardware). Ningún admin lo puede leer: solo lo
  recibe el equipo. El script falla si algún grant lo deja legible.
- **Código de desbloqueo offline:** `HMAC-SHA256(unlock_secret, "<device_id>:<YYYYMMDD UTC>")`. Se toman los primeros
  8 hex, se pasan a entero y se aplica `mod 1e8`, con ceros a la izquierda.
  - Desde el panel se pide con `mdm_unlock_code(p_device)`, y desde la API con `/unlock-code`.
  - El equipo acepta el código de hoy y el de ayer y desbloquea 72 h.
  - Queda auditado sin el código. Límite: 30 por hora por usuario y 60 por hora por clave de API.
- **Atestación.** Es un JWT RS256 firmado con la misma clave MDM. Solo se emite si el equipo no está bloqueado y no
  tiene el pago vencido.
  - Claims: `iss: "nex-mdm"`, `aud: "nex-services"`, `sub` (equipo), `cid` (empresa), `ref` (`external_ref`),
    `st: "active"`. Dura 6 h.
  - Las apps del catálogo con `pass_attestation` lo reciben en `#nex_attestation=<jwt>`. Lo activa NEX con
    `mdm_set_catalog_attestation`.
- **OTA.** NEX publica releases con `mdm_publish_release` y elige un target global o por empresa con
  `mdm_set_firmware_target`. La empresa con target propio no usa el global, y `p_release = null` borra el target.
  - El sync ofrece `update` solo si el build del target es mayor que el `build` que informa el equipo (sin `build`
    cuenta como 0).
  - La firma del release (`nex-update:v1:<build>:<sha256>`) se hace offline con la clave de releases, que es otra.
    El servidor solo la guarda.
  - La URL y la versión aceptan un charset acotado porque el agente es shell.
- **Claves de API del ISP.** Las crea el owner desde el panel con `mdm_create_api_key`, y la clave se muestra una sola
  vez. Se revocan con `mdm_revoke_api_key`.
  - En la base solo queda `sha256(clave)`: `key_hash` no es legible.
  - Cada acción queda en la auditoría con `actor_label = 'api:<nombre>'`.
  - Hay un máximo de 10 claves activas por empresa y un rate limit de 120 pedidos por minuto por clave.

### Despliegue

```sh
# 1. Base: después de v6 y v7
#    Ejecutar supabase/schema-mdm-v8.sql en el SQL Editor (es idempotente).

# 2. Clave MDM (una sola vez; no pisa claves existentes)
tools/nex-os/keys/gen-mdm-sign-key.sh ~/nex-keys/mdm
supabase secrets set NEX_SIGNING_KEY="$(cat ~/nex-keys/mdm/mdm-sign.key.pem)"

# 3. Funciones
supabase functions deploy mdm-sync                    # con verificación de JWT: el equipo manda la anon key
supabase functions deploy isp-api --no-verify-jwt     # se autentica con la clave nexk_ del ISP
```

- `mdm-sign.pub.pem` va al firmware como `/etc/nex-agent/mdm-sign.pub.pem`.
- La privada se guarda fuera del repo, con backup offline.
- Si el proyecto usa las claves nuevas (`sb_publishable_...`, que no son JWT), `mdm-sync` también se despliega con
  `--no-verify-jwt`. El RPC sigue autenticando al equipo por su token.
- **Rotar la clave MDM** obliga a actualizar la pública en los equipos antes de cambiar el secreto. Si no, rechazan la
  configuración y siguen con la última válida.

### API para ISP

Base: `https://<proyecto>.supabase.co/functions/v1/isp-api`.
- **Autenticación:** `Authorization: Bearer nexk_...`.
- **`<id>`:** el uuid del equipo o `ref:<external_ref>`.
- **Respuestas:** JSON. Los errores vienen como `{"error": "..."}`.
- **Códigos HTTP:** 400 dato inválido, 401 clave inválida o revocada, 404 equipo inexistente o de otra empresa,
  409 referencia ya usada, 413 body grande, 415 sin `Content-Type: application/json`, 429 rate limit (con `Retry-After`).
- No hay CORS: es una API de servidor a servidor.

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /jwks` (sin auth) | — | `{"keys":[{kty,n,e,alg:"RS256",use:"sig",kid}]}` |
| `GET /devices?limit=50&offset=0&ref=` | — | `{"devices":[equipo…],"limit","offset"}` (limit 1–200) |
| `GET /devices/<id>` | — | equipo |
| `POST /devices/<id>/lock` | `{"reason"?: "…"}` (≤ 280) | equipo |
| `POST /devices/<id>/unlock` | — | equipo |
| `POST /devices/<id>/paid-until` | `{"paid_until": "YYYY-MM-DD" \| null}` | equipo (queda en `mdm_payments`) |
| `POST /devices/<id>/external-ref` | `{"external_ref": "…" \| null}` | equipo |
| `POST /devices/<id>/unlock-code` | — | `{"code":"12345678","valid_on":"YYYY-MM-DD","hours":72}` |

- **Equipo:** `{id, name, external_ref, locked, lock_reason, paid_until, online, last_seen_at, reported_mode,
  reported_lock_kind, firmware_version}`. `online` significa que sincronizó en los últimos 5 minutos.
- **`external_ref`:** de 1 a 64 caracteres (`A-Z a-z 0-9 . _ : @ -`), único por empresa.
- Los campos que no están en la tabla se rechazan.

```sh
API=https://<proyecto>.supabase.co/functions/v1/isp-api
KEY=nexk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

curl -s "$API/devices?limit=100" -H "Authorization: Bearer $KEY"
curl -s "$API/devices/ref:ABO-1234" -H "Authorization: Bearer $KEY"
# Asociar el abonado al equipo (una vez)
curl -s -X POST "$API/devices/<uuid>/external-ref" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"external_ref":"ABO-1234"}'
# Registrar el pago: si ya no hay deuda, el equipo se desbloquea solo en el próximo sync
curl -s -X POST "$API/devices/ref:ABO-1234/paid-until" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"paid_until":"2026-11-30"}'
curl -s -X POST "$API/devices/ref:ABO-1234/lock" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"reason":"Baja del servicio"}'
curl -s -X POST "$API/devices/ref:ABO-1234/unlock" -H "Authorization: Bearer $KEY"
# Código para dictar por teléfono a un cliente sin internet
curl -s -X POST "$API/devices/ref:ABO-1234/unlock-code" -H "Authorization: Bearer $KEY"
```

### Verificar la atestación en un servicio del ISP

La app recibe el JWT en el fragmento de la URL (`#nex_attestation=<jwt>`). Lo manda a su backend, que lo verifica así:

1. Se baja `GET $API/jwks` y se cachea (unos minutos). La clave se elige por el `kid` del header.
2. Se exige `alg = RS256` (rechazá `none` o `HS256`) y se verifica la firma.
3. Se valida `iss = "nex-mdm"`, `aud = "nex-services"`, `exp` vigente (con unos segundos de tolerancia) y
   `st = "active"`.
4. Se usa `ref` (el `external_ref`) o `sub` (el uuid del equipo) para vincularlo con el abonado. `cid` es la empresa:
   comprobá que sea la tuya.

Ejemplo con Node y [`jose`](https://github.com/panva/jose):

```js
import { createRemoteJWKSet, jwtVerify } from 'jose';
const JWKS = createRemoteJWKSet(new URL('https://<proyecto>.supabase.co/functions/v1/isp-api/jwks'));
const { payload } = await jwtVerify(token, JWKS, {
  algorithms: ['RS256'], issuer: 'nex-mdm', audience: 'nex-services', clockTolerance: 30,
});
if (payload.st !== 'active' || payload.cid !== MI_EMPRESA_ID) throw new Error('equipo no habilitado');
// payload.ref → número de abonado; payload.sub → id del equipo
```

- El JWT prueba que el equipo estaba al día y desbloqueado hasta hace como mucho 6 h. No prueba quién lo presenta:
  es un bearer token.
- Para algo sensible, combinalo con la sesión propia del servicio.

### Publicar una actualización de firmware

1. **Clave de releases** (una sola vez, en una máquina offline; no va a Supabase):
   `tools/nex-os/keys/gen-release-key.sh /media/usb-cifrado/nex-release`. La pública va al firmware como
   `/etc/nex-agent/release.pub.pem`.
2. **Compilar** la imagen con un build entero mayor al anterior (queda en `/etc/nex-os-build`).
3. **Firmar** offline:
   ```sh
   tools/nex-os/release/sign-release.sh update.img 1042 /media/usb-cifrado/nex-release/release.key.pem
   ```
   Imprime `sha256`, `size` y `sig`: el base64 de la firma RS256 sobre `nex-update:v1:<build>:<sha256>`. Antes de
   imprimir, el script verifica la firma con la pública.
4. **Subir** `update.img` a una URL `https://` estable (bucket o CDN).
5. **Publicar** desde el panel (Firmware, solo NEX) o con `mdm_publish_release(version, build, url, sha256, size, sig,
   notas)`. La base no puede verificar la firma; el equipo sí, y descarta el release si no coincide.
6. **Asignar el target:**
   - primero a una empresa de prueba: `mdm_set_firmware_target(<empresa>, <release>)`;
   - después a todos: `mdm_set_firmware_target(null, <release>)`.

El equipo recibe `update` en el siguiente sync. Nunca instala un build menor al suyo: para volver atrás, se publica la
imagen anterior con un build nuevo.

### Verificado (v8)

- **SQL** (Postgres 16 local con stubs de `auth` y `storage` y los privilegios por defecto de Supabase): v6 → v7 → v8,
  y v8 corrida dos veces. Pasan 78 pruebas:
  - Campos nuevos del sync y backfill de `hardware_id` sin duplicar.
  - Los admins no pueden leer `unlock_secret`, `hardware_id`, `token_hash` ni `key_hash`.
  - Sin aal2 no hay permisos, y otra empresa no tiene acceso.
  - Claves de API revocadas o desconocidas.
  - Las funciones `mdm_isp_*` no se pueden ejecutar como anon ni como authenticated.
  - `update` solo con un build mayor, con el target de la empresa por encima del global.
  - Rotación del secreto, rate limits y auditoría `api:<nombre>`.
- **Código de desbloqueo:** coincide con `openssl dgst -sha256 -hmac` en 10 casos, incluidos los de ceros a la
  izquierda.
- **Edge Functions:** no había Deno, así que se probaron con `tsc --strict` y con Node, con un shim de `Deno` y un
  PostgREST simulado contra la base de prueba.
  - `payload` y JWT verificados con `openssl dgst -sha256 -verify`.
  - El `kid` del JWKS es igual al del script.
  - Validaciones HTTP (400, 401, 404, 405, 409, 413, 415, 429).
- **Segunda pasada independiente**, con Postgres 16 y pgcrypto real:
  - 87 pruebas de SQL;
  - 47 pruebas de las Edge Functions en Node, incluyendo payload ASCII, firma alterada que no verifica, equipo
    bloqueado sin atestación, clave mal configurada → 500 sin detalles, y JWKS → misma pública;
  - backfill de `unlock_secret` en equipos existentes;
  - `sign-release.sh` → `openssl dgst -verify` → `mdm_publish_release` aceptado.
- **No probado contra un Supabase real** (gateway, `verify_jwt` ni secretos).

## v8: equipo (nex-agent, UI y firmware)

Archivos: `device/rockchip/common/overlays/rootfs/nex-os/` (`nex-agent`, `cgi-nex`, `S99nex-os`, `install.sh`),
`src/mdm/`, `tools/nex-os/build.sh`, `tools/nex-os/tests/test-agent.sh`.

### Build

```sh
NEX_MDM_URL=https://xxxx.supabase.co NEX_MDM_ANON_KEY=... \
NEX_MDM_SIGN_PUBKEY=/ruta/mdm-sign.pub.pem \
NEX_RELEASE_PUBKEY=/ruta/release.pub.pem \
NEX_OS_BUILD=1042 \
tools/nex-os/build.sh
```

- **`NEX_MDM_SIGN_PUBKEY` es obligatoria.** Sin ella el equipo nunca aceptaría una configuración, así que el build
  falla.
- **`NEX_RELEASE_PUBKEY` es opcional.** Sin ella la imagen ignora las actualizaciones remotas.
- **`NEX_OS_BUILD`:** si no se pasa, se usa la hora UTC de compilación. Es el número que se firma en el release.

### Qué hace el equipo

- **Configuración firmada y atada al hardware.** Se guarda en `/userdata/nex-agent` y se re-verifica en cada arranque.
  Si alguien edita ese directorio o copia la configuración de otro equipo, el equipo queda en "Iniciando…" hasta el
  próximo sync. El límite offline se cuenta desde `server_epoch` firmado, no desde archivos locales.
- **Estado en `/userdata`.** El sistema puede quedar de solo lectura (dm-verity). La política de Chromium vive en
  tmpfs: `S99nex-os` la monta sobre `/etc/chromium/policies/managed`, así que cada arranque empieza fallo-cerrado.
- **Agente caído.** Si `ui-state.json` tiene más de 2 minutos, la UI muestra la pantalla de espera.
- **Reloj sin RTC.** Al arrancar y tras cada sync, el agente adelanta el reloj, nunca lo atrasa, hasta la última hora
  conocida: servidor, último sync o fecha de la imagen. chrony corrige de golpe (`makestep 1 -1`).
- **Código de desbloqueo.** El usuario lo ingresa en la pantalla de bloqueo y el equipo desbloquea 72 h.
  - No sirve contra un bloqueo por reloj.
  - Tampoco sirve más de 7 días después del límite offline.
  - Admite 5 intentos fallidos cada 15 minutos.
  - Con conexión, el estado del servidor reemplaza al código.
  - Límite conocido: el secreto vive en `/userdata`. Quien extraiga esa partición por USB podría generar códigos
    para ese equipo, pero solo dentro de la ventana offline + 7 días.
- **Wi-Fi desde el control remoto.**
  - La UI llama a `POST /cgi-bin/nex` (busybox httpd corre como `nex-www`), que deja el pedido en
    `/run/nex-agent/inbox`.
  - El agente lo aplica con `wpa_cli`; la red se guarda vía `save_config`, que en solo lectura termina en
    `/userdata/cfg`.
  - Otras páginas no pueden usar el relay: se exige `Content-Type: application/json` (preflight CORS que httpd no
    acepta) y el `Origin` de la UI.
- **Chromium sin root.** Corre como `nex-ui`, con el perfil en `/userdata/nex-ui`. Para diagnosticar se puede volver a
  root con `NEX_UI_USER=root` al compilar.
- **Actualizaciones.**
  - El equipo verifica la firma de la clave de releases sobre `nex-update:v1:<build>:<sha256>` antes de bajar nada.
  - Baja en segundo plano a `/userdata/nex-agent/update`, verifica el sha256 e instala con `update ota <imagen>`
    (configurable con `NEX_AGENT_OTA_CMD`).
  - No instala builds menores al propio. Si el instalador falla, no reintenta en bucle.
- **Atestación.** Las apps marcadas con "Pasa atestación" se abren con `#nex_attestation=<JWT>`.

### Verificado

- `tools/nex-os/tests/test-agent.sh` pasa 32 escenarios contra un servidor falso con firmas reales:
  - configuración editada, firmada con otra clave, de otro hardware o sin firma;
  - bloqueo manual, offline y por reloj;
  - código de desbloqueo: válido, inválido, de ayer, vencido, override editado, rate limit y descarte al sincronizar;
  - pedidos inválidos en la bandeja;
  - actualizaciones: firma correcta, firmada con la clave del MDM, downgrade, instalador fallido.
- El HMAC hecho con `sha256sum` coincide con `openssl dgst -hmac`.
- El CGI acepta los pedidos de la UI y rechaza otro origen, otro Content-Type, GET y acciones inválidas.
- Web: `tsc`, ESLint y `vite build` en modo MDM.

### Falta probar en un TV box real

Todo lo anterior se probó en una Mac, no en el equipo. Antes de producción hay que confirmar:

- `busybox httpd -u` con CGI;
- Chromium como `nex-ui` (sandbox, GPU, audio) y el socket de Wayland;
- `wpa_cli` y `save_config`;
- que exista `update ota` del recovery de Rockchip y que funcione con `update.img`;
- el montaje de las políticas en tmpfs;
- el script se probó con bash, no con ash de busybox: falta confirmar en el equipo el HMAC con `printf` octal.

## v9: estados escalonados y rotación de claves (servidor y panel)

Archivos: `supabase/schema-mdm-v9.sql` (después de v8, idempotente), `supabase/functions/isp-api`, `src/admin`,
`supabase/tests/`.

### Configurar las etapas

En el panel, **Marca y cobro**:

| Campo | Columna | Efecto |
|---|---|---|
| Aviso previo (días) | `payment_warning_days` | Banner en el TV desde N días antes del vencimiento |
| Restringir tras (días) | `payment_restrict_days` | N días después del vencimiento: apps deshabilitadas; menú, pago y red sí. Vacío = sin etapa |
| Días de gracia | `payment_grace_days` | Después de la gracia, bloqueo completo |
| Teléfono de pago | `payment_phone` | `^[0-9 +()-]{5,32}$` |
| URL de pago | `payment_url` | `https://`, hasta 300 caracteres; el TV la muestra como QR |

- Ejemplo: aviso 5, restringir 3 y gracia 10 → aviso 5 días antes, restringido el día 3 y bloqueado el día 10.
- La etapa restringida solo tiene efecto si es menor que la gracia. Si no, `restrict_at` va en `null`.
- Por RPC: `mdm_update_company(..., p_payment_restrict_days, p_payment_phone, p_payment_url)`. En días, `-1` quita la
  etapa. En teléfono y URL, `''` borra el dato. `null` deja el valor como estaba, así que las llamadas viejas siguen
  andando.
- **Restricción manual.** Se aplica desde el detalle del equipo (Restringir / Quitar restricción, con motivo),
  con `mdm_set_device_restricted(p_device, p_restricted, p_reason)` o con la API. Se audita como
  `device.restrict` / `device.unrestrict`.
- **Sync.** Suma `restricted`, `restrict_reason`, `payment.restrict_at` (epoch o `null`), `payment.phone` y
  `payment.url`. El teléfono y la URL también van en `company.payment_phone`/`payment_url`, para equipos sin control
  de pago. Un equipo restringido, a mano o por pago, no recibe atestación.
- **Historial.** `mdm_device_state_log` guarda cada cambio de bloqueo, restricción o `paid_until`, hecho desde el panel
  o la API, y cada estado nuevo que informa el equipo. Lo leen los miembros de la empresa y aparece en el detalle del
  equipo. Se purga al año (`mdm_purge_old_events`).

### API: restringir

`POST /devices/<id>/restrict` con `{"restricted": true|false, "reason"?: "…"}` devuelve el equipo. El equipo ahora
incluye `restricted`, `restrict_reason` y `service_state`, que vale `locked`, `restricted`, `warning` o `active`. El
servidor lo calcula con los mismos tiempos que el TV, salvo el reloj y los días offline, que solo conoce el equipo.

```sh
curl -s -X POST "$API/devices/ref:ABO-1234/restrict" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"restricted":true,"reason":"Falta de pago"}'
curl -s -X POST "$API/devices/ref:ABO-1234/restrict" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"restricted":false}'
```

### Rotar la clave de firma MDM

`/jwks` publica la clave actual (`NEX_SIGNING_KEY`) y las públicas de `NEX_SIGNING_PUBLIC_KEYS_EXTRA`: una o varias PEM
`BEGIN PUBLIC KEY` concatenadas. El `kid` de cada una son los primeros 16 hex de `sha256(SPKI DER)`. Las inválidas o
menores a 3072 bits se omiten y quedan en el log. `mdm-sync` firma siempre con `NEX_SIGNING_KEY`.

1. **Clave nueva.** Generá el par con `tools/nex-os/keys/gen-mdm-sign-key.sh /ruta/nueva`.
2. **Imágenes con las dos públicas.** Compilá con `NEX_MDM_SIGN_PUBKEY=/ruta/actual.pub.pem:/ruta/nueva.pub.pem` y
   llevá esa imagen a todos los equipos (OTA). El equipo acepta cualquier PEM de `/etc/nex-agent/mdm-sign.d/`.
   Lo ideal es tener siempre una de reserva incluida desde el primer build.
   - Un equipo sin la pública nueva rechaza la configuración a partir del paso 3.
   - Ese equipo sigue con la última configuración válida hasta llegar al límite de días offline.
3. **Cambio, en un solo comando**, para que `/jwks` nunca quede sin la clave vieja:
   ```sh
   supabase secrets set NEX_SIGNING_KEY="$(cat /ruta/nueva/mdm-sign.key.pem)" \
     NEX_SIGNING_PUBLIC_KEYS_EXTRA="$(cat /ruta/actual.pub.pem)"
   ```
4. **Limpieza.** Pasadas más de 6 h (la vida del JWT de atestación), sacá la vieja de
   `NEX_SIGNING_PUBLIC_KEYS_EXTRA` y de los próximos builds.

### Pruebas SQL

```sh
PG_BIN=/ruta/a/postgres/bin apps/nex-os/supabase/tests/run.sh   # o con psql/initdb en el PATH
```

- Requiere Postgres 15 o más nuevo, con pgcrypto.
- Levanta un cluster descartable en un directorio temporal, solo con socket Unix.
- Aplica `stubs.sql` (auth, storage y los privilegios por defecto de Supabase), v6 y v7, después `seed.sql`, v8 dos
  veces y v9 dos veces.
- Corre `tests.sql` e imprime `PASS`/`FAIL` y un resumen. Si algo falla, sale con un código distinto de 0.
- Resultado actual: 148 pruebas (78 de v8 y 70 de v9), todas pasan.
- Cubren:
  - permisos de restricción: otra empresa, aal1 y anon;
  - los campos nuevos del sync y la atestación con restricción;
  - el historial escrito desde el panel, la API y el equipo;
  - las validaciones de `mdm_update_company`;
  - `mdm_isp_set_restricted` y `service_state`;
  - la RLS del historial.
