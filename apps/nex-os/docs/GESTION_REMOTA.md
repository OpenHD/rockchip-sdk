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

- **Configuración de red en el TV.** No hay pantalla de Wi-Fi: si el equipo cambia de red, no puede reconectarse
  desde el control remoto. Es necesaria antes de producción, sobre todo con el bloqueo por días sin conexión.
- Estados `aviso`/`restringido`, `device_state_log`, API de cobranza con API keys, QR y teléfono de pago.
- Código de desbloqueo offline (HMAC por día).
- Re-enrolamiento por `hardware_id`, firma HMAC del estado local, dm-verity y Secure Boot.
- QR en la pantalla de vinculación: hoy solo se muestra el código. `src/utils/qr.ts` usa un servicio externo,
  y mandarle el código a un tercero no es aceptable.

