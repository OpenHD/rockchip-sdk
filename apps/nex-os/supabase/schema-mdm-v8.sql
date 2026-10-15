-- NEX-OS MDM v8 — configuración firmada, código de desbloqueo offline, API para ISP y actualizaciones (OTA).
-- Ejecutá DESPUÉS de schema-mdm-v7.sql. Es idempotente: se puede volver a correr.
-- Diseño: docs/GESTION_REMOTA.md (sección v8).
--
-- Qué agrega
-- * mdm_device_sync v8: hardware_id (se completa si faltaba), unlock_secret por equipo, attestation_eligible,
--   update (OTA), external_ref y pass_attestation en las apps. La Edge Function mdm-sync firma el resultado.
-- * Código de desbloqueo offline: HMAC-SHA256(unlock_secret, '<device_id>:<YYYYMMDD>') → 8 dígitos.
-- * Releases de firmware y target por empresa (o global). Solo super admin.
-- * Claves de API para el sistema de cobranza del ISP (Edge Function isp-api). En la base solo vive sha256(clave).
--
-- Seguridad
-- * unlock_secret, hardware_id, token_hash y key_hash nunca son legibles por admins: mdm_devices y mdm_api_keys
--   tienen el select de tabla revocado y solo se conceden columnas puntuales (se verifica al final del script).
-- * Las funciones mdm_isp_* solo las ejecuta service_role (la Edge Function), y validan la clave adentro.
-- * Toda RPC de administración exige aal2 (vía _mdm_uid) y queda auditada.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------

-- El default volátil se evalúa por fila: al agregar la columna, cada equipo existente recibe su propio secreto.
alter table public.mdm_devices add column if not exists unlock_secret text
  default encode(extensions.gen_random_bytes(32), 'hex')
  check (unlock_secret is null or unlock_secret ~ '^[0-9a-f]{64}$');
update public.mdm_devices set unlock_secret = encode(extensions.gen_random_bytes(32), 'hex')
 where unlock_secret is null;

-- Identificador del cliente en el sistema del ISP (número de abonado, etc.). Único por empresa.
-- Charset acotado: viaja en URLs (/devices/ref:<x>) y en el JWT de atestación.
alter table public.mdm_devices add column if not exists external_ref text
  check (external_ref is null or external_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:@-]{0,63}$');
create unique index if not exists mdm_devices_external_ref_idx on public.mdm_devices (company_id, external_ref)
  where external_ref is not null;

grant select (external_ref) on public.mdm_devices to authenticated;
-- Defensivo: estas columnas nunca se conceden (v6 revocó el select de tabla).
revoke select (unlock_secret, hardware_id, token_hash) on public.mdm_devices from anon, authenticated;

-- Apps del catálogo que reciben el JWT de atestación al abrirse (#nex_attestation=...).
alter table public.mdm_app_catalog add column if not exists pass_attestation boolean not null default false;

-- Acciones hechas por una clave de API: actor = null, actor_label = 'api:<nombre>'.
alter table public.mdm_audit_log add column if not exists actor_label text
  check (actor_label is null or length(actor_label) <= 100);

-- Si cambia el token (re-enrolamiento por hardware), el secreto de desbloqueo se renueva: quien haya
-- desplazado el token de otro equipo pierde el secreto en cuanto el equipo legítimo vuelve a enrolarse.
create or replace function public._mdm_rotate_unlock_secret()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.token_hash is not null and new.token_hash is distinct from old.token_hash then
    new.unlock_secret := encode(extensions.gen_random_bytes(32), 'hex');
  end if;
  return new;
end;
$$;
revoke all on function public._mdm_rotate_unlock_secret() from public, anon, authenticated;

drop trigger if exists mdm_devices_rotate_unlock_secret on public.mdm_devices;
create trigger mdm_devices_rotate_unlock_secret before update of token_hash on public.mdm_devices
  for each row execute function public._mdm_rotate_unlock_secret();

-- ---------------------------------------------------------------------------
-- Tablas nuevas
-- ---------------------------------------------------------------------------

-- Releases de firmware. La firma (sig) la hace NEX offline con la clave de releases sobre
-- 'nex-update:v1:<build>:<sha256>'; el servidor no la puede generar ni verificar, el equipo sí.
-- url y version con charset acotado: el agente del equipo es shell.
create table if not exists public.mdm_firmware_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null check (version ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$'),
  build int not null unique check (build > 0),
  url text not null check (
    length(url) <= 500
    and url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~%/+=-]*)?(\?[A-Za-z0-9._~%&=+-]*)?$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size bigint not null check (size > 0 and size <= 8589934592),
  sig text not null check (sig ~ '^[A-Za-z0-9+/]+={0,2}$' and length(sig) between 340 and 1024 and length(sig) % 4 = 0),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- Target de firmware: company_id null = global. Una empresa con target propio no usa el global.
create table if not exists public.mdm_firmware_targets (
  id bigint generated always as identity primary key,
  company_id uuid references public.mdm_companies (id) on delete cascade,
  release_id uuid not null references public.mdm_firmware_releases (id) on delete cascade,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index if not exists mdm_firmware_targets_company_idx on public.mdm_firmware_targets (company_id)
  where company_id is not null;
create unique index if not exists mdm_firmware_targets_global_idx on public.mdm_firmware_targets ((company_id is null))
  where company_id is null;

-- Claves de API del ISP. La clave (nexk_ + 43 base64url) se muestra una sola vez; acá solo su sha256.
create table if not exists public.mdm_api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.mdm_companies (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60 and name !~ '[[:cntrl:]]'),
  prefix text not null check (prefix ~ '^nexk_[A-Za-z0-9_-]{6}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists mdm_api_keys_company_idx on public.mdm_api_keys (company_id, created_at desc);

-- Rate limit de la API por clave: ventana fija de un minuto, una fila por clave (barato a alto volumen).
create table if not exists public.mdm_api_rate (
  key_id uuid primary key references public.mdm_api_keys (id) on delete cascade,
  window_start timestamptz not null,
  hits int not null
);

alter table public.mdm_firmware_releases enable row level security;
alter table public.mdm_firmware_targets enable row level security;
alter table public.mdm_api_keys enable row level security;
alter table public.mdm_api_rate enable row level security;

drop policy if exists mdm_firmware_releases_read on public.mdm_firmware_releases;
create policy mdm_firmware_releases_read on public.mdm_firmware_releases
  for select to authenticated using (public.mdm_is_super_admin());

drop policy if exists mdm_firmware_targets_read on public.mdm_firmware_targets;
create policy mdm_firmware_targets_read on public.mdm_firmware_targets
  for select to authenticated using (public.mdm_is_super_admin());

drop policy if exists mdm_api_keys_read on public.mdm_api_keys;
create policy mdm_api_keys_read on public.mdm_api_keys
  for select to authenticated using (public._mdm_company_role(company_id) is not null);

revoke all on public.mdm_firmware_releases, public.mdm_firmware_targets, public.mdm_api_keys,
  public.mdm_api_rate from anon, authenticated;
grant select on public.mdm_firmware_releases, public.mdm_firmware_targets to authenticated;
-- key_hash nunca sale de la base.
grant select (id, company_id, name, prefix, created_by, created_at, last_used_at, revoked_at)
  on public.mdm_api_keys to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------

-- Auditoría con actor que no es un usuario (claves de API): actor = null, actor_label = 'api:<nombre>'.
create or replace function public._mdm_audit_as(p_actor_label text, p_company uuid, p_action text,
                                                p_target text, p_details jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.mdm_audit_log (actor, actor_label, company_id, action, target, details)
  values (null, left(p_actor_label, 100), p_company, p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;

-- Código de desbloqueo: HMAC-SHA256(key = 64 hex de unlock_secret como ASCII, msg = '<device_id>:<YYYYMMDD>'),
-- primeros 8 hex → entero → mod 1e8 → 8 dígitos con ceros a la izquierda.
create or replace function public._mdm_unlock_code(p_device uuid, p_secret text, p_day date)
returns text
language sql
stable
set search_path = public
as $$
  select lpad(((('x' || lpad(left(encode(
           extensions.hmac(p_device::text || ':' || to_char(p_day, 'YYYYMMDD'), p_secret, 'sha256'),
           'hex'), 8), 16, '0'))::bit(64)::bigint) % 100000000)::text, 8, '0');
$$;

-- Código del día (UTC) para un equipo: {code, valid_on, hours}. Genera el secreto si faltaba.
create or replace function public._mdm_unlock_code_for(p_device uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_day date := (now() at time zone 'UTC')::date;
begin
  update public.mdm_devices
     set unlock_secret = coalesce(unlock_secret, encode(extensions.gen_random_bytes(32), 'hex'))
   where id = p_device
  returning unlock_secret into v_secret;
  if v_secret is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'code', public._mdm_unlock_code(p_device, v_secret, v_day),
    'valid_on', to_char(v_day, 'YYYY-MM-DD'),
    'hours', 72
  );
end;
$$;

-- Valida y aplica external_ref (null lo borra). Único por empresa.
create or replace function public._mdm_apply_external_ref(p_device uuid, p_company uuid, p_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(trim(p_ref), '');
begin
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:@-]{0,63}$' then
    raise exception 'Referencia externa inválida (1-64 caracteres: letras, números, . _ : @ -)' using errcode = '22023';
  end if;
  if v_ref is not null and exists (
    select 1 from public.mdm_devices
     where company_id = p_company and external_ref = v_ref and id <> p_device
  ) then
    raise exception 'Esa referencia externa ya está asignada a otro equipo' using errcode = '23505';
  end if;
  update public.mdm_devices set external_ref = v_ref where id = p_device;
  return v_ref;
end;
$$;

revoke all on function public._mdm_audit_as(text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public._mdm_unlock_code(uuid, text, date) from public, anon, authenticated;
revoke all on function public._mdm_unlock_code_for(uuid) from public, anon, authenticated;
revoke all on function public._mdm_apply_external_ref(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de equipos: mdm_device_sync v8 (misma firma que v7; la llama la Edge Function mdm-sync)
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
  v_lock_at timestamptz;
  v_release public.mdm_firmware_releases;
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
  end if;

  if v_device.company_id is null then
    return public.mdm_device_register(p_token, p_firmware, p_hardware_id);
  end if;

  select * into v_company from public.mdm_companies where id = v_device.company_id;

  if v_device.paid_until is not null then
    v_lock_at := (v_device.paid_until + 1 + v_company.payment_grace_days)::timestamp at time zone v_company.timezone;
  end if;

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
      'lock_at', extract(epoch from v_lock_at)::bigint,
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
    'attestation_eligible', (not v_device.locked and (v_lock_at is null or now() < v_lock_at)),
    'update', case when v_release.id is not null and v_release.build > v_build then jsonb_build_object(
      'version', v_release.version,
      'build', v_release.build,
      'url', v_release.url,
      'sha256', v_release.sha256,
      'size', v_release.size,
      'sig', v_release.sig
    ) end
  );
end;
$$;

revoke all on function public.mdm_device_sync(text, text, jsonb, jsonb, text) from public;
grant execute on function public.mdm_device_sync(text, text, jsonb, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de administración (authenticated + aal2)
-- ---------------------------------------------------------------------------

-- Código de desbloqueo offline del día (UTC). Soporte se lo dicta al cliente; el equipo acepta hoy y ayer.
create or replace function public.mdm_unlock_code(p_device uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_result jsonb;
begin
  select company_id into v_company from public.mdm_devices where id = p_device;
  if v_company is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company);
  if public._mdm_rate_limited('unlock-code', public._mdm_uid()::text, 30, interval '1 hour') then
    raise exception 'Demasiados códigos pedidos, esperá un rato' using errcode = '53400';
  end if;
  v_result := public._mdm_unlock_code_for(p_device);
  -- El código no se guarda en la auditoría.
  perform public._mdm_audit(v_company, 'device.unlock_code', p_device::text,
                            jsonb_build_object('valid_on', v_result ->> 'valid_on'));
  return v_result;
end;
$$;

create or replace function public.mdm_set_external_ref(p_device uuid, p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_ref text;
begin
  select company_id into v_company from public.mdm_devices where id = p_device;
  if v_company is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company);
  v_ref := public._mdm_apply_external_ref(p_device, v_company, p_ref);
  perform public._mdm_audit(v_company, 'device.external_ref', p_device::text, jsonb_build_object('external_ref', v_ref));
end;
$$;

create or replace function public.mdm_set_catalog_attestation(p_id text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX administra el catálogo' using errcode = '42501';
  end if;
  update public.mdm_app_catalog set pass_attestation = coalesce(p_enabled, false) where id = p_id;
  if not found then
    raise exception 'App inexistente' using errcode = 'P0002';
  end if;
  perform public._mdm_audit(null, 'catalog.attestation', p_id, jsonb_build_object('enabled', coalesce(p_enabled, false)));
end;
$$;

-- Claves de API ------------------------------------------------------------

-- Solo owner (o super admin). Devuelve la clave en claro UNA vez: {id, key, prefix}.
create or replace function public.mdm_create_api_key(p_company uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_name);
  v_key text;
  v_prefix text;
  v_id uuid;
begin
  perform public._mdm_require_role(p_company, true);
  if v_name is null or length(v_name) not between 2 and 60 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Nombre inválido (2 a 60 caracteres)' using errcode = '22023';
  end if;
  if public._mdm_rate_limited('api-key', public._mdm_uid()::text, 10, interval '1 hour') then
    raise exception 'Demasiadas claves creadas, esperá un rato' using errcode = '53400';
  end if;
  if (select count(*) from public.mdm_api_keys where company_id = p_company and revoked_at is null) >= 10 then
    raise exception 'Máximo 10 claves activas por empresa: revocá alguna' using errcode = '22023';
  end if;
  -- 32 bytes aleatorios → 43 caracteres base64url sin relleno.
  v_key := 'nexk_' || rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_prefix := left(v_key, 11);
  insert into public.mdm_api_keys (company_id, name, prefix, key_hash, created_by)
  values (p_company, v_name, v_prefix, encode(extensions.digest(v_key, 'sha256'), 'hex'), public._mdm_uid())
  returning id into v_id;
  perform public._mdm_audit(p_company, 'api_key.create', v_id::text,
                            jsonb_build_object('name', v_name, 'prefix', v_prefix));
  return jsonb_build_object('id', v_id, 'key', v_key, 'prefix', v_prefix);
end;
$$;

create or replace function public.mdm_revoke_api_key(p_key uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.mdm_api_keys where id = p_key;
  if v_company is null then
    raise exception 'Clave no encontrada' using errcode = 'P0002';
  end if;
  perform public._mdm_require_role(v_company, true);
  update public.mdm_api_keys set revoked_at = now() where id = p_key and revoked_at is null;
  perform public._mdm_audit(v_company, 'api_key.revoke', p_key::text, '{}'::jsonb);
end;
$$;

-- Lectura para el panel (cualquier miembro). Sin key_hash.
create or replace function public.mdm_list_api_keys(p_company uuid)
returns table (id uuid, name text, prefix text, created_by uuid, created_by_email text,
               created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  return query
    select k.id, k.name, k.prefix, k.created_by, u.email::text, k.created_at, k.last_used_at, k.revoked_at
      from public.mdm_api_keys k
      left join auth.users u on u.id = k.created_by
     where k.company_id = p_company
     order by k.revoked_at is not null, k.created_at desc;
end;
$$;

-- Firmware (solo super admin) ----------------------------------------------

create or replace function public.mdm_publish_release(p_version text, p_build int, p_url text, p_sha256 text,
                                                      p_size bigint, p_sig text, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX publica firmware' using errcode = '42501';
  end if;
  if exists (select 1 from public.mdm_firmware_releases where build = p_build) then
    raise exception 'Ya existe un release con ese build' using errcode = '23505';
  end if;
  begin
    insert into public.mdm_firmware_releases (version, build, url, sha256, size, sig, notes, created_by)
    values (trim(p_version), p_build, trim(p_url), lower(trim(p_sha256)), p_size, trim(p_sig),
            nullif(left(trim(p_notes), 2000), ''), public._mdm_uid())
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'Datos del release inválidos (versión, build > 0, URL https, sha256 hex, tamaño o firma base64)'
      using errcode = '22023';
  end;
  perform public._mdm_audit(null, 'firmware.publish', v_id::text,
    jsonb_build_object('version', p_version, 'build', p_build, 'sha256', lower(trim(p_sha256))));
  return v_id;
end;
$$;

-- p_company null = target global. p_release null = quitar el target (la empresa vuelve a usar el global;
-- el global queda sin actualización).
create or replace function public.mdm_set_firmware_target(p_company uuid, p_release uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX asigna firmware' using errcode = '42501';
  end if;
  if p_company is not null and not exists (select 1 from public.mdm_companies where id = p_company) then
    raise exception 'Empresa inexistente' using errcode = 'P0002';
  end if;
  if p_release is not null and not exists (select 1 from public.mdm_firmware_releases where id = p_release) then
    raise exception 'Release inexistente' using errcode = 'P0002';
  end if;
  delete from public.mdm_firmware_targets where company_id is not distinct from p_company;
  if p_release is not null then
    insert into public.mdm_firmware_targets (company_id, release_id, updated_by)
    values (p_company, p_release, public._mdm_uid());
  end if;
  perform public._mdm_audit(p_company, 'firmware.target', coalesce(p_company::text, 'global'),
                            jsonb_build_object('release', p_release));
end;
$$;

create or replace function public.mdm_list_releases()
returns table (id uuid, version text, build int, url text, sha256 text, size bigint, sig text, notes text,
               created_at timestamptz, created_by uuid)
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
    select r.id, r.version, r.build, r.url, r.sha256, r.size, r.sig, r.notes, r.created_at, r.created_by
      from public.mdm_firmware_releases r
     order by r.build desc;
end;
$$;

-- Targets actuales. company_id null = global.
create or replace function public.mdm_list_firmware_targets()
returns table (company_id uuid, company_name text, release_id uuid, version text, build int,
               updated_at timestamptz)
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
    select t.company_id, c.name, r.id, r.version, r.build, t.updated_at
      from public.mdm_firmware_targets t
      join public.mdm_firmware_releases r on r.id = t.release_id
      left join public.mdm_companies c on c.id = t.company_id
     order by t.company_id is not null, c.name;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'mdm_unlock_code(uuid)',
    'mdm_set_external_ref(uuid, text)',
    'mdm_set_catalog_attestation(text, boolean)',
    'mdm_create_api_key(uuid, text)',
    'mdm_revoke_api_key(uuid)',
    'mdm_list_api_keys(uuid)',
    'mdm_publish_release(text, int, text, text, bigint, text, text)',
    'mdm_set_firmware_target(uuid, uuid)',
    'mdm_list_releases()',
    'mdm_list_firmware_targets()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- API para ISP: funciones mdm_isp_* (solo service_role, desde la Edge Function isp-api)
-- p_key_hash = sha256 hex de la clave completa ('nexk_...'). p_id = uuid o 'ref:<external_ref>'.
-- ---------------------------------------------------------------------------

-- Valida la clave, aplica el rate limit (120 por minuto) y marca el uso.
create or replace function public._mdm_isp_key(p_key_hash text)
returns public.mdm_api_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys;
  v_hits int;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Clave de API inválida' using errcode = '28000';
  end if;
  select * into v_key from public.mdm_api_keys where key_hash = p_key_hash and revoked_at is null;
  if not found then
    raise exception 'Clave de API inválida o revocada' using errcode = '28000';
  end if;
  insert into public.mdm_api_rate as r (key_id, window_start, hits)
  values (v_key.id, date_trunc('minute', now()), 1)
  on conflict (key_id) do update
    set hits = case when r.window_start = excluded.window_start then r.hits + 1 else 1 end,
        window_start = excluded.window_start
  returning r.hits into v_hits;
  if v_hits > 120 then
    raise exception 'Demasiadas solicitudes, reintentá en un minuto' using errcode = '53400';
  end if;
  if v_key.last_used_at is null or v_key.last_used_at < now() - interval '1 minute' then
    update public.mdm_api_keys set last_used_at = now() where id = v_key.id;
  end if;
  return v_key;
end;
$$;

-- Equipo de la empresa de la clave. Otro id (o de otra empresa) → "no encontrado", sin distinguir.
create or replace function public._mdm_isp_device(p_company uuid, p_id text)
returns public.mdm_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.mdm_devices;
  v_id text := lower(p_id);
begin
  if v_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_device from public.mdm_devices where id = v_id::uuid and company_id = p_company;
  elsif p_id ~ '^ref:[A-Za-z0-9][A-Za-z0-9._:@-]{0,63}$' then
    select * into v_device from public.mdm_devices
     where company_id = p_company and external_ref = substr(p_id, 5);
  else
    raise exception 'Identificador de equipo inválido' using errcode = '22023';
  end if;
  if v_device.id is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  return v_device;
end;
$$;

-- "online" = sincronizó en los últimos 5 minutos (mismo criterio que el panel).
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
    'firmware_version', p_device.firmware_version
  );
$$;

create or replace function public.mdm_isp_list_devices(p_key_hash text, p_limit int default 50,
                                                       p_offset int default 0, p_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys := public._mdm_isp_key(p_key_hash);
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := least(greatest(coalesce(p_offset, 0), 0), 1000000);
begin
  return jsonb_build_object(
    'devices', coalesce((
      select jsonb_agg(public._mdm_isp_device_json(d) order by d.created_at, d.id)
        from (select * from public.mdm_devices
               where company_id = v_key.company_id
                 and (p_ref is null or external_ref = p_ref)
               order by created_at, id
               limit v_limit offset v_offset) d
    ), '[]'::jsonb),
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

create or replace function public.mdm_isp_get_device(p_key_hash text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys := public._mdm_isp_key(p_key_hash);
begin
  return public._mdm_isp_device_json(public._mdm_isp_device(v_key.company_id, p_id));
end;
$$;

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
begin
  if p_locked is null then
    raise exception 'Falta locked' using errcode = '22023';
  end if;
  update public.mdm_devices
     set locked = p_locked,
         lock_reason = case when p_locked then nullif(left(trim(p_reason), 280), '') end
   where id = v_device.id
  returning * into v_device;
  perform public._mdm_audit_as('api:' || v_key.name, v_key.company_id,
    case when p_locked then 'device.lock' else 'device.unlock' end, v_device.id::text,
    jsonb_build_object('reason', p_reason, 'api_key', v_key.id));
  return public._mdm_isp_device_json(v_device);
end;
$$;

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
  perform public._mdm_audit_as('api:' || v_key.name, v_key.company_id, 'device.payment', v_device.id::text,
    jsonb_build_object('previous', v_prev, 'paid_until', p_paid_until, 'api_key', v_key.id));
  return public._mdm_isp_device_json(v_device);
end;
$$;

create or replace function public.mdm_isp_set_external_ref(p_key_hash text, p_id text, p_external_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys := public._mdm_isp_key(p_key_hash);
  v_device public.mdm_devices := public._mdm_isp_device(v_key.company_id, p_id);
  v_ref text;
begin
  v_ref := public._mdm_apply_external_ref(v_device.id, v_key.company_id, p_external_ref);
  perform public._mdm_audit_as('api:' || v_key.name, v_key.company_id, 'device.external_ref', v_device.id::text,
    jsonb_build_object('external_ref', v_ref, 'api_key', v_key.id));
  select * into v_device from public.mdm_devices where id = v_device.id;
  return public._mdm_isp_device_json(v_device);
end;
$$;

create or replace function public.mdm_isp_unlock_code(p_key_hash text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.mdm_api_keys := public._mdm_isp_key(p_key_hash);
  v_device public.mdm_devices := public._mdm_isp_device(v_key.company_id, p_id);
  v_result jsonb;
begin
  if public._mdm_rate_limited('isp-unlock-code', v_key.id::text, 60, interval '1 hour') then
    raise exception 'Demasiados códigos pedidos, esperá un rato' using errcode = '53400';
  end if;
  v_result := public._mdm_unlock_code_for(v_device.id);
  perform public._mdm_audit_as('api:' || v_key.name, v_key.company_id, 'device.unlock_code', v_device.id::text,
    jsonb_build_object('valid_on', v_result ->> 'valid_on', 'api_key', v_key.id));
  return v_result;
end;
$$;

revoke all on function public._mdm_isp_key(text) from public, anon, authenticated;
revoke all on function public._mdm_isp_device(uuid, text) from public, anon, authenticated;
revoke all on function public._mdm_isp_device_json(public.mdm_devices) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'mdm_isp_list_devices(text, int, int, text)',
    'mdm_isp_get_device(text, text)',
    'mdm_isp_set_lock(text, text, boolean, text)',
    'mdm_isp_set_paid_until(text, text, date)',
    'mdm_isp_set_external_ref(text, text, text)',
    'mdm_isp_unlock_code(text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Comprobación final: si algún grant heredado dejara leer un secreto, el script falla.
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
end;
$$;
