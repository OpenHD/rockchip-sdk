-- NEX-OS MDM v9 — estados escalonados del servicio (activo → aviso → restringido → bloqueado),
-- datos de pago para la TV (teléfono y URL/QR) e historial de estados.
-- Ejecutá DESPUÉS de schema-mdm-v8.sql. Es idempotente: se puede volver a correr.
-- Diseño: docs/GESTION_REMOTA.md ("Estados del equipo" y sección v9).
--
-- Qué agrega
-- * mdm_companies: payment_restrict_days (días después del vencimiento para pasar a restringido; null = sin etapa),
--   payment_phone y payment_url (se muestran en la TV; la URL como QR).
-- * mdm_devices: restricted y restrict_reason (restricción manual: menú y red sí, apps no).
-- * mdm_device_state_log: historial de estados (panel, API del ISP y lo que informa el equipo).
-- * mdm_device_sync v9 = v8 + restricted, restrict_reason, payment.restrict_at/phone/url; attestation_eligible
--   además exige que el equipo no esté restringido (manual ni por pago).
-- * RPC mdm_set_device_restricted (panel) y mdm_isp_set_restricted (API del ISP); el JSON del equipo en la API
--   suma restricted, restrict_reason y service_state.
--
-- Prioridad del estado (igual que el equipo, sin las condiciones que solo conoce el equipo: reloj y días offline):
--   bloqueo manual > pago vencido (lock_at) > restringido manual > restringido por pago (restrict_at) > aviso (warn_at)
--   > activo.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------

-- Si payment_restrict_days >= payment_grace_days la etapa no tiene efecto (se bloquea antes o a la vez).
alter table public.mdm_companies add column if not exists payment_restrict_days int
  check (payment_restrict_days is null or payment_restrict_days between 0 and 30);
-- Charset acotado: viajan a la TV por el agente (shell + jq).
alter table public.mdm_companies add column if not exists payment_phone text
  check (payment_phone is null or payment_phone ~ '^[0-9 +()-]{5,32}$');
alter table public.mdm_companies add column if not exists payment_url text
  check (payment_url is null or (length(payment_url) <= 300
         and payment_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][A-Za-z0-9._~%/+=&?#:@,;!*-]*)?$'));

alter table public.mdm_devices add column if not exists restricted boolean not null default false;
alter table public.mdm_devices add column if not exists restrict_reason text
  check (restrict_reason is null or length(restrict_reason) <= 280);
grant select (restricted, restrict_reason) on public.mdm_devices to authenticated;

-- El equipo ahora informa también el modo 'restricted'.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.mdm_devices'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%reported_mode%'
       and pg_get_constraintdef(oid) not like '%restricted%'
  loop
    execute format('alter table public.mdm_devices drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.mdm_devices'::regclass and conname = 'mdm_devices_reported_mode_v9_check') then
    alter table public.mdm_devices add constraint mdm_devices_reported_mode_v9_check
      check (reported_mode is null or reported_mode in ('starting', 'unpaired', 'locked', 'restricted', 'active'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Historial de estados
-- ---------------------------------------------------------------------------

-- state: estado de servicio resultante. source: quién lo cambió (panel, API del ISP o el equipo al informar).
create table if not exists public.mdm_device_state_log (
  id bigserial primary key,
  device_id uuid not null references public.mdm_devices (id) on delete cascade,
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  state text not null check (state in ('active', 'warning', 'restricted', 'locked')),
  source text not null check (source in ('panel', 'api', 'device')),
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists mdm_device_state_log_device_idx on public.mdm_device_state_log (device_id, at desc);
create index if not exists mdm_device_state_log_company_idx on public.mdm_device_state_log (company_id, at desc);

alter table public.mdm_device_state_log enable row level security;

drop policy if exists mdm_device_state_log_read on public.mdm_device_state_log;
create policy mdm_device_state_log_read on public.mdm_device_state_log
  for select to authenticated using (public._mdm_company_role(company_id) is not null);

revoke all on public.mdm_device_state_log from anon, authenticated;
grant select on public.mdm_device_state_log to authenticated;
revoke all on sequence public.mdm_device_state_log_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------

-- Momentos de aviso, restricción y bloqueo por pago (null si el equipo no tiene control de pago).
-- Fin del día pagado ± días, en la zona horaria de la empresa.
create or replace function public._mdm_payment_times(p_paid_until date, p_company public.mdm_companies,
                                                     out warn_at timestamptz, out restrict_at timestamptz,
                                                     out lock_at timestamptz)
language sql
stable
set search_path = public
as $$
  select
    case when p_paid_until is not null then
      (p_paid_until + 1 - p_company.payment_warning_days)::timestamp at time zone p_company.timezone end,
    case when p_paid_until is not null and p_company.payment_restrict_days is not null
              and p_company.payment_restrict_days < p_company.payment_grace_days then
      (p_paid_until + 1 + p_company.payment_restrict_days)::timestamp at time zone p_company.timezone end,
    case when p_paid_until is not null then
      (p_paid_until + 1 + p_company.payment_grace_days)::timestamp at time zone p_company.timezone end;
$$;

-- Estado de servicio calculado en el servidor: 'locked' | 'restricted' | 'warning' | 'active'.
create or replace function public._mdm_service_state(p_device public.mdm_devices, p_company public.mdm_companies)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_device.locked then 'locked'
    when t.lock_at is not null and now() >= t.lock_at then 'locked'
    when p_device.restricted then 'restricted'
    when t.restrict_at is not null and now() >= t.restrict_at then 'restricted'
    when t.warn_at is not null and now() >= t.warn_at then 'warning'
    else 'active'
  end
  from public._mdm_payment_times(p_device.paid_until, p_company) t;
$$;

-- Escribe una fila del historial. p_state null = se calcula con el estado actual del equipo.
create or replace function public._mdm_log_state(p_device uuid, p_source text, p_details jsonb,
                                                 p_state text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.mdm_devices;
  v_company public.mdm_companies;
begin
  select * into v_device from public.mdm_devices where id = p_device;
  if v_device.company_id is null then
    return;
  end if;
  select * into v_company from public.mdm_companies where id = v_device.company_id;
  insert into public.mdm_device_state_log (device_id, company_id, state, source, details)
  values (v_device.id, v_device.company_id, coalesce(p_state, public._mdm_service_state(v_device, v_company)),
          p_source, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Valida y aplica la restricción manual. Devuelve true si cambió algo.
create or replace function public._mdm_apply_restricted(p_device uuid, p_restricted boolean, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev public.mdm_devices;
  v_reason text := case when p_restricted then nullif(left(trim(p_reason), 280), '') end;
begin
  if p_restricted is null then
    raise exception 'Falta restricted' using errcode = '22023';
  end if;
  select * into v_prev from public.mdm_devices where id = p_device for update;
  update public.mdm_devices set restricted = p_restricted, restrict_reason = v_reason where id = p_device;
  return v_prev.restricted is distinct from p_restricted or v_prev.restrict_reason is distinct from v_reason;
end;
$$;

revoke all on function public._mdm_payment_times(date, public.mdm_companies) from public, anon, authenticated;
revoke all on function public._mdm_service_state(public.mdm_devices, public.mdm_companies) from public, anon, authenticated;
revoke all on function public._mdm_log_state(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public._mdm_apply_restricted(uuid, boolean, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de equipos: mdm_device_sync v9 (misma firma; la llama la Edge Function mdm-sync)
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

  -- OTA: target de la empresa; si no tiene, el global.
  select r.* into v_release
    from public.mdm_firmware_targets t join public.mdm_firmware_releases r on r.id = t.release_id
   where t.company_id = v_company.id;
  if not found then
    select r.* into v_release
      from public.mdm_firmware_targets t join public.mdm_firmware_releases r on r.id = t.release_id
     where t.company_id is null;
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
    'restrict_reason', v_device.restrict_reason
  );
end;
$$;

revoke all on function public.mdm_device_sync(text, text, jsonb, jsonb, text) from public;
grant execute on function public.mdm_device_sync(text, text, jsonb, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de administración (authenticated + aal2)
-- ---------------------------------------------------------------------------

create or replace function public.mdm_set_device_restricted(p_device uuid, p_restricted boolean,
                                                            p_reason text default null)
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
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company);
  if public._mdm_apply_restricted(p_device, p_restricted, p_reason) then
    perform public._mdm_log_state(p_device, 'panel', jsonb_build_object(
      'change', case when p_restricted then 'restrict' else 'unrestrict' end,
      'reason', case when p_restricted then nullif(left(trim(p_reason), 280), '') end,
      'actor', public._mdm_uid()));
  end if;
  perform public._mdm_audit(v_company, case when p_restricted then 'device.restrict' else 'device.unrestrict' end,
                            p_device::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- v6 + historial de estados.
create or replace function public.mdm_set_device_lock(p_device uuid, p_locked boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_prev boolean;
begin
  select company_id, locked into v_company, v_prev from public.mdm_devices where id = p_device;
  if v_company is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company);
  update public.mdm_devices
     set locked = p_locked,
         lock_reason = case when p_locked then nullif(left(trim(p_reason), 280), '') end
   where id = p_device;
  if v_prev is distinct from p_locked then
    perform public._mdm_log_state(p_device, 'panel', jsonb_build_object(
      'change', case when p_locked then 'lock' else 'unlock' end,
      'reason', case when p_locked then nullif(left(trim(p_reason), 280), '') end,
      'actor', public._mdm_uid()));
  end if;
  perform public._mdm_audit(v_company, case when p_locked then 'device.lock' else 'device.unlock' end,
                            p_device::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- v6 + historial de estados.
create or replace function public.mdm_set_paid_until(p_device uuid, p_paid_until date, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_prev date;
begin
  select company_id, paid_until into v_company, v_prev from public.mdm_devices where id = p_device;
  if v_company is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company);
  if p_paid_until is not null and p_paid_until > current_date + interval '3 years' then
    raise exception 'Fecha demasiado lejana' using errcode = '22023';
  end if;
  update public.mdm_devices set paid_until = p_paid_until where id = p_device;
  if p_paid_until is not null then
    insert into public.mdm_payments (device_id, company_id, previous_paid_until, paid_until, note, recorded_by)
    values (p_device, v_company, v_prev, p_paid_until, nullif(left(trim(p_note), 280), ''), public._mdm_uid());
  end if;
  if v_prev is distinct from p_paid_until then
    perform public._mdm_log_state(p_device, 'panel', jsonb_build_object(
      'change', 'paid_until', 'previous', v_prev, 'paid_until', p_paid_until, 'actor', public._mdm_uid()));
  end if;
  perform public._mdm_audit(v_company, 'device.payment', p_device::text,
    jsonb_build_object('previous', v_prev, 'paid_until', p_paid_until, 'note', p_note));
end;
$$;

-- v6 + etapa restringida y datos de pago. Los parámetros nuevos tienen default: las llamadas viejas siguen andando.
--   p_payment_restrict_days: null = no cambia, -1 = sin etapa restringida, 0..30 = días tras el vencimiento.
--   p_payment_phone / p_payment_url: null = no cambia, '' = borra.
drop function if exists public.mdm_update_company(uuid, text, int, text, text, int, int, text);
create or replace function public.mdm_update_company(
  p_company uuid,
  p_lock_message text,
  p_offline_lock_days int,
  p_logo_path text,
  p_payment_message text default null,
  p_payment_grace_days int default null,
  p_payment_warning_days int default null,
  p_timezone text default null,
  p_payment_restrict_days int default null,
  p_payment_phone text default null,
  p_payment_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := trim(p_payment_phone);
  v_url text := trim(p_payment_url);
begin
  perform public._mdm_require_role(p_company);
  -- El logo solo puede apuntar a la carpeta de la propia empresa en el bucket.
  if p_logo_path is not null and split_part(p_logo_path, '/', 1) <> p_company::text then
    raise exception 'Ruta de logo inválida' using errcode = '22023';
  end if;
  if p_timezone is not null and not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Zona horaria inválida' using errcode = '22023';
  end if;
  if p_payment_restrict_days is not null and p_payment_restrict_days <> -1
     and p_payment_restrict_days not between 0 and 30 then
    raise exception 'Días hasta restringir inválidos (0 a 30, o vacío para no restringir)' using errcode = '22023';
  end if;
  if v_phone <> '' and v_phone !~ '^[0-9 +()-]{5,32}$' then
    raise exception 'Teléfono de pago inválido (5 a 32 caracteres: números, espacios, + ( ) -)' using errcode = '22023';
  end if;
  if v_url <> '' and (length(v_url) > 300
      or v_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][A-Za-z0-9._~%/+=&?#:@,;!*-]*)?$') then
    raise exception 'URL de pago inválida (https://, hasta 300 caracteres, sin espacios ni comillas)' using errcode = '22023';
  end if;
  update public.mdm_companies
     set lock_message = coalesce(nullif(trim(p_lock_message), ''), lock_message),
         offline_lock_days = coalesce(p_offline_lock_days, offline_lock_days),
         logo_path = p_logo_path,
         payment_message = coalesce(nullif(trim(p_payment_message), ''), payment_message),
         payment_grace_days = coalesce(p_payment_grace_days, payment_grace_days),
         payment_warning_days = coalesce(p_payment_warning_days, payment_warning_days),
         timezone = coalesce(p_timezone, timezone),
         payment_restrict_days = case when p_payment_restrict_days is null then payment_restrict_days
                                      when p_payment_restrict_days = -1 then null
                                      else p_payment_restrict_days end,
         payment_phone = case when p_payment_phone is null then payment_phone else nullif(v_phone, '') end,
         payment_url = case when p_payment_url is null then payment_url else nullif(v_url, '') end
   where id = p_company;
  perform public._mdm_audit(p_company, 'company.update', p_company::text,
    jsonb_build_object('offline_lock_days', p_offline_lock_days, 'logo_path', p_logo_path,
                       'payment_restrict_days', p_payment_restrict_days,
                       'payment_phone', p_payment_phone, 'payment_url', p_payment_url));
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'mdm_set_device_restricted(uuid, boolean, text)',
    'mdm_set_device_lock(uuid, boolean, text)',
    'mdm_set_paid_until(uuid, date, text)',
    'mdm_update_company(uuid, text, int, text, text, int, int, text, int, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- API para ISP (solo service_role, desde la Edge Function isp-api)
-- ---------------------------------------------------------------------------

-- v8 + restricted, restrict_reason y service_state.
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
                        from public.mdm_companies c where c.id = p_device.company_id)
  );
$$;

create or replace function public.mdm_isp_set_restricted(p_key_hash text, p_id text, p_restricted boolean,
                                                         p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys := public._mdm_isp_key(p_key_hash);
  v_device public.mdm_devices := public._mdm_isp_device(v_key.company_id, p_id);
begin
  if public._mdm_apply_restricted(v_device.id, p_restricted, p_reason) then
    perform public._mdm_log_state(v_device.id, 'api', jsonb_build_object(
      'change', case when p_restricted then 'restrict' else 'unrestrict' end,
      'reason', case when p_restricted then nullif(left(trim(p_reason), 280), '') end,
      'actor', 'api:' || v_key.name));
  end if;
  perform public._mdm_audit_as('api:' || v_key.name, v_key.company_id,
    case when p_restricted then 'device.restrict' else 'device.unrestrict' end, v_device.id::text,
    jsonb_build_object('reason', p_reason, 'api_key', v_key.id));
  select * into v_device from public.mdm_devices where id = v_device.id;
  return public._mdm_isp_device_json(v_device);
end;
$$;

-- v8 + historial de estados.
create or replace function public.mdm_isp_set_lock(p_key_hash text, p_id text, p_locked boolean,
                                                   p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys := public._mdm_isp_key(p_key_hash);
  v_device public.mdm_devices := public._mdm_isp_device(v_key.company_id, p_id);
  v_prev boolean := v_device.locked;
begin
  if p_locked is null then
    raise exception 'Falta locked' using errcode = '22023';
  end if;
  update public.mdm_devices
     set locked = p_locked,
         lock_reason = case when p_locked then nullif(left(trim(p_reason), 280), '') end
   where id = v_device.id
  returning * into v_device;
  if v_prev is distinct from p_locked then
    perform public._mdm_log_state(v_device.id, 'api', jsonb_build_object(
      'change', case when p_locked then 'lock' else 'unlock' end,
      'reason', v_device.lock_reason,
      'actor', 'api:' || v_key.name));
  end if;
  perform public._mdm_audit_as('api:' || v_key.name, v_key.company_id,
    case when p_locked then 'device.lock' else 'device.unlock' end, v_device.id::text,
    jsonb_build_object('reason', p_reason, 'api_key', v_key.id));
  return public._mdm_isp_device_json(v_device);
end;
$$;

-- v8 + historial de estados.
create or replace function public.mdm_isp_set_paid_until(p_key_hash text, p_id text, p_paid_until date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys := public._mdm_isp_key(p_key_hash);
  v_device public.mdm_devices := public._mdm_isp_device(v_key.company_id, p_id);
  v_prev date := v_device.paid_until;
begin
  if p_paid_until is not null and p_paid_until > current_date + interval '3 years' then
    raise exception 'Fecha demasiado lejana' using errcode = '22023';
  end if;
  update public.mdm_devices set paid_until = p_paid_until where id = v_device.id returning * into v_device;
  if p_paid_until is not null then
    insert into public.mdm_payments (device_id, company_id, previous_paid_until, paid_until, note, recorded_by)
    values (v_device.id, v_key.company_id, v_prev, p_paid_until, left('api:' || v_key.name, 280), null);
  end if;
  if v_prev is distinct from p_paid_until then
    perform public._mdm_log_state(v_device.id, 'api', jsonb_build_object(
      'change', 'paid_until', 'previous', v_prev, 'paid_until', p_paid_until, 'actor', 'api:' || v_key.name));
  end if;
  perform public._mdm_audit_as('api:' || v_key.name, v_key.company_id, 'device.payment', v_device.id::text,
    jsonb_build_object('previous', v_prev, 'paid_until', p_paid_until, 'api_key', v_key.id));
  return public._mdm_isp_device_json(v_device);
end;
$$;

revoke all on function public._mdm_isp_device_json(public.mdm_devices) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'mdm_isp_set_restricted(text, text, boolean, text)',
    'mdm_isp_set_lock(text, text, boolean, text)',
    'mdm_isp_set_paid_until(text, text, date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retención: v7 + historial de estados (1 año).
-- ---------------------------------------------------------------------------

create or replace function public.mdm_purge_old_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.mdm_device_events where created_at < now() - interval '180 days';
  delete from public.mdm_notifications where created_at < now() - interval '30 days';
  delete from public.mdm_device_state_log where at < now() - interval '365 days';
$$;
revoke all on function public.mdm_purge_old_events() from public, anon, authenticated;
grant execute on function public.mdm_purge_old_events() to service_role;

-- ---------------------------------------------------------------------------
-- Comprobación final (igual que v8): ningún secreto legible por anon/authenticated.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('public.mdm_devices', 'unlock_secret'),
      ('public.mdm_devices', 'token_hash'),
      ('public.mdm_devices', 'hardware_id'),
      ('public.mdm_api_keys', 'key_hash')
    ) as t(tbl, col)
  loop
    if has_column_privilege('anon', r.tbl, r.col, 'select')
       or has_column_privilege('authenticated', r.tbl, r.col, 'select') then
      raise exception 'Permiso inseguro: %.% es legible por anon/authenticated', r.tbl, r.col;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.mdm_device_state_log', 'select')
     or has_table_privilege('authenticated', 'public.mdm_device_state_log', 'insert') then
    raise exception 'Permiso inseguro en mdm_device_state_log';
  end if;
end;
$$;
