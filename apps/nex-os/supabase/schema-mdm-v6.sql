-- NEX-OS MDM — gestión remota de TV box (bloqueo, lista blanca de apps, logo por empresa)
-- Ejecutá UNA VEZ en Supabase SQL Editor. Es idempotente: se puede volver a correr.
-- Diseño: docs/GESTION_REMOTA.md
--
-- Modelo de seguridad
-- * Ninguna tabla tiene policies de INSERT/UPDATE/DELETE para anon/authenticated:
--   toda escritura pasa por funciones security definer que validan rol y dejan auditoría.
-- * Los usuarios anónimos de Supabase (is_anonymous) nunca tienen permisos de admin,
--   y los admins necesitan sesión con segundo factor (aal2). Activá MFA TOTP en
--   Authentication → Multi-Factor del proyecto.
-- * Los TV box no tienen usuario de Supabase: se autentican con un token de 256 bits
--   generado en el equipo. El servidor solo guarda sha256(token).
-- * Las funciones de equipo (mdm_device_*) son las únicas expuestas a anon.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.mdm_super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.mdm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  offline_lock_days int not null default 7 check (offline_lock_days between 1 and 90),
  lock_message text not null default 'Este equipo está bloqueado. Contactá a tu proveedor.'
    check (length(lock_message) <= 280),
  logo_path text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  -- Cobro mensual (modelo "equipo financiado"): el equipo se bloquea solo al vencer el pago.
  timezone text not null default 'America/Argentina/Buenos_Aires',
  payment_grace_days int not null default 0 check (payment_grace_days between 0 and 30),
  payment_warning_days int not null default 5 check (payment_warning_days between 0 and 30),
  payment_message text not null default 'Tu pago está vencido. Regularizalo para seguir usando el equipo.'
    check (length(payment_message) <= 280),
  created_at timestamptz not null default now()
);
-- Migración desde una versión previa de este script.
alter table public.mdm_companies add column if not exists timezone text not null default 'America/Argentina/Buenos_Aires';
alter table public.mdm_companies add column if not exists payment_grace_days int not null default 0;
alter table public.mdm_companies add column if not exists payment_warning_days int not null default 5;
alter table public.mdm_companies add column if not exists payment_message text not null
  default 'Tu pago está vencido. Regularizalo para seguir usando el equipo.';

create table if not exists public.mdm_members (
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table if not exists public.mdm_devices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.mdm_companies (id) on delete set null,
  name text check (name is null or length(name) <= 80),
  token_hash text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  locked boolean not null default false,
  lock_reason text check (lock_reason is null or length(lock_reason) <= 280),
  firmware_version text check (firmware_version is null or length(firmware_version) <= 64),
  last_seen_at timestamptz,
  paired_at timestamptz,
  -- null = equipo sin control de pago. Último día cubierto (inclusive, en la zona de la empresa).
  paid_until date,
  created_at timestamptz not null default now()
);
alter table public.mdm_devices add column if not exists paid_until date;
create index if not exists mdm_devices_company_idx on public.mdm_devices (company_id);

create table if not exists public.mdm_pairing_codes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  device_id uuid not null unique references public.mdm_devices (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Catálogo global (lo mantiene NEX). kind = 'web' abre launch_url; 'internal' es un appId de NEX-OS.
-- Historial de pagos registrados (comprobante interno de quién extendió qué).
create table if not exists public.mdm_payments (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.mdm_devices (id) on delete cascade,
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  previous_paid_until date,
  paid_until date not null,
  note text check (note is null or length(note) <= 280),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mdm_payments_device_idx on public.mdm_payments (device_id, created_at desc);

create table if not exists public.mdm_app_catalog (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null check (length(name) between 1 and 60),
  kind text not null check (kind in ('web', 'internal')),
  launch_url text check (launch_url is null or (launch_url ~ '^https://[^\s]+$' and length(launch_url) <= 500)),
  icon_url text check (icon_url is null or (icon_url ~ '^https://[^\s]+$' and length(icon_url) <= 500)),
  domains text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind = 'internal' or launch_url is not null)
);

create table if not exists public.mdm_company_apps (
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  app_id text not null references public.mdm_app_catalog (id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (company_id, app_id)
);

-- Intentos bloqueados agregados por equipo/dominio/día (solo dominio, nunca URL).
create table if not exists public.mdm_blocked_attempts (
  device_id uuid not null references public.mdm_devices (id) on delete cascade,
  company_id uuid references public.mdm_companies (id) on delete set null,
  domain text not null,
  day date not null default current_date,
  hits int not null default 1,
  last_seen_at timestamptz not null default now(),
  primary key (device_id, domain, day)
);
create index if not exists mdm_blocked_attempts_domain_idx on public.mdm_blocked_attempts (domain);

create table if not exists public.mdm_domain_classifications (
  domain text primary key,
  status text not null check (status in ('pirateria', 'legitimo', 'ignorar')),
  note text check (note is null or length(note) <= 280),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz not null default now()
);

create table if not exists public.mdm_audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id) on delete set null,
  company_id uuid references public.mdm_companies (id) on delete set null,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mdm_audit_log_company_idx on public.mdm_audit_log (company_id, created_at desc);

-- Rate limiting de intentos de vinculación (fuerza bruta de códigos) y de altas anónimas.
create table if not exists public.mdm_rate_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  subject text not null,
  created_at timestamptz not null default now()
);
create index if not exists mdm_rate_events_idx on public.mdm_rate_events (bucket, subject, created_at);

-- ---------------------------------------------------------------------------
-- RLS: lectura acotada, escritura solo por RPC
-- ---------------------------------------------------------------------------

alter table public.mdm_super_admins enable row level security;
alter table public.mdm_companies enable row level security;
alter table public.mdm_members enable row level security;
alter table public.mdm_devices enable row level security;
alter table public.mdm_pairing_codes enable row level security;
alter table public.mdm_app_catalog enable row level security;
alter table public.mdm_payments enable row level security;
alter table public.mdm_company_apps enable row level security;
alter table public.mdm_blocked_attempts enable row level security;
alter table public.mdm_domain_classifications enable row level security;
alter table public.mdm_audit_log enable row level security;
alter table public.mdm_rate_events enable row level security;

create or replace function public._mdm_uid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Usuarios anónimos nunca cuentan como admin, y toda acción de administración
  -- exige sesión con segundo factor (TOTP, aal2): bloquear equipos de clientes es crítico.
  select case
    when coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then null
    when coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then null
    else auth.uid()
  end;
$$;

create or replace function public.mdm_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.mdm_super_admins s where s.user_id = public._mdm_uid());
$$;

create or replace function public._mdm_company_role(p_company uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.mdm_is_super_admin() then 'super'
    else (select m.role from public.mdm_members m
          where m.company_id = p_company and m.user_id = public._mdm_uid())
  end;
$$;

revoke all on function public._mdm_uid() from public, anon;
revoke all on function public._mdm_company_role(uuid) from public, anon;
grant execute on function public._mdm_uid() to authenticated;
grant execute on function public._mdm_company_role(uuid) to authenticated;
grant execute on function public.mdm_is_super_admin() to authenticated;

drop policy if exists mdm_companies_read on public.mdm_companies;
create policy mdm_companies_read on public.mdm_companies
  for select to authenticated using (public._mdm_company_role(id) is not null);

drop policy if exists mdm_members_read on public.mdm_members;
create policy mdm_members_read on public.mdm_members
  for select to authenticated using (public._mdm_company_role(company_id) is not null);

drop policy if exists mdm_devices_read on public.mdm_devices;
create policy mdm_devices_read on public.mdm_devices
  for select to authenticated
  using (company_id is not null and public._mdm_company_role(company_id) is not null);

drop policy if exists mdm_payments_read on public.mdm_payments;
create policy mdm_payments_read on public.mdm_payments
  for select to authenticated using (public._mdm_company_role(company_id) is not null);

drop policy if exists mdm_catalog_read on public.mdm_app_catalog;
create policy mdm_catalog_read on public.mdm_app_catalog
  for select to authenticated using (true);

drop policy if exists mdm_company_apps_read on public.mdm_company_apps;
create policy mdm_company_apps_read on public.mdm_company_apps
  for select to authenticated using (public._mdm_company_role(company_id) is not null);

drop policy if exists mdm_blocked_read on public.mdm_blocked_attempts;
create policy mdm_blocked_read on public.mdm_blocked_attempts
  for select to authenticated
  using (public.mdm_is_super_admin()
         or (company_id is not null and public._mdm_company_role(company_id) is not null));

drop policy if exists mdm_classifications_read on public.mdm_domain_classifications;
create policy mdm_classifications_read on public.mdm_domain_classifications
  for select to authenticated using (public.mdm_is_super_admin());

drop policy if exists mdm_audit_read on public.mdm_audit_log;
create policy mdm_audit_read on public.mdm_audit_log
  for select to authenticated
  using (public.mdm_is_super_admin()
         or (company_id is not null and public._mdm_company_role(company_id) is not null));

-- El hash del token nunca sale de la base, ni siquiera hacia admins.
revoke all on public.mdm_devices from anon, authenticated;
grant select (id, company_id, name, locked, lock_reason, firmware_version, last_seen_at, paired_at, paid_until, created_at)
  on public.mdm_devices to authenticated;

revoke all on public.mdm_pairing_codes, public.mdm_rate_events, public.mdm_super_admins
  from anon, authenticated;
revoke insert, update, delete on public.mdm_payments from anon, authenticated;
revoke all on public.mdm_payments from anon;
revoke insert, update, delete on public.mdm_companies, public.mdm_members, public.mdm_app_catalog,
  public.mdm_company_apps, public.mdm_blocked_attempts, public.mdm_domain_classifications,
  public.mdm_audit_log from anon, authenticated;
revoke all on public.mdm_companies, public.mdm_members, public.mdm_app_catalog,
  public.mdm_company_apps, public.mdm_blocked_attempts, public.mdm_domain_classifications,
  public.mdm_audit_log from anon;

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------

create or replace function public._mdm_require_role(p_company uuid, p_owner_only boolean default false)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public._mdm_company_role(p_company);
begin
  if v_role is null or (p_owner_only and v_role not in ('owner', 'super')) then
    raise exception 'Sin permiso sobre esta empresa' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

create or replace function public._mdm_audit(p_company uuid, p_action text, p_target text, p_details jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.mdm_audit_log (actor, company_id, action, target, details)
  values (public._mdm_uid(), p_company, p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;

-- true si el sujeto superó p_max eventos en la ventana; registra el evento si no.
create or replace function public._mdm_rate_limited(p_bucket text, p_subject text, p_max int, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.mdm_rate_events where created_at < now() - interval '1 day';
  select count(*) into v_count from public.mdm_rate_events
   where bucket = p_bucket and subject = p_subject and created_at > now() - p_window;
  if v_count >= p_max then
    return true;
  end if;
  insert into public.mdm_rate_events (bucket, subject) values (p_bucket, p_subject);
  return false;
end;
$$;

create or replace function public._mdm_token_hash(p_token text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Token de equipo inválido' using errcode = '28000';
  end if;
  return encode(extensions.digest(p_token, 'sha256'), 'hex');
end;
$$;

create or replace function public._mdm_new_pairing_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 símbolos, sin 0/O/1/I
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function public._mdm_valid_domain(p_domain text)
returns boolean
language sql
immutable
as $$
  select p_domain is not null
     and length(p_domain) <= 253
     and p_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$';
$$;

revoke all on function public._mdm_require_role(uuid, boolean) from public, anon, authenticated;
revoke all on function public._mdm_audit(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public._mdm_rate_limited(text, text, int, interval) from public, anon, authenticated;
revoke all on function public._mdm_token_hash(text) from public, anon, authenticated;
revoke all on function public._mdm_new_pairing_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de equipos (anon). Autenticación = token del equipo.
-- ---------------------------------------------------------------------------

-- Alta de un equipo nuevo o renovación de su código de vinculación.
create or replace function public.mdm_device_register(p_token text, p_firmware text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public._mdm_token_hash(p_token);
  v_device public.mdm_devices;
  v_code text;
  v_expires timestamptz := now() + interval '15 minutes';
begin
  select * into v_device from public.mdm_devices where token_hash = v_hash;

  if not found then
    -- Freno global contra altas masivas con tokens inventados.
    if public._mdm_rate_limited('register', 'global', 120, interval '1 minute') then
      raise exception 'Demasiadas altas, reintentá en un minuto' using errcode = '53400';
    end if;
    delete from public.mdm_devices
     where company_id is null and paired_at is null and created_at < now() - interval '2 days';
    insert into public.mdm_devices (token_hash, firmware_version)
    values (v_hash, left(p_firmware, 64))
    returning * into v_device;
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
        -- colisión de código: probar otro
      end;
    end loop;
  else
    select expires_at into v_expires from public.mdm_pairing_codes where code = v_code;
  end if;

  return jsonb_build_object(
    'status', 'unpaired',
    'pairing_code', v_code,
    'pairing_expires_at', v_expires,
    'server_time', now()
  );
end;
$$;

-- Configuración efectiva del equipo. El agente la llama cada pocos minutos.
create or replace function public.mdm_device_sync(p_token text, p_firmware text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public._mdm_token_hash(p_token);
  v_device public.mdm_devices;
  v_company public.mdm_companies;
begin
  select * into v_device from public.mdm_devices where token_hash = v_hash;
  if not found then
    -- Token desconocido o revocado: el equipo debe volver a registrarse.
    return jsonb_build_object('status', 'unknown', 'server_time', now());
  end if;

  update public.mdm_devices
     set last_seen_at = now(),
         firmware_version = coalesce(left(p_firmware, 64), firmware_version)
   where id = v_device.id;

  if v_device.company_id is null then
    return public.mdm_device_register(p_token, p_firmware);
  end if;

  select * into v_company from public.mdm_companies where id = v_device.company_id;

  -- Momento exacto de bloqueo por falta de pago: fin del día pagado + gracia, en la zona de la empresa.
  -- Se envía como epoch para que el equipo bloquee a tiempo aunque quede sin conexión.
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

-- Reporte de dominios bloqueados por el equipo: [{"domain": "x.com", "hits": 3}, ...]
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
                    last_seen_at = now();
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.mdm_device_register(text, text) from public;
revoke all on function public.mdm_device_sync(text, text) from public;
revoke all on function public.mdm_device_report(text, jsonb) from public;
grant execute on function public.mdm_device_register(text, text) to anon, authenticated;
grant execute on function public.mdm_device_sync(text, text) to anon, authenticated;
grant execute on function public.mdm_device_report(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de administración (authenticated, no anónimos)
-- ---------------------------------------------------------------------------

create or replace function public.mdm_create_company(p_name text, p_owner_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_owner uuid;
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX puede crear empresas' using errcode = '42501';
  end if;
  select id into v_owner from auth.users where lower(email) = lower(trim(p_owner_email));
  if v_owner is null then
    raise exception 'No existe un usuario con ese email; debe registrarse primero' using errcode = 'P0002';
  end if;
  insert into public.mdm_companies (name) values (trim(p_name)) returning id into v_company;
  insert into public.mdm_members (company_id, user_id, role) values (v_company, v_owner, 'owner');
  perform public._mdm_audit(v_company, 'company.create', v_company::text,
                            jsonb_build_object('name', p_name, 'owner', v_owner));
  return v_company;
end;
$$;

create or replace function public.mdm_set_member(p_company uuid, p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  perform public._mdm_require_role(p_company, true);
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No existe un usuario con ese email' using errcode = 'P0002';
  end if;
  if p_role is null then
    if v_user = public._mdm_uid() then
      raise exception 'No podés quitarte a vos mismo' using errcode = '22023';
    end if;
    delete from public.mdm_members where company_id = p_company and user_id = v_user;
  elsif p_role in ('owner', 'admin') then
    insert into public.mdm_members (company_id, user_id, role) values (p_company, v_user, p_role)
    on conflict (company_id, user_id) do update set role = excluded.role;
  else
    raise exception 'Rol inválido' using errcode = '22023';
  end if;
  perform public._mdm_audit(p_company, 'member.set', v_user::text, jsonb_build_object('role', p_role));
end;
$$;

-- Devuelve el id del equipo vinculado, o null si el código es inválido o venció.
create or replace function public.mdm_claim_device(p_company uuid, p_code text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device uuid;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  perform public._mdm_require_role(p_company);
  -- 10 intentos por hora por usuario: el espacio de códigos es 32^8 ≈ 1,1e12.
  if public._mdm_rate_limited('claim', public._mdm_uid()::text, 10, interval '1 hour') then
    raise exception 'Demasiados intentos, esperá una hora' using errcode = '53400';
  end if;

  delete from public.mdm_pairing_codes
   where code = v_code and expires_at > now()
  returning device_id into v_device;

  if v_device is null then
    -- Sin excepción a propósito: un raise revertiría el registro del intento y
    -- el rate limit no contaría los códigos fallidos. null = código inválido.
    return null;
  end if;

  update public.mdm_devices
     set company_id = p_company,
         name = nullif(left(trim(p_name), 80), ''),
         paired_at = now(),
         locked = false,
         lock_reason = null
   where id = v_device and company_id is null;

  perform public._mdm_audit(p_company, 'device.claim', v_device::text, jsonb_build_object('name', p_name));
  return v_device;
end;
$$;

create or replace function public.mdm_set_device_lock(p_device uuid, p_locked boolean, p_reason text default null)
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
  update public.mdm_devices
     set locked = p_locked,
         lock_reason = case when p_locked then nullif(left(trim(p_reason), 280), '') end
   where id = p_device;
  perform public._mdm_audit(v_company, case when p_locked then 'device.lock' else 'device.unlock' end,
                            p_device::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Registrar pago: fija el nuevo "pagado hasta". Si ya no hay deuda, el equipo se desbloquea solo.
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
  perform public._mdm_audit(v_company, 'device.payment', p_device::text,
    jsonb_build_object('previous', v_prev, 'paid_until', p_paid_until, 'note', p_note));
end;
$$;

create or replace function public.mdm_rename_device(p_device uuid, p_name text)
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
  update public.mdm_devices set name = nullif(left(trim(p_name), 80), '') where id = p_device;
  perform public._mdm_audit(v_company, 'device.rename', p_device::text, jsonb_build_object('name', p_name));
end;
$$;

-- Desvincular revoca el token: el equipo queda en pantalla de vinculación con un token nuevo.
create or replace function public.mdm_unpair_device(p_device uuid)
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
  perform public._mdm_require_role(v_company, true);
  delete from public.mdm_devices where id = p_device;
  perform public._mdm_audit(v_company, 'device.unpair', p_device::text, '{}'::jsonb);
end;
$$;

create or replace function public.mdm_set_company_app(p_company uuid, p_app text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  if not exists (select 1 from public.mdm_app_catalog where id = p_app) then
    raise exception 'App inexistente' using errcode = 'P0002';
  end if;
  insert into public.mdm_company_apps (company_id, app_id, enabled, updated_at)
  values (p_company, p_app, p_enabled, now())
  on conflict (company_id, app_id) do update set enabled = excluded.enabled, updated_at = now();
  perform public._mdm_audit(p_company, 'app.set', p_app, jsonb_build_object('enabled', p_enabled));
end;
$$;

drop function if exists public.mdm_update_company(uuid, text, int, text);
create or replace function public.mdm_update_company(
  p_company uuid,
  p_lock_message text,
  p_offline_lock_days int,
  p_logo_path text,
  p_payment_message text default null,
  p_payment_grace_days int default null,
  p_payment_warning_days int default null,
  p_timezone text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  -- El logo solo puede apuntar a la carpeta de la propia empresa en el bucket.
  if p_logo_path is not null and split_part(p_logo_path, '/', 1) <> p_company::text then
    raise exception 'Ruta de logo inválida' using errcode = '22023';
  end if;
  if p_timezone is not null and not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Zona horaria inválida' using errcode = '22023';
  end if;
  update public.mdm_companies
     set lock_message = coalesce(nullif(trim(p_lock_message), ''), lock_message),
         offline_lock_days = coalesce(p_offline_lock_days, offline_lock_days),
         logo_path = p_logo_path,
         payment_message = coalesce(nullif(trim(p_payment_message), ''), payment_message),
         payment_grace_days = coalesce(p_payment_grace_days, payment_grace_days),
         payment_warning_days = coalesce(p_payment_warning_days, payment_warning_days),
         timezone = coalesce(p_timezone, timezone)
   where id = p_company;
  perform public._mdm_audit(p_company, 'company.update', p_company::text,
    jsonb_build_object('offline_lock_days', p_offline_lock_days, 'logo_path', p_logo_path));
end;
$$;

create or replace function public.mdm_upsert_catalog_app(
  p_id text, p_name text, p_kind text, p_launch_url text, p_icon_url text, p_domains text[], p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domains text[];
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX administra el catálogo' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct lower(d)), '{}') into v_domains
    from unnest(coalesce(p_domains, '{}')) d;
  if exists (select 1 from unnest(v_domains) d where not public._mdm_valid_domain(d)) then
    raise exception 'Hay dominios inválidos en la lista' using errcode = '22023';
  end if;
  insert into public.mdm_app_catalog (id, name, kind, launch_url, icon_url, domains, active)
  values (p_id, p_name, p_kind, p_launch_url, p_icon_url, v_domains, coalesce(p_active, true))
  on conflict (id) do update
    set name = excluded.name, kind = excluded.kind, launch_url = excluded.launch_url,
        icon_url = excluded.icon_url, domains = excluded.domains, active = excluded.active;
  perform public._mdm_audit(null, 'catalog.upsert', p_id, jsonb_build_object('domains', v_domains));
end;
$$;

create or replace function public.mdm_classify_domain(p_domain text, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := lower(trim(p_domain));
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX clasifica dominios' using errcode = '42501';
  end if;
  if not public._mdm_valid_domain(v_domain) then
    raise exception 'Dominio inválido' using errcode = '22023';
  end if;
  if p_status is null then
    delete from public.mdm_domain_classifications where domain = v_domain;
  else
    insert into public.mdm_domain_classifications (domain, status, note, reviewed_by, reviewed_at)
    values (v_domain, p_status, p_note, public._mdm_uid(), now())
    on conflict (domain) do update
      set status = excluded.status, note = excluded.note,
          reviewed_by = excluded.reviewed_by, reviewed_at = now();
  end if;
  perform public._mdm_audit(null, 'domain.classify', v_domain, jsonb_build_object('status', p_status));
end;
$$;

-- Ranking de dominios bloqueados para revisión (solo NEX).
create or replace function public.mdm_blocked_domain_report(p_days int default 14)
returns table (domain text, devices bigint, companies bigint, hits bigint, last_seen_at timestamptz, status text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX' using errcode = '42501';
  end if;
  return query
    select b.domain, count(distinct b.device_id), count(distinct b.company_id), sum(b.hits)::bigint,
           max(b.last_seen_at), c.status
      from public.mdm_blocked_attempts b
      left join public.mdm_domain_classifications c on c.domain = b.domain
     where b.day >= current_date - least(greatest(p_days, 1), 90)
     group by b.domain, c.status
     order by count(distinct b.device_id) desc, sum(b.hits) desc
     limit 500;
end;
$$;

-- Retención: correr a diario (pg_cron) o a mano.
create or replace function public.mdm_purge_old_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.mdm_blocked_attempts where day < current_date - 90;
  delete from public.mdm_pairing_codes where expires_at < now();
  delete from public.mdm_rate_events where created_at < now() - interval '1 day';
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'mdm_create_company(text, text)',
    'mdm_set_member(uuid, text, text)',
    'mdm_claim_device(uuid, text, text)',
    'mdm_set_device_lock(uuid, boolean, text)',
    'mdm_rename_device(uuid, text)',
    'mdm_unpair_device(uuid)',
    'mdm_set_company_app(uuid, text, boolean)',
    'mdm_update_company(uuid, text, int, text, text, int, int, text)',
    'mdm_set_paid_until(uuid, date, text)',
    'mdm_upsert_catalog_app(text, text, text, text, text, text[], boolean)',
    'mdm_classify_domain(text, text, text)',
    'mdm_blocked_domain_report(int)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
revoke all on function public.mdm_purge_old_data() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: logos de empresa
-- ---------------------------------------------------------------------------
-- Bucket público de solo lectura: un logo no es secreto y el TV box lo descarga sin credenciales.
-- Sin SVG (puede contener scripts). Máximo 1 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mdm-branding', 'mdm-branding', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists mdm_branding_write on storage.objects;
create policy mdm_branding_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mdm-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public._mdm_company_role(((storage.foldername(name))[1])::uuid) is not null
  );

drop policy if exists mdm_branding_read on storage.objects;
create policy mdm_branding_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mdm-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public._mdm_company_role(((storage.foldername(name))[1])::uuid) is not null
  );

drop policy if exists mdm_branding_update on storage.objects;
create policy mdm_branding_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'mdm-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public._mdm_company_role(((storage.foldername(name))[1])::uuid) is not null
  );

drop policy if exists mdm_branding_delete on storage.objects;
create policy mdm_branding_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mdm-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public._mdm_company_role(((storage.foldername(name))[1])::uuid) is not null
  );

-- ---------------------------------------------------------------------------
-- Catálogo inicial (dominios a validar en el equipo real)
-- ---------------------------------------------------------------------------

insert into public.mdm_app_catalog (id, name, kind, launch_url, domains) values
  ('netflix', 'Netflix', 'web', 'https://www.netflix.com/browse',
    array['netflix.com', 'netflix.net', 'nflxvideo.net', 'nflximg.net', 'nflximg.com', 'nflxext.com', 'nflxso.net']),
  ('youtube', 'YouTube', 'web', 'https://www.youtube.com/tv',
    array['youtube.com', 'googlevideo.com', 'ytimg.com', 'ggpht.com', 'youtubei.googleapis.com', 'accounts.google.com']),
  ('disney-plus', 'Disney+', 'web', 'https://www.disneyplus.com/',
    array['disneyplus.com', 'disney-plus.net', 'dssott.com', 'bamgrid.com', 'disneystreaming.com']),
  ('prime-video', 'Prime Video', 'web', 'https://www.primevideo.com/',
    array['primevideo.com', 'amazonvideo.com', 'aiv-cdn.net', 'aiv-delivery.net', 'media-amazon.com', 'amazon.com']),
  ('spotify', 'Spotify', 'web', 'https://open.spotify.com/',
    array['spotify.com', 'scdn.co', 'spotifycdn.com', 'spotifycdn.net']),
  -- kind 'internal': el id es el appId de NEX-OS (AppRegistry). La UI solo acepta apps seguras para TV.
  ('nexreproductor', 'NEX Music', 'internal', null, array['youtube.com', 'googlevideo.com', 'ytimg.com'])
on conflict (id) do nothing;

-- Primer super-admin (NEX): reemplazá el email y ejecutá una vez.
-- insert into public.mdm_super_admins (user_id)
--   select id from auth.users where email = 'admin@tu-dominio.com'
-- on conflict do nothing;
