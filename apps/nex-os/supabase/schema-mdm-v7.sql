-- NEX-OS MDM v7 — el sistema informa: estado real del equipo, eventos, alertas (panel, Telegram, email)
-- y re-enrolamiento por hardware (un equipo reflasheado vuelve solo a su empresa y conserva el bloqueo).
-- Ejecutá DESPUÉS de schema-mdm-v6.sql. Es idempotente.
--
-- Flujo de avisos:
--   equipo → mdm_device_sync(p_status, p_events) → mdm_device_events → trigger → mdm_notifications (outbox)
--   Edge Function mdm-notify (cron cada minuto) → Telegram / email → marca enviado.

-- ---------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------

alter table public.mdm_devices add column if not exists hardware_id text
  check (hardware_id is null or hardware_id ~ '^[0-9a-f]{64}$');
alter table public.mdm_devices add column if not exists health jsonb not null default '{}'::jsonb;
alter table public.mdm_devices add column if not exists reported_mode text
  check (reported_mode is null or reported_mode in ('starting', 'unpaired', 'locked', 'active'));
alter table public.mdm_devices add column if not exists reported_lock_kind text;
alter table public.mdm_devices add column if not exists reported_at timestamptz;
alter table public.mdm_devices add column if not exists offline_alerted_at timestamptz;
create unique index if not exists mdm_devices_hardware_idx on public.mdm_devices (hardware_id)
  where hardware_id is not null;

alter table public.mdm_companies add column if not exists alert_telegram_chat_id text
  check (alert_telegram_chat_id is null or alert_telegram_chat_id ~ '^-?[0-9]{1,20}$');
alter table public.mdm_companies add column if not exists alert_emails text[] not null default '{}'
  check (cardinality(alert_emails) <= 5);
alter table public.mdm_companies add column if not exists alert_offline_hours int not null default 24
  check (alert_offline_hours between 1 and 720);
alter table public.mdm_companies add column if not exists alert_kinds text[] not null
  default array['lock_applied', 'unlock_applied', 'tamper', 'offline', 'piracy'];
alter table public.mdm_companies add column if not exists alert_digest boolean not null default true;

-- ---------------------------------------------------------------------------
-- Eventos y outbox de notificaciones
-- ---------------------------------------------------------------------------

-- kind: evento puntual. category: agrupa para las preferencias de aviso de la empresa.
create table if not exists public.mdm_device_events (
  id bigint generated always as identity primary key,
  device_id uuid references public.mdm_devices (id) on delete cascade,
  company_id uuid references public.mdm_companies (id) on delete cascade,
  kind text not null,
  category text not null check (category in ('lock_applied', 'unlock_applied', 'tamper', 'offline', 'piracy', 'info', 'test')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  details jsonb not null default '{}'::jsonb,
  device_time timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mdm_device_events_company_idx on public.mdm_device_events (company_id, created_at desc);
create index if not exists mdm_device_events_device_idx on public.mdm_device_events (device_id, created_at desc);

create table if not exists public.mdm_notifications (
  id bigint generated always as identity primary key,
  event_id bigint references public.mdm_device_events (id) on delete cascade,
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  channel text not null check (channel in ('telegram', 'email')),
  -- 'sending' = tomada por un worker (evita envíos duplicados si dos crons se superponen).
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  subject text,
  body text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.mdm_notifications add column if not exists claimed_at timestamptz;
alter table public.mdm_notifications drop constraint if exists mdm_notifications_status_check;
alter table public.mdm_notifications add constraint mdm_notifications_status_check
  check (status in ('pending', 'sending', 'sent', 'failed'));
create index if not exists mdm_notifications_pending_idx on public.mdm_notifications (status, created_at)
  where status = 'pending';

alter table public.mdm_device_events enable row level security;
alter table public.mdm_notifications enable row level security;

drop policy if exists mdm_device_events_read on public.mdm_device_events;
create policy mdm_device_events_read on public.mdm_device_events
  for select to authenticated
  using (company_id is not null and public._mdm_company_role(company_id) is not null);

drop policy if exists mdm_notifications_read on public.mdm_notifications;
create policy mdm_notifications_read on public.mdm_notifications
  for select to authenticated using (public._mdm_company_role(company_id) is not null);

revoke all on public.mdm_device_events, public.mdm_notifications from anon;
revoke insert, update, delete on public.mdm_device_events, public.mdm_notifications from authenticated;

-- Las columnas nuevas de equipos son legibles por los admins (hardware_id no: es un identificador de hardware).
grant select (health, reported_mode, reported_lock_kind, reported_at, offline_alerted_at)
  on public.mdm_devices to authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo de eventos: el equipo solo puede reportar estos tipos (lo demás se descarta).
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
      ('test',                'test',           'info',     'Aviso de prueba')
    ) as m(kind, category, severity, label)
   where m.kind = p_kind;
$$;

-- Inserta un evento (uso interno: equipo, cron o admin).
create or replace function public._mdm_add_event(p_device uuid, p_company uuid, p_kind text, p_details jsonb,
                                                 p_device_time timestamptz default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta record;
  v_id bigint;
begin
  select * into v_meta from public._mdm_event_meta(p_kind);
  if v_meta.category is null then
    return null;
  end if;
  insert into public.mdm_device_events (device_id, company_id, kind, category, severity, details, device_time)
  values (p_device, p_company, p_kind, v_meta.category, v_meta.severity, coalesce(p_details, '{}'::jsonb), p_device_time)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public._mdm_add_event(uuid, uuid, text, jsonb, timestamptz) from public, anon, authenticated;

-- Encola avisos según las preferencias de la empresa. El texto se arma acá (texto plano, sin HTML).
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

drop trigger if exists mdm_device_events_notify on public.mdm_device_events;
create trigger mdm_device_events_notify after insert on public.mdm_device_events
  for each row execute function public._mdm_queue_notifications();

-- ---------------------------------------------------------------------------
-- RPC de equipos (reemplazan a las de v6)
-- ---------------------------------------------------------------------------

drop function if exists public.mdm_device_register(text, text);
drop function if exists public.mdm_device_sync(text, text);

-- Alta o re-enrolamiento. Si el hardware ya pertenece a una empresa (reflasheo o reset),
-- el token nuevo reemplaza al viejo y el equipo conserva empresa, nombre, bloqueo y pagos.
create or replace function public.mdm_device_register(p_token text, p_firmware text default null,
                                                      p_hardware_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public._mdm_token_hash(p_token);
  v_hw text := case when p_hardware_id ~ '^[0-9a-f]{64}$' then p_hardware_id end;
  v_device public.mdm_devices;
  v_code text;
  v_expires timestamptz := now() + interval '15 minutes';
begin
  select * into v_device from public.mdm_devices where token_hash = v_hash;

  if not found and v_hw is not null then
    select * into v_device from public.mdm_devices where hardware_id = v_hw;
    if found then
      if public._mdm_rate_limited('reenroll', v_hw, 10, interval '1 day') then
        raise exception 'Demasiados re-enrolamientos de este equipo' using errcode = '53400';
      end if;
      update public.mdm_devices
         set token_hash = v_hash, firmware_version = coalesce(left(p_firmware, 64), firmware_version)
       where id = v_device.id
      returning * into v_device;
      if v_device.company_id is not null then
        perform public._mdm_add_event(v_device.id, v_device.company_id, 'reflashed',
          jsonb_build_object('firmware', p_firmware, 'locked', v_device.locked));
      end if;
    end if;
  end if;

  if v_device.id is null then
    if public._mdm_rate_limited('register', 'global', 120, interval '1 minute') then
      raise exception 'Demasiadas altas, reintentá en un minuto' using errcode = '53400';
    end if;
    delete from public.mdm_devices
     where company_id is null and paired_at is null and created_at < now() - interval '2 days';
    insert into public.mdm_devices (token_hash, firmware_version, hardware_id)
    values (v_hash, left(p_firmware, 64), v_hw)
    returning * into v_device;
  elsif v_device.hardware_id is null and v_hw is not null
        and not exists (select 1 from public.mdm_devices where hardware_id = v_hw) then
    update public.mdm_devices set hardware_id = v_hw where id = v_device.id;
  end if;

  if v_device.company_id is not null then
    return jsonb_build_object('status', 'paired');
  end if;

  select code into v_code from public.mdm_pairing_codes
   where device_id = v_device.id and expires_at > now() + interval '1 minute';

  if v_code is null then
    delete from public.mdm_pairing_codes where device_id = v_device.id or expires_at < now();
    loop
      v_code := public._mdm_new_pairing_code();
      begin
        insert into public.mdm_pairing_codes (code, device_id, expires_at)
        values (v_code, v_device.id, v_expires);
        exit;
      exception when unique_violation then
      end;
    end loop;
  else
    select expires_at into v_expires from public.mdm_pairing_codes where code = v_code;
  end if;

  return jsonb_build_object(
    'status', 'unpaired',
    'pairing_code', v_code,
    'pairing_expires_at', v_expires,
    'server_time', now(),
    'server_epoch', extract(epoch from now())::bigint
  );
end;
$$;

-- Sync: además de devolver la configuración, guarda el estado real que informa el equipo
-- (p_status) y sus eventos (p_events: [{"kind": "...", "at": epoch, "details": {...}}]).
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
         reported_mode = case when v_mode in ('starting', 'unpaired', 'locked', 'active') then v_mode else reported_mode end,
         reported_lock_kind = case when v_mode is not null then left(p_status ->> 'lock_kind', 16) else reported_lock_kind end,
         reported_at = case when v_mode is not null then now() else reported_at end,
         offline_alerted_at = null
   where id = v_device.id;

  if v_device.company_id is not null then
    if v_device.offline_alerted_at is not null then
      perform public._mdm_add_event(v_device.id, v_device.company_id, 'back_online',
        jsonb_build_object('offline_since', v_device.last_seen_at));
    end if;
    if jsonb_typeof(p_events) = 'array'
       and not public._mdm_rate_limited('events', v_device.id::text, 120, interval '1 hour') then
      for v_item in select * from jsonb_array_elements(p_events) limit 30 loop
        continue when jsonb_typeof(v_item) <> 'object' or v_item ->> 'kind' is null;
        -- Eventos que solo genera el servidor no se aceptan desde el equipo.
        continue when v_item ->> 'kind' in ('reflashed', 'offline', 'back_online', 'piracy_attempt', 'test');
        v_at := case when (v_item ->> 'at') ~ '^[0-9]{9,11}$' then to_timestamp((v_item ->> 'at')::bigint) end;
        perform public._mdm_add_event(v_device.id, v_device.company_id, v_item ->> 'kind',
          case when jsonb_typeof(v_item -> 'details') = 'object' and length((v_item -> 'details')::text) <= 512
               then v_item -> 'details' else '{}'::jsonb end,
          v_at);
      end loop;
    end if;
  end if;

  if v_device.company_id is null then
    return public.mdm_device_register(p_token, p_firmware, p_hardware_id);
  end if;

  select * into v_company from public.mdm_companies where id = v_device.company_id;

  return jsonb_build_object(
    'status', 'paired',
    'server_time', now(),
    'server_epoch', extract(epoch from now())::bigint,
    'payment', case when v_device.paid_until is null then null else jsonb_build_object(
      'paid_until', v_device.paid_until,
      'lock_at', extract(epoch from (
          (v_device.paid_until + 1 + v_company.payment_grace_days)::timestamp
          at time zone v_company.timezone))::bigint,
      'warn_at', extract(epoch from (
          (v_device.paid_until + 1 - v_company.payment_warning_days)::timestamp
          at time zone v_company.timezone))::bigint,
      'message', v_company.payment_message
    ) end,
    'device', jsonb_build_object('id', v_device.id, 'name', v_device.name),
    'locked', v_device.locked,
    'lock_reason', v_device.lock_reason,
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'lock_message', v_company.lock_message,
      'offline_lock_days', v_company.offline_lock_days,
      'logo_path', v_company.logo_path
    ),
    'apps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.name, 'kind', a.kind, 'launch_url', a.launch_url,
               'icon_url', a.icon_url, 'domains', to_jsonb(a.domains)) order by a.name)
        from public.mdm_company_apps ca
        join public.mdm_app_catalog a on a.id = ca.app_id
       where ca.company_id = v_company.id and ca.enabled and a.active
    ), '[]'::jsonb),
    'blocked_domains', coalesce((
      select jsonb_agg(c.domain order by c.domain)
        from public.mdm_domain_classifications c where c.status = 'pirateria'
    ), '[]'::jsonb)
  );
end;
$$;

-- Reporte de bloqueos: igual que v6, pero si el dominio es pirata conocido genera un evento
-- (uno por equipo, dominio y día: la primera vez que aparece en el día).
create or replace function public.mdm_device_report(p_token text, p_events jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public._mdm_token_hash(p_token);
  v_device public.mdm_devices;
  v_count int := 0;
  v_item jsonb;
  v_domain text;
  v_hits int;
  v_inserted boolean;
begin
  select * into v_device from public.mdm_devices where token_hash = v_hash;
  if not found or v_device.company_id is null then
    return 0;
  end if;
  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'Formato de reporte inválido' using errcode = '22023';
  end if;
  if public._mdm_rate_limited('report', v_device.id::text, 30, interval '1 hour') then
    return 0;
  end if;

  for v_item in select * from jsonb_array_elements(p_events) limit 200 loop
    v_domain := lower(rtrim(v_item ->> 'domain', '.'));
    v_hits := least(greatest(coalesce((v_item ->> 'hits')::int, 1), 1), 10000);
    continue when not public._mdm_valid_domain(v_domain);
    insert into public.mdm_blocked_attempts (device_id, company_id, domain, hits)
    values (v_device.id, v_device.company_id, v_domain, v_hits)
    on conflict (device_id, domain, day)
      do update set hits = least(public.mdm_blocked_attempts.hits + excluded.hits, 1000000),
                    last_seen_at = now()
    returning (xmax = 0) into v_inserted;
    if v_inserted and exists (
      select 1 from public.mdm_domain_classifications c
       where c.status = 'pirateria' and (v_domain = c.domain or v_domain like '%.' || c.domain)
    ) then
      perform public._mdm_add_event(v_device.id, v_device.company_id, 'piracy_attempt',
        jsonb_build_object('domain', v_domain));
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.mdm_device_register(text, text, text) from public;
revoke all on function public.mdm_device_sync(text, text, jsonb, jsonb, text) from public;
grant execute on function public.mdm_device_register(text, text, text) to anon, authenticated;
grant execute on function public.mdm_device_sync(text, text, jsonb, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tareas periódicas (las llama la Edge Function mdm-notify con service_role)
-- ---------------------------------------------------------------------------

-- Marca equipos sin conexión según el umbral de cada empresa (una alerta por corte).
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
  return v_count;
end;
$$;

-- Resumen diario de intentos de piratería por empresa (para el aviso diario).
create or replace function public.mdm_piracy_digest()
returns table (company_id uuid, body text)
language sql
stable
security definer
set search_path = public
as $$
  with hits as (
    select b.company_id, coalesce(d.name, left(d.id::text, 8)) as device, b.domain, sum(b.hits) as hits
      from public.mdm_blocked_attempts b
      join public.mdm_devices d on d.id = b.device_id
      join public.mdm_domain_classifications c
        on c.status = 'pirateria' and (b.domain = c.domain or b.domain like '%.' || c.domain)
     where b.last_seen_at > now() - interval '24 hours'
     group by b.company_id, d.name, d.id, b.domain
  )
  select h.company_id,
         E'🏴‍☠️ Intentos de piratería (últimas 24 h)\n' ||
         string_agg(format('• %s → %s (%s)', h.device, h.domain, h.hits), E'\n' order by h.hits desc)
    from hits h
    join public.mdm_companies co on co.id = h.company_id
   where co.alert_digest
   group by h.company_id;
$$;

revoke all on function public.mdm_check_offline() from public, anon, authenticated;
revoke all on function public.mdm_piracy_digest() from public, anon, authenticated;
grant execute on function public.mdm_check_offline() to service_role;
grant execute on function public.mdm_piracy_digest() to service_role;

-- ---------------------------------------------------------------------------
-- RPC de administración
-- ---------------------------------------------------------------------------

create or replace function public.mdm_update_alerts(
  p_company uuid,
  p_telegram_chat_id text,
  p_emails text[],
  p_offline_hours int,
  p_kinds text[],
  p_digest boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emails text[];
begin
  perform public._mdm_require_role(p_company);
  select coalesce(array_agg(distinct lower(trim(e))), '{}') into v_emails
    from unnest(coalesce(p_emails, '{}')) e where trim(e) <> '';
  if cardinality(v_emails) > 5 then
    raise exception 'Máximo 5 emails' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_emails) e where e !~ '^[^@\s]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,63}$') then
    raise exception 'Hay emails inválidos' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_kinds, '{}')) k
              where k not in ('lock_applied', 'unlock_applied', 'tamper', 'offline', 'piracy')) then
    raise exception 'Tipo de aviso inválido' using errcode = '22023';
  end if;
  update public.mdm_companies
     set alert_telegram_chat_id = nullif(trim(p_telegram_chat_id), ''),
         alert_emails = v_emails,
         alert_offline_hours = coalesce(p_offline_hours, alert_offline_hours),
         alert_kinds = coalesce(p_kinds, alert_kinds),
         alert_digest = coalesce(p_digest, alert_digest)
   where id = p_company;
  perform public._mdm_audit(p_company, 'alerts.update', p_company::text,
    jsonb_build_object('telegram', p_telegram_chat_id is not null, 'emails', cardinality(v_emails)));
end;
$$;

create or replace function public.mdm_send_test_alert(p_company uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  if public._mdm_rate_limited('test-alert', p_company::text, 5, interval '1 hour') then
    raise exception 'Demasiadas pruebas, esperá un rato' using errcode = '53400';
  end if;
  perform public._mdm_add_event(null, p_company, 'test', jsonb_build_object('by', public._mdm_uid()));
end;
$$;

revoke all on function public.mdm_update_alerts(uuid, text, text[], int, text[], boolean) from public, anon;
revoke all on function public.mdm_send_test_alert(uuid) from public, anon;
grant execute on function public.mdm_update_alerts(uuid, text, text[], int, text[], boolean) to authenticated;
grant execute on function public.mdm_send_test_alert(uuid) to authenticated;

-- Retención de eventos y notificaciones.
create or replace function public.mdm_purge_old_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.mdm_device_events where created_at < now() - interval '180 days';
  delete from public.mdm_notifications where created_at < now() - interval '30 days';
$$;
revoke all on function public.mdm_purge_old_events() from public, anon, authenticated;
grant execute on function public.mdm_purge_old_events() to service_role;

-- ---------------------------------------------------------------------------
-- Programación (pg_cron + pg_net). Completá <PROYECTO> y <MDM_CRON_SECRET> y ejecutá una vez.
-- ---------------------------------------------------------------------------
-- select cron.schedule('mdm-notify-tick', '* * * * *', $cron$
--   select net.http_post(
--     url := 'https://<PROYECTO>.supabase.co/functions/v1/mdm-notify?job=tick',
--     headers := jsonb_build_object('x-mdm-cron-secret', '<MDM_CRON_SECRET>'));
-- $cron$);
-- select cron.schedule('mdm-notify-digest', '0 12 * * *', $cron$
--   select net.http_post(
--     url := 'https://<PROYECTO>.supabase.co/functions/v1/mdm-notify?job=digest',
--     headers := jsonb_build_object('x-mdm-cron-secret', '<MDM_CRON_SECRET>'));
-- $cron$);
