-- NEX MDM v12: apps Android del operador, comunicados en el TV, diagnóstico de red y salud del equipo.
--
-- * Apps Android por empresa (mdm_company_android_apps): cada ISP carga sus propias apps desde el panel, sin pasar
--   por NEX. Dos orígenes:
--     - 'play': el paquete de la Play Store (com.ejemplo.app). El TV muestra un mosaico "Instalar" que abre la ficha
--       en la Play Store; no hay forma de instalar desde la Play Store sin que el usuario confirme.
--     - 'apk': un APK que el ISP sube al bucket mdm-apps (carpeta de su empresa). NEX TV lo descarga, verifica tamaño,
--       sha256, paquete y versionCode, y lo instala sin preguntar (NEX TV es app de sistema con INSTALL_PACKAGES).
--       Si el ISP la quita del panel, NEX TV desinstala las apps que instaló él mismo.
--   Cargar o cambiar un APK pide 2FA reciente: es código que corre en todos los TV de la empresa.
-- * Comunicados (mdm_notices): avisos de corte, clima, salud o municipales que el ISP manda a todos sus TV, con
--   vigencia. El TV los muestra (los de emergencia a pantalla completa) y avisa cuándo se vieron (mdm_notice_views).
-- * Diagnóstico de red: el panel lo pide (mdm_request_net_diag), el sync se lo pasa al equipo (diag_request), el
--   equipo mide (Wi-Fi, gateway, internet, DNS, velocidad) y devuelve el resultado como evento 'net_diag', que el sync
--   guarda en mdm_devices.net_diag en vez de sumarlo al historial.
-- * Salud: mdm_device_health_inputs devuelve, por equipo, encendidos, reinicios del agente y errores de las últimas
--   24 h. El puntaje 0-100 se calcula en el panel (src/admin/health.ts) con esto y con lo que el equipo informa en
--   health (temperatura, memoria, almacenamiento, red).
-- * _mdm_event_meta suma los eventos de NEX TV Android (actualizaciones y apps), que hasta v11 se descartaban.
--
-- El sync es el de v11 con tres claves nuevas en la respuesta (android_apps, notices, diag_request) y los eventos
-- 'notice_seen' y 'net_diag' interceptados. Los equipos que no las conocen las ignoran.
-- Idempotente: se puede correr dos veces.

-- ---------------------------------------------------------------------------
-- Apps Android del operador
-- ---------------------------------------------------------------------------

create table if not exists public.mdm_company_android_apps (
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  package text not null check (
    length(package) <= 150 and package ~ '^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$'),
  name text not null check (length(btrim(name)) between 1 and 60),
  source text not null check (source in ('play', 'apk')),
  -- Solo 'apk': archivo en el bucket mdm-apps, dentro de la carpeta de la empresa.
  apk_path text check (apk_path is null or (length(apk_path) <= 200 and apk_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}\.apk$')),
  version_code bigint check (version_code is null or version_code between 1 and 9223372036854775806),
  version_name text check (version_name is null or length(version_name) <= 64),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  size bigint check (size is null or (size > 0 and size <= 209715200)),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, package),
  check (source = 'play' or (apk_path is not null and version_code is not null and sha256 is not null and size is not null)),
  check (source = 'apk' or (apk_path is null and version_code is null and sha256 is null and size is null))
);

alter table public.mdm_company_android_apps enable row level security;
drop policy if exists mdm_company_android_apps_read on public.mdm_company_android_apps;
create policy mdm_company_android_apps_read on public.mdm_company_android_apps
  for select to authenticated
  using (public._mdm_company_role(company_id) is not null);
grant select on public.mdm_company_android_apps to authenticated;

-- Alta o cambio. Un APK pide 2FA reciente; una app de la Play Store no (el usuario confirma en la Play Store).
create or replace function public.mdm_upsert_android_app(
  p_company uuid, p_package text, p_name text, p_source text,
  p_apk_path text default null, p_version_code bigint default null, p_version_name text default null,
  p_sha256 text default null, p_size bigint default null, p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  if p_source = 'apk' then
    perform public._mdm_require_recent_mfa();
    -- El archivo tiene que estar en la carpeta de la empresa (la política del bucket ya impide subir a otra).
    if p_apk_path is null or split_part(p_apk_path, '/', 1) <> p_company::text then
      raise exception 'El APK no pertenece a esta empresa' using errcode = '42501';
    end if;
  elsif p_source <> 'play' then
    raise exception 'Origen inválido' using errcode = '22023';
  end if;
  if p_package in (select unnest(array['os.nex.tv', 'com.android.vending', 'com.google.android.gms', 'com.google.android.gsf',
                                       'com.android.settings', 'com.android.systemui', 'android'])) then
    raise exception 'Ese paquete lo administra NEX' using errcode = '22023';
  end if;
  if (select count(*) from public.mdm_company_android_apps where company_id = p_company and package <> p_package) >= 40 then
    raise exception 'Máximo 40 apps Android por empresa' using errcode = '54000';
  end if;

  insert into public.mdm_company_android_apps
    (company_id, package, name, source, apk_path, version_code, version_name, sha256, size, enabled, updated_at)
  values (p_company, p_package, btrim(p_name), p_source,
          case when p_source = 'apk' then p_apk_path end,
          case when p_source = 'apk' then p_version_code end,
          case when p_source = 'apk' then nullif(btrim(p_version_name), '') end,
          case when p_source = 'apk' then lower(p_sha256) end,
          case when p_source = 'apk' then p_size end,
          coalesce(p_enabled, true), now())
  on conflict (company_id, package) do update
    set name = excluded.name, source = excluded.source, apk_path = excluded.apk_path,
        version_code = excluded.version_code, version_name = excluded.version_name,
        sha256 = excluded.sha256, size = excluded.size, enabled = excluded.enabled, updated_at = now();

  perform public._mdm_audit(p_company, 'android_app.upsert', p_package, jsonb_strip_nulls(jsonb_build_object(
    'source', p_source, 'version_code', p_version_code, 'sha256', p_sha256, 'enabled', coalesce(p_enabled, true))));
end;
$$;
revoke all on function public.mdm_upsert_android_app(uuid, text, text, text, text, bigint, text, text, bigint, boolean) from public, anon;
grant execute on function public.mdm_upsert_android_app(uuid, text, text, text, text, bigint, text, text, bigint, boolean) to authenticated;

create or replace function public.mdm_set_android_app_enabled(p_company uuid, p_package text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  update public.mdm_company_android_apps set enabled = p_enabled, updated_at = now()
   where company_id = p_company and package = p_package;
  if not found then
    raise exception 'App inexistente' using errcode = 'P0002';
  end if;
  perform public._mdm_audit(p_company, 'android_app.set', p_package, jsonb_build_object('enabled', p_enabled));
end;
$$;
revoke all on function public.mdm_set_android_app_enabled(uuid, text, boolean) from public, anon;
grant execute on function public.mdm_set_android_app_enabled(uuid, text, boolean) to authenticated;

-- Devuelve el apk_path (o null) para que el panel borre el archivo del bucket.
create or replace function public.mdm_delete_android_app(p_company uuid, p_package text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  perform public._mdm_require_role(p_company);
  delete from public.mdm_company_android_apps where company_id = p_company and package = p_package
  returning apk_path into v_path;
  if not found then
    raise exception 'App inexistente' using errcode = 'P0002';
  end if;
  perform public._mdm_audit(p_company, 'android_app.delete', p_package, '{}'::jsonb);
  return v_path;
end;
$$;
revoke all on function public.mdm_delete_android_app(uuid, text) from public, anon;
grant execute on function public.mdm_delete_android_app(uuid, text) to authenticated;

-- Bucket público de solo lectura, como los logos: el TV lo descarga sin credenciales y verifica el sha256 que le
-- da el sync. Nombres únicos (uuid) por subida: no hay update, un APK nuevo es un archivo nuevo. Máximo 200 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mdm-apps', 'mdm-apps', true, 209715200, array['application/vnd.android.package-archive'])
on conflict (id) do update
  set public = true, file_size_limit = 209715200, allowed_mime_types = array['application/vnd.android.package-archive'];

drop policy if exists mdm_apps_write on storage.objects;
create policy mdm_apps_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mdm-apps'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public._mdm_company_role(((storage.foldername(name))[1])::uuid) is not null
  );

drop policy if exists mdm_apps_read on storage.objects;
create policy mdm_apps_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mdm-apps'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public._mdm_company_role(((storage.foldername(name))[1])::uuid) is not null
  );

drop policy if exists mdm_apps_delete on storage.objects;
create policy mdm_apps_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mdm-apps'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public._mdm_company_role(((storage.foldername(name))[1])::uuid) is not null
  );

-- ---------------------------------------------------------------------------
-- Comunicados
-- ---------------------------------------------------------------------------

create table if not exists public.mdm_notices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 80),
  body text not null check (length(btrim(body)) between 1 and 500),
  category text not null check (category in ('corte', 'clima', 'salud', 'municipal', 'general')),
  severity text not null check (severity in ('info', 'importante', 'emergencia')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (expires_at > starts_at and expires_at <= starts_at + interval '31 days')
);
create index if not exists mdm_notices_company_idx on public.mdm_notices (company_id, expires_at desc);

create table if not exists public.mdm_notice_views (
  notice_id uuid not null references public.mdm_notices (id) on delete cascade,
  device_id uuid not null references public.mdm_devices (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (notice_id, device_id)
);

alter table public.mdm_notices enable row level security;
alter table public.mdm_notice_views enable row level security;
drop policy if exists mdm_notices_read on public.mdm_notices;
create policy mdm_notices_read on public.mdm_notices
  for select to authenticated
  using (public._mdm_company_role(company_id) is not null);
grant select on public.mdm_notices to authenticated;
-- Las vistas se leen solo agregadas (mdm_list_notices): no hace falta exponer la tabla.

create or replace function public.mdm_create_notice(p_company uuid, p_title text, p_body text, p_category text,
                                                    p_severity text, p_starts_at timestamptz default null,
                                                    p_expires_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_start timestamptz := greatest(coalesce(p_starts_at, now()), now() - interval '5 minutes');
begin
  perform public._mdm_require_role(p_company);
  if public._mdm_rate_limited('notice', p_company::text, 30, interval '1 day') then
    raise exception 'Demasiados comunicados hoy' using errcode = '54000';
  end if;
  insert into public.mdm_notices (company_id, title, body, category, severity, starts_at, expires_at, created_by)
  values (p_company, btrim(p_title), btrim(p_body), p_category, p_severity, v_start,
          coalesce(p_expires_at, v_start + interval '1 day'), public._mdm_uid())
  returning id into v_id;
  perform public._mdm_audit(p_company, 'notice.create', v_id::text,
    jsonb_build_object('title', btrim(p_title), 'severity', p_severity, 'category', p_category));
  return v_id;
end;
$$;
revoke all on function public.mdm_create_notice(uuid, text, text, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.mdm_create_notice(uuid, text, text, text, text, timestamptz, timestamptz) to authenticated;

create or replace function public.mdm_cancel_notice(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.mdm_notices where id = p_id;
  if v_company is null then
    raise exception 'Comunicado inexistente' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company);
  update public.mdm_notices set cancelled_at = coalesce(cancelled_at, now()) where id = p_id;
  perform public._mdm_audit(v_company, 'notice.cancel', p_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.mdm_cancel_notice(uuid) from public, anon;
grant execute on function public.mdm_cancel_notice(uuid) to authenticated;

-- Últimos 50 comunicados con cuántos equipos de la empresa los vieron.
create or replace function public.mdm_list_notices(p_company uuid)
returns table (id uuid, title text, body text, category text, severity text, starts_at timestamptz,
               expires_at timestamptz, created_at timestamptz, cancelled_at timestamptz, seen int, devices int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  return query
    select n.id, n.title, n.body, n.category, n.severity, n.starts_at, n.expires_at, n.created_at, n.cancelled_at,
           (select count(*)::int from public.mdm_notice_views v where v.notice_id = n.id),
           (select count(*)::int from public.mdm_devices d where d.company_id = p_company)
      from public.mdm_notices n
     where n.company_id = p_company
     order by n.created_at desc
     limit 50;
end;
$$;
revoke all on function public.mdm_list_notices(uuid) from public, anon;
grant execute on function public.mdm_list_notices(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Diagnóstico de red
-- ---------------------------------------------------------------------------

alter table public.mdm_devices add column if not exists diag_requested_at timestamptz;
alter table public.mdm_devices add column if not exists net_diag jsonb;
alter table public.mdm_devices add column if not exists net_diag_at timestamptz;
grant select (diag_requested_at, net_diag, net_diag_at) on public.mdm_devices to authenticated;

create or replace function public.mdm_request_net_diag(p_device uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.mdm_devices where id = p_device;
  if v_company is null then
    raise exception 'Equipo inexistente' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company);
  -- La prueba de velocidad baja hasta 25 MB: se limita para no gastar el abono del cliente.
  if public._mdm_rate_limited('net-diag', p_device::text, 6, interval '1 hour') then
    raise exception 'Ya se pidieron varios diagnósticos en la última hora' using errcode = '54000';
  end if;
  update public.mdm_devices set diag_requested_at = now() where id = p_device;
  perform public._mdm_audit(v_company, 'device.net_diag', p_device::text, '{}'::jsonb);
end;
$$;
revoke all on function public.mdm_request_net_diag(uuid) from public, anon;
grant execute on function public.mdm_request_net_diag(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Salud: insumos de las últimas 24 h por equipo
-- ---------------------------------------------------------------------------

create or replace function public.mdm_device_health_inputs(p_company uuid)
returns table (device_id uuid, boots int, restarts int, errors int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  return query
    select d.id,
           count(e.id) filter (where e.kind = 'agent_started')::int,
           count(e.id) filter (where e.kind = 'agent_restarted')::int,
           count(e.id) filter (where e.kind in ('update_failed', 'update_rejected', 'app_install_failed',
                                                'dns_filter_down', 'firewall_unavailable', 'policy_tampered',
                                                'clock_rollback'))::int
      from public.mdm_devices d
      left join public.mdm_device_events e
        on e.device_id = d.id and e.created_at > now() - interval '24 hours'
     where d.company_id = p_company
     group by d.id;
end;
$$;
revoke all on function public.mdm_device_health_inputs(uuid) from public, anon;
grant execute on function public.mdm_device_health_inputs(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Eventos: los de v7 más los de NEX TV Android
-- ---------------------------------------------------------------------------

create or replace function public._mdm_event_meta(p_kind text, out category text, out severity text, out label text)
language sql
immutable
as $$
  select m.category, m.severity, m.label
    from (values
      ('lock_applied',        'lock_applied',   'info',     'Bloqueo aplicado en el equipo'),
      ('unlock_applied',      'unlock_applied', 'info',     'Desbloqueo aplicado en el equipo'),
      ('clock_rollback',      'tamper',         'critical', 'Reloj del equipo atrasado (posible intento de evitar el bloqueo)'),
      ('policy_tampered',     'tamper',         'critical', 'Política de navegación modificada fuera del agente'),
      ('agent_restarted',     'tamper',         'warning',  'El agente se reinició sin reiniciar el equipo'),
      ('image_not_hardened',  'tamper',         'critical', 'El equipo corre una imagen sin modo TV cerrado'),
      ('dns_filter_down',     'tamper',         'warning',  'Filtro DNS caído: solo queda el filtro de Chromium'),
      ('firewall_unavailable','tamper',         'warning',  'Firewall no disponible: el filtro DNS se puede esquivar'),
      ('reflashed',           'tamper',         'critical', 'Equipo reinstalado o reseteado: se volvió a vincular solo'),
      ('offline',             'offline',        'warning',  'Equipo sin conexión'),
      ('back_online',         'offline',        'info',     'Equipo de nuevo en línea'),
      ('piracy_attempt',      'piracy',         'warning',  'Intento de abrir un sitio pirata'),
      ('agent_started',       'info',           'info',     'Equipo encendido'),
      ('test',                'test',           'info',     'Aviso de prueba'),
      -- v12: NEX TV Android
      ('update_started',      'info',           'info',     'Actualización de NEX TV en curso'),
      ('update_installed',    'info',           'info',     'NEX TV actualizado'),
      ('update_failed',       'info',           'warning',  'Falló la actualización de NEX TV'),
      ('update_rejected',     'info',           'warning',  'Actualización de NEX TV rechazada (no pasó la verificación)'),
      ('app_installed',       'info',           'info',     'App del operador instalada'),
      ('app_install_failed',  'info',           'warning',  'No se pudo instalar una app del operador'),
      ('app_removed',         'info',           'info',     'App del operador desinstalada')
    ) as m(kind, category, severity, label)
   where m.kind = p_kind;
$$;

-- ---------------------------------------------------------------------------
-- Sync del equipo: v11 + android_apps, notices, diag_request y eventos notice_seen / net_diag.
-- ---------------------------------------------------------------------------

create or replace function public.mdm_device_sync(p_token text, p_firmware text default null,
                                                  p_status jsonb default null, p_events jsonb default null,
                                                  p_hardware_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public._mdm_token_hash(p_token);
  v_device public.mdm_devices;
  v_company public.mdm_companies;
  v_item jsonb;
  v_mode text;
  v_at timestamptz;
  v_hw text := case when p_hardware_id ~ '^[0-9a-f]{64}$' then p_hardware_id end;
  v_build int := case when (p_status ->> 'build') ~ '^[0-9]{1,9}$' then (p_status ->> 'build')::int else 0 end;
  -- v11: cada plataforma recibe solo sus releases. Sin plataforma (agentes Linux viejos) cuenta como linux.
  v_platform text := case when p_status ->> 'platform' = 'android' then 'android' else 'linux' end;
  v_times record;
  v_release public.mdm_firmware_releases;
  v_reported text;
  v_last text;
begin
  select * into v_device from public.mdm_devices where token_hash = v_hash;
  if not found then
    return jsonb_build_object('status', 'unknown', 'server_time', now());
  end if;

  v_mode := p_status ->> 'mode';
  update public.mdm_devices
     set last_seen_at = now(),
         firmware_version = coalesce(left(p_firmware, 64), firmware_version),
         health = case when jsonb_typeof(p_status) = 'object' and length(p_status::text) <= 2048
                       then p_status else health end,
         reported_mode = case when v_mode in ('starting', 'unpaired', 'locked', 'restricted', 'active')
                              then v_mode else reported_mode end,
         reported_lock_kind = case when v_mode is not null then left(p_status ->> 'lock_kind', 16) else reported_lock_kind end,
         reported_at = case when v_mode is not null then now() else reported_at end,
         offline_alerted_at = null,
         unlock_secret = coalesce(unlock_secret, encode(extensions.gen_random_bytes(32), 'hex'))
   where id = v_device.id
  returning unlock_secret into v_device.unlock_secret;

  -- v8: equipos vinculados antes de v7 no tienen hardware_id; se completa si nadie más lo tiene.
  if v_device.hardware_id is null and v_hw is not null
     and not exists (select 1 from public.mdm_devices where hardware_id = v_hw) then
    begin
      update public.mdm_devices set hardware_id = v_hw where id = v_device.id;
      v_device.hardware_id := v_hw;
    exception when unique_violation then
      -- carrera con otro equipo: se deja como estaba
    end;
  end if;

  if v_device.company_id is not null then
    if v_device.offline_alerted_at is not null then
      perform public._mdm_add_event(v_device.id, v_device.company_id, 'back_online',
        jsonb_build_object('offline_since', v_device.last_seen_at));
    end if;
    if jsonb_typeof(p_events) = 'array'
       and not public._mdm_rate_limited('events', v_device.id::text, 120, interval '1 hour') then
      for v_item in select * from jsonb_array_elements(p_events) limit 30 loop
        continue when jsonb_typeof(v_item) <> 'object' or v_item ->> 'kind' is null;
        continue when v_item ->> 'kind' in ('reflashed', 'offline', 'back_online', 'piracy_attempt', 'test');
        v_at := case when (v_item ->> 'at') ~ '^[0-9]{9,11}$' then to_timestamp((v_item ->> 'at')::bigint) end;
        -- v12: el equipo mostró un comunicado. No va al historial: se cuenta en mdm_notice_views.
        if v_item ->> 'kind' = 'notice_seen' then
          if (v_item -> 'details' ->> 'id') ~ '^[0-9a-f-]{36}$' then
            insert into public.mdm_notice_views (notice_id, device_id, seen_at)
            select n.id, v_device.id, least(coalesce(v_at, now()), now())
              from public.mdm_notices n
             where n.id = (v_item -> 'details' ->> 'id')::uuid and n.company_id = v_device.company_id
            on conflict do nothing;
          end if;
          continue;
        end if;
        -- v12: resultado del diagnóstico de red. Se guarda el último en el equipo, no en el historial.
        if v_item ->> 'kind' = 'net_diag' then
          if jsonb_typeof(v_item -> 'details') = 'object' and length((v_item -> 'details')::text) <= 1024 then
            update public.mdm_devices
               -- Hora del servidor: se compara con diag_requested_at aunque el reloj del equipo esté corrido.
               set net_diag = v_item -> 'details', net_diag_at = now()
             where id = v_device.id;
          end if;
          continue;
        end if;
        perform public._mdm_add_event(v_device.id, v_device.company_id, v_item ->> 'kind',
          case when jsonb_typeof(v_item -> 'details') = 'object' and length((v_item -> 'details')::text) <= 512
               then v_item -> 'details' else '{}'::jsonb end,
          v_at);
      end loop;
    end if;

    -- v9: historial con el estado que informa el equipo (solo si cambió respecto del último informado).
    if v_mode in ('active', 'restricted', 'locked') then
      v_reported := case
        when v_mode = 'active' and p_status -> 'service_warning' = 'true'::jsonb then 'warning'
        else v_mode end;
      select state into v_last from public.mdm_device_state_log
       where device_id = v_device.id and source = 'device'
       order by at desc, id desc limit 1;
      if v_last is distinct from v_reported
         and not public._mdm_rate_limited('state-log', v_device.id::text, 60, interval '1 hour') then
        perform public._mdm_log_state(v_device.id, 'device', jsonb_strip_nulls(jsonb_build_object(
          'mode', v_mode,
          'lock_kind', left(p_status ->> 'lock_kind', 16),
          'restrict_kind', left(p_status ->> 'restrict_kind', 16))), v_reported);
      end if;
    end if;
  end if;

  if v_device.company_id is null then
    return public.mdm_device_register(p_token, p_firmware, p_hardware_id);
  end if;

  select * into v_company from public.mdm_companies where id = v_device.company_id;
  select * into v_times from public._mdm_payment_times(v_device.paid_until, v_company);

  -- OTA: target de la empresa para la plataforma del equipo; si no tiene, el global de esa plataforma.
  select r.* into v_release
    from public.mdm_firmware_targets t join public.mdm_firmware_releases r on r.id = t.release_id
   where t.company_id = v_company.id and t.platform = v_platform;
  if not found then
    select r.* into v_release
      from public.mdm_firmware_targets t join public.mdm_firmware_releases r on r.id = t.release_id
     where t.company_id is null and t.platform = v_platform;
  end if;

  return jsonb_build_object(
    'status', 'paired',
    'server_time', now(),
    'server_epoch', extract(epoch from now())::bigint,
    'payment', case when v_device.paid_until is null then null else jsonb_build_object(
      'paid_until', v_device.paid_until,
      'lock_at', extract(epoch from v_times.lock_at)::bigint,
      'warn_at', extract(epoch from v_times.warn_at)::bigint,
      'message', v_company.payment_message,
      -- v9
      'restrict_at', extract(epoch from v_times.restrict_at)::bigint,
      'phone', v_company.payment_phone,
      'url', v_company.payment_url
    ) end,
    'device', jsonb_build_object('id', v_device.id, 'name', v_device.name),
    'locked', v_device.locked,
    'lock_reason', v_device.lock_reason,
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'lock_message', v_company.lock_message,
      'offline_lock_days', v_company.offline_lock_days,
      'logo_path', v_company.logo_path,
      -- v9: también acá, para equipos sin control de pago (payment = null) bloqueados o restringidos a mano.
      'payment_phone', v_company.payment_phone,
      'payment_url', v_company.payment_url
    ),
    'apps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.name, 'kind', a.kind, 'launch_url', a.launch_url,
               'icon_url', a.icon_url, 'domains', to_jsonb(a.domains),
               'pass_attestation', a.pass_attestation) order by a.name)
        from public.mdm_company_apps ca
        join public.mdm_app_catalog a on a.id = ca.app_id
       where ca.company_id = v_company.id and ca.enabled and a.active
    ), '[]'::jsonb),
    'blocked_domains', coalesce((
      select jsonb_agg(c.domain order by c.domain)
        from public.mdm_domain_classifications c where c.status = 'pirateria'
    ), '[]'::jsonb),
    -- v8
    'hardware_id', v_device.hardware_id,
    'unlock_secret', v_device.unlock_secret,
    'external_ref', v_device.external_ref,
    'attestation_eligible', (not v_device.locked and not v_device.restricted
                             and (v_times.lock_at is null or now() < v_times.lock_at)
                             and (v_times.restrict_at is null or now() < v_times.restrict_at)),
    'update', case when v_release.id is not null and v_release.build > v_build then jsonb_build_object(
      'version', v_release.version,
      'build', v_release.build,
      'url', v_release.url,
      'sha256', v_release.sha256,
      'size', v_release.size,
      'sig', v_release.sig
    ) end,
    -- v9
    'restricted', v_device.restricted,
    'restrict_reason', v_device.restrict_reason,
    -- v12: apps Android del operador (habilitadas). El equipo arma la URL del APK con su URL del MDM.
    'android_apps', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'package', a.package, 'name', a.name, 'source', a.source, 'apk_path', a.apk_path,
               'version_code', a.version_code, 'sha256', a.sha256, 'size', a.size)) order by a.name)
        from public.mdm_company_android_apps a
       where a.company_id = v_company.id and a.enabled
    ), '[]'::jsonb),
    -- v12: comunicados vigentes, los más graves primero.
    'notices', coalesce((
      select jsonb_agg(x.j order by x.rank, x.starts_at desc)
        from (select n.starts_at,
                     case n.severity when 'emergencia' then 0 when 'importante' then 1 else 2 end as rank,
                     jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'category', n.category,
                                        'severity', n.severity,
                                        'expires_at', extract(epoch from n.expires_at)::bigint) as j
                from public.mdm_notices n
               where n.company_id = v_company.id and n.cancelled_at is null
                 and n.starts_at <= now() and n.expires_at > now()
               order by 2, n.starts_at desc
               limit 5) x
    ), '[]'::jsonb),
    -- v12: diagnóstico de red pendiente (pedido en la última hora y todavía sin resultado posterior).
    'diag_request', case when v_device.diag_requested_at > now() - interval '1 hour'
                          and (v_device.net_diag_at is null or v_device.net_diag_at < v_device.diag_requested_at)
                         then extract(epoch from v_device.diag_requested_at)::bigint end
  );
end;
$$;

revoke all on function public.mdm_device_sync(text, text, jsonb, jsonb, text) from public;
grant execute on function public.mdm_device_sync(text, text, jsonb, jsonb, text) to anon, authenticated;

