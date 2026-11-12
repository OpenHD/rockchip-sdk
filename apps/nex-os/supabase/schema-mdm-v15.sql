-- NEX MDM v15: zonas (localidad, nodo u OLT), comunicados por zona y alerta de caída masiva por zona.
--
-- * mdm_zones: zonas de cada empresa. Cada equipo puede tener una (mdm_devices.zone_id), asignada desde el panel.
-- * Comunicados: mdm_notices.zone_ids (null = todos). El sync solo entrega a los equipos de esas zonas.
-- * Caída masiva: mdm_check_offline (lo corre mdm-notify cada minuto) también llama a _mdm_detect_zone_outages. Una zona
--   con 3 o más equipos activos (vistos en las últimas 24 h) entra en caída cuando la mitad o más (mínimo 3) llevan más de
--   3 minutos sin sincronizar, y sale cuando quedan 20 % o menos. Eventos zone_outage / zone_restored (categoría
--   'offline', sin equipo), así llegan por Telegram/mail a las empresas con alertas de "Sin conexión".
-- * mdm_zone_status: estado por zona para el panel.
-- * API del ISP: POST /devices/<id>/zone {zone: "Nombre" | null} (mdm_isp_set_zone) y "zone" en el JSON del equipo.
-- El sync es el de v12 con el filtro de zona en los comunicados.
-- Idempotente.

-- ---------------------------------------------------------------------------
-- Zonas
-- ---------------------------------------------------------------------------

create table if not exists public.mdm_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index if not exists mdm_zones_company_name_idx on public.mdm_zones (company_id, lower(name));

alter table public.mdm_zones enable row level security;
drop policy if exists mdm_zones_read on public.mdm_zones;
create policy mdm_zones_read on public.mdm_zones
  for select to authenticated
  using (public._mdm_company_role(company_id) is not null);
grant select on public.mdm_zones to authenticated;

alter table public.mdm_devices add column if not exists zone_id uuid references public.mdm_zones (id) on delete set null;
create index if not exists mdm_devices_zone_idx on public.mdm_devices (zone_id) where zone_id is not null;
grant select (zone_id) on public.mdm_devices to authenticated;

create table if not exists public.mdm_zone_outages (
  id bigint generated always as identity primary key,
  zone_id uuid not null references public.mdm_zones (id) on delete cascade,
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  offline int not null,
  total int not null,
  peak_offline int not null
);
create unique index if not exists mdm_zone_outages_open_idx on public.mdm_zone_outages (zone_id) where ended_at is null;
create index if not exists mdm_zone_outages_company_idx on public.mdm_zone_outages (company_id, started_at desc);
alter table public.mdm_zone_outages enable row level security;
drop policy if exists mdm_zone_outages_read on public.mdm_zone_outages;
create policy mdm_zone_outages_read on public.mdm_zone_outages
  for select to authenticated
  using (public._mdm_company_role(company_id) is not null);
grant select on public.mdm_zone_outages to authenticated;

-- Crear (p_id null) o renombrar una zona. Devuelve el id.
create or replace function public.mdm_upsert_zone(p_company uuid, p_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public._mdm_require_role(p_company);
  if p_id is null then
    if (select count(*) from public.mdm_zones where company_id = p_company) >= 200 then
      raise exception 'Máximo 200 zonas por empresa' using errcode = '54000';
    end if;
    insert into public.mdm_zones (company_id, name) values (p_company, btrim(p_name)) returning id into v_id;
  else
    update public.mdm_zones set name = btrim(p_name) where id = p_id and company_id = p_company returning id into v_id;
    if v_id is null then
      raise exception 'Zona inexistente' using errcode = 'P0002';
    end if;
  end if;
  perform public._mdm_audit(p_company, 'zone.upsert', v_id::text, jsonb_build_object('name', btrim(p_name)));
  return v_id;
exception when unique_violation then
  raise exception 'Ya hay una zona con ese nombre' using errcode = '23505';
end;
$$;
revoke all on function public.mdm_upsert_zone(uuid, uuid, text) from public, anon;
grant execute on function public.mdm_upsert_zone(uuid, uuid, text) to authenticated;

-- Borrar una zona: sus equipos quedan sin zona y los comunicados dejan de apuntarle.
create or replace function public.mdm_delete_zone(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.mdm_zones where id = p_id;
  if v_company is null then
    raise exception 'Zona inexistente' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company);
  update public.mdm_notices set zone_ids = nullif(array_remove(zone_ids, p_id), '{}')
   where company_id = v_company and p_id = any (zone_ids) and cancelled_at is null
     and cardinality(array_remove(zone_ids, p_id)) > 0;
  -- Un comunicado vigente que solo iba a esa zona se cancela (no pasa a ir a todos).
  update public.mdm_notices set cancelled_at = now()
   where company_id = v_company and zone_ids = array[p_id] and cancelled_at is null;
  delete from public.mdm_zones where id = p_id;
  perform public._mdm_audit(v_company, 'zone.delete', p_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.mdm_delete_zone(uuid) from public, anon;
grant execute on function public.mdm_delete_zone(uuid) to authenticated;

-- Asignar zona (o null) a varios equipos de la misma empresa a la vez. Devuelve cuántos cambiaron.
create or replace function public.mdm_set_devices_zone(p_company uuid, p_devices uuid[], p_zone uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform public._mdm_require_role(p_company);
  if p_zone is not null and not exists (select 1 from public.mdm_zones where id = p_zone and company_id = p_company) then
    raise exception 'Zona inexistente' using errcode = 'P0002';
  end if;
  if cardinality(coalesce(p_devices, '{}')) > 5000 then
    raise exception 'Demasiados equipos de una vez' using errcode = '54000';
  end if;
  update public.mdm_devices set zone_id = p_zone
   where company_id = p_company and id = any (p_devices) and zone_id is distinct from p_zone;
  get diagnostics v_count = row_count;
  perform public._mdm_audit(p_company, 'device.zone', coalesce(p_zone::text, 'sin zona'),
    jsonb_build_object('devices', v_count));
  return v_count;
end;
$$;
revoke all on function public.mdm_set_devices_zone(uuid, uuid[], uuid) from public, anon;
grant execute on function public.mdm_set_devices_zone(uuid, uuid[], uuid) to authenticated;

-- Estado por zona: equipos, en línea (sync en los últimos 5 min) y caída abierta.
create or replace function public.mdm_zone_status(p_company uuid)
returns table (zone_id uuid, name text, total int, online int, outage_started_at timestamptz, outage_offline int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  return query
    select z.id, z.name,
           count(d.id)::int,
           count(d.id) filter (where d.last_seen_at > now() - interval '5 minutes')::int,
           o.started_at, o.peak_offline
      from public.mdm_zones z
      left join public.mdm_devices d on d.zone_id = z.id
      left join public.mdm_zone_outages o on o.zone_id = z.id and o.ended_at is null
     where z.company_id = p_company
     group by z.id, z.name, o.started_at, o.peak_offline
     order by lower(z.name);
end;
$$;
revoke all on function public.mdm_zone_status(uuid) from public, anon;
grant execute on function public.mdm_zone_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Caída masiva por zona
-- ---------------------------------------------------------------------------

create or replace function public._mdm_detect_zone_outages()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_changes int := 0;
  v_open public.mdm_zone_outages;
begin
  for r in
    select z.id, z.company_id, z.name,
           count(d.id)::int as total,
           count(d.id) filter (where d.last_seen_at < now() - interval '3 minutes')::int as offline
      from public.mdm_zones z
      join public.mdm_devices d on d.zone_id = z.id and d.last_seen_at > now() - interval '24 hours'
     group by z.id, z.company_id, z.name
  loop
    select * into v_open from public.mdm_zone_outages where zone_id = r.id and ended_at is null;
    if v_open.id is null then
      if r.total >= 3 and r.offline >= greatest(3, ceil(r.total * 0.5)) then
        insert into public.mdm_zone_outages (zone_id, company_id, offline, total, peak_offline)
        values (r.id, r.company_id, r.offline, r.total, r.offline);
        perform public._mdm_add_event(null, r.company_id, 'zone_outage',
          jsonb_build_object('zone', r.name, 'zone_id', r.id, 'offline', r.offline, 'total', r.total));
        v_changes := v_changes + 1;
      end if;
    elsif r.offline <= floor(r.total * 0.2) then
      update public.mdm_zone_outages set ended_at = now(), offline = r.offline where id = v_open.id;
      perform public._mdm_add_event(null, r.company_id, 'zone_restored',
        jsonb_build_object('zone', r.name, 'zone_id', r.id, 'offline', r.offline, 'total', r.total,
                           'minutes', (extract(epoch from now() - v_open.started_at) / 60)::int));
      v_changes := v_changes + 1;
    else
      update public.mdm_zone_outages set offline = r.offline, total = r.total,
             peak_offline = greatest(peak_offline, r.offline) where id = v_open.id;
    end if;
    v_open := null;
  end loop;
  return v_changes;
end;
$$;
revoke all on function public._mdm_detect_zone_outages() from public, anon, authenticated;

-- El job de cada minuto (mdm-notify ?job=tick) ahora también detecta caídas por zona.
create or replace function public.mdm_check_offline()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select d.id, d.company_id, d.last_seen_at
      from public.mdm_devices d
      join public.mdm_companies c on c.id = d.company_id
     where d.offline_alerted_at is null
       and d.last_seen_at is not null
       and d.last_seen_at < now() - make_interval(hours => c.alert_offline_hours)
     limit 1000
  loop
    update public.mdm_devices set offline_alerted_at = now() where id = r.id;
    perform public._mdm_add_event(r.id, r.company_id, 'offline', jsonb_build_object('last_seen_at', r.last_seen_at));
    v_count := v_count + 1;
  end loop;
  return v_count + public._mdm_detect_zone_outages();
end;
$$;

-- ---------------------------------------------------------------------------
-- Comunicados por zona
-- ---------------------------------------------------------------------------

alter table public.mdm_notices add column if not exists zone_ids uuid[];

drop function if exists public.mdm_create_notice(uuid, text, text, text, text, timestamptz, timestamptz);
create or replace function public.mdm_create_notice(p_company uuid, p_title text, p_body text, p_category text,
                                                    p_severity text, p_starts_at timestamptz default null,
                                                    p_expires_at timestamptz default null, p_zones uuid[] default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_start timestamptz := greatest(coalesce(p_starts_at, now()), now() - interval '5 minutes');
  v_zones uuid[] := nullif(array(select distinct unnest(coalesce(p_zones, '{}'))), '{}');
begin
  perform public._mdm_require_role(p_company);
  if v_zones is not null and exists (
       select 1 from unnest(v_zones) z where not exists (select 1 from public.mdm_zones where id = z and company_id = p_company)) then
    raise exception 'Zona inexistente' using errcode = 'P0002';
  end if;
  if public._mdm_rate_limited('notice', p_company::text, 30, interval '1 day') then
    raise exception 'Demasiados comunicados hoy' using errcode = '54000';
  end if;
  insert into public.mdm_notices (company_id, title, body, category, severity, starts_at, expires_at, created_by, zone_ids)
  values (p_company, btrim(p_title), btrim(p_body), p_category, p_severity, v_start,
          coalesce(p_expires_at, v_start + interval '1 day'), public._mdm_uid(), v_zones)
  returning id into v_id;
  perform public._mdm_audit(p_company, 'notice.create', v_id::text,
    jsonb_build_object('title', btrim(p_title), 'severity', p_severity, 'category', p_category, 'zones', to_jsonb(v_zones)));
  return v_id;
end;
$$;
revoke all on function public.mdm_create_notice(uuid, text, text, text, text, timestamptz, timestamptz, uuid[]) from public, anon;
grant execute on function public.mdm_create_notice(uuid, text, text, text, text, timestamptz, timestamptz, uuid[]) to authenticated;

-- Igual que v12 más zone_ids; "devices" cuenta solo los equipos de esas zonas.
drop function if exists public.mdm_list_notices(uuid);
create or replace function public.mdm_list_notices(p_company uuid)
returns table (id uuid, title text, body text, category text, severity text, starts_at timestamptz,
               expires_at timestamptz, created_at timestamptz, cancelled_at timestamptz, seen int, devices int,
               zone_ids uuid[])
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
           (select count(*)::int from public.mdm_devices d
             where d.company_id = p_company and (n.zone_ids is null or d.zone_id = any (n.zone_ids))),
           n.zone_ids
      from public.mdm_notices n
     where n.company_id = p_company
     order by n.created_at desc
     limit 50;
end;
$$;
revoke all on function public.mdm_list_notices(uuid) from public, anon;
grant execute on function public.mdm_list_notices(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Eventos y avisos: los de v13 más las caídas por zona
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
      ('app_removed',         'info',           'info',     'App del operador desinstalada'),
      -- v13: firmas del incidente de CAPPI en firmware de fábrica (ver FactoryRisk.kt y macch-ai/curebox)
      ('upload_anomaly',      'tamper',         'critical', 'Subida alta sin uso: posible equipo infectado (botnet)'),
      -- v15: caída masiva en una zona (sin equipo: es de la empresa)
      ('zone_outage',         'offline',        'critical', 'Caída masiva: muchos equipos de una zona sin conexión a la vez'),
      ('zone_restored',       'offline',        'info',     'Zona recuperada: los equipos volvieron a conectarse'),
      ('factory_backdoor',    'tamper',         'warning',  'Puertas traseras de fábrica abiertas (shell root, ADB por red o apps de control remoto)')
    ) as m(kind, category, severity, label)
   where m.kind = p_kind;
$$;

create or replace function public._mdm_queue_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company public.mdm_companies;
  v_device_name text;
  v_meta record;
  v_body text;
  v_subject text;
begin
  if new.company_id is null or new.category = 'info' then
    return new;
  end if;
  select * into v_company from public.mdm_companies where id = new.company_id;
  if new.category <> 'test' and not (new.category = any (v_company.alert_kinds)) then
    return new;
  end if;
  select coalesce(name, left(id::text, 8)) into v_device_name from public.mdm_devices where id = new.device_id;
  select * into v_meta from public._mdm_event_meta(new.kind);

  v_subject := format('[%s] %s', v_company.name, v_meta.label);
  v_body := format(E'%s %s\nEmpresa: %s\nEquipo: %s\nFecha: %s',
    case new.severity when 'critical' then '🚨' when 'warning' then '⚠️' else 'ℹ️' end,
    v_meta.label, v_company.name, coalesce(v_device_name, '—'),
    to_char(new.created_at at time zone v_company.timezone, 'DD/MM/YYYY HH24:MI'));
  if new.details ? 'domain' then
    v_body := v_body || E'\nSitio: ' || (new.details ->> 'domain');
  end if;
  -- v15: caídas por zona
  if new.details ? 'zone' then
    v_body := v_body || E'\nZona: ' || (new.details ->> 'zone');
  end if;
  if new.details ? 'offline' and new.details ? 'total' then
    v_body := v_body || format(E'\nSin conexión: %s de %s equipos', new.details ->> 'offline', new.details ->> 'total');
  end if;
  if new.details ? 'lock_kind' then
    v_body := v_body || E'\nMotivo: ' || (new.details ->> 'lock_kind');
  end if;

  if v_company.alert_telegram_chat_id is not null then
    insert into public.mdm_notifications (event_id, company_id, channel, subject, body)
    values (new.id, new.company_id, 'telegram', v_subject, v_body);
  end if;
  if cardinality(v_company.alert_emails) > 0 then
    insert into public.mdm_notifications (event_id, company_id, channel, subject, body)
    values (new.id, new.company_id, 'email', v_subject, v_body);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- API del ISP: zona del equipo (por nombre; se crea si no existe)
-- ---------------------------------------------------------------------------

create or replace function public._mdm_isp_device_json(p_device public.mdm_devices)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_device.id,
    'name', p_device.name,
    'external_ref', p_device.external_ref,
    'locked', p_device.locked,
    'lock_reason', p_device.lock_reason,
    'paid_until', p_device.paid_until,
    'online', coalesce(p_device.last_seen_at > now() - interval '5 minutes', false),
    'last_seen_at', p_device.last_seen_at,
    'reported_mode', p_device.reported_mode,
    'reported_lock_kind', p_device.reported_lock_kind,
    'firmware_version', p_device.firmware_version,
    -- v9
    'restricted', p_device.restricted,
    'restrict_reason', p_device.restrict_reason,
    'service_state', (select public._mdm_service_state(p_device, c)
                        from public.mdm_companies c where c.id = p_device.company_id),
    -- v15
    'zone', (select z.name from public.mdm_zones z where z.id = p_device.zone_id)
  );
$$;
revoke all on function public._mdm_isp_device_json(public.mdm_devices) from public, anon, authenticated;

create or replace function public.mdm_isp_set_zone(p_key_hash text, p_id text, p_zone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys := public._mdm_isp_key(p_key_hash);
  v_device public.mdm_devices := public._mdm_isp_device(v_key.company_id, p_id);
  v_name text := nullif(btrim(coalesce(p_zone, '')), '');
  v_zone uuid;
begin
  if v_name is not null then
    if length(v_name) > 60 then
      raise exception 'zone debe tener hasta 60 caracteres' using errcode = '22023';
    end if;
    select id into v_zone from public.mdm_zones where company_id = v_key.company_id and lower(name) = lower(v_name);
    if v_zone is null then
      if (select count(*) from public.mdm_zones where company_id = v_key.company_id) >= 200 then
        raise exception 'Máximo 200 zonas por empresa' using errcode = '54000';
      end if;
      insert into public.mdm_zones (company_id, name) values (v_key.company_id, v_name) returning id into v_zone;
    end if;
  end if;
  update public.mdm_devices set zone_id = v_zone where id = v_device.id;
  perform public._mdm_audit_as('api:' || v_key.name, v_key.company_id, 'device.zone', v_device.id::text,
    jsonb_build_object('zone', v_name, 'api_key', v_key.id));
  select * into v_device from public.mdm_devices where id = v_device.id;
  return public._mdm_isp_device_json(v_device);
end;
$$;
revoke all on function public.mdm_isp_set_zone(text, text, text) from public, anon, authenticated;
grant execute on function public.mdm_isp_set_zone(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Sync del equipo: v12 con los comunicados filtrados por zona.
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
    -- v12: comunicados vigentes, los más graves primero (v15: filtrados por zona).
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
                 -- v15: sin zonas = todos los equipos; con zonas, solo los equipos de esas zonas.
                 and (n.zone_ids is null or v_device.zone_id = any (n.zone_ids))
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
