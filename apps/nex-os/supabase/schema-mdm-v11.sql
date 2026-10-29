-- NEX MDM v11: actualizaciones (OTA) separadas por plataforma.
--
-- Hasta v10 había un solo canal de releases: un target global y uno por empresa, para cualquier equipo.
-- Con TV box Android (APK de NEX TV) y cajas Linux (imagen de firmware) en la misma empresa, cada uno tiene que
-- recibir su propio release. v11 agrega `platform` ('linux' | 'android') a releases y targets:
-- * el build es único por plataforma (el build 2 de Android no choca con el 2 de Linux);
-- * hay un target global y uno por empresa para cada plataforma;
-- * el sync elige el release según p_status.platform del equipo (sin plataforma cuenta como linux, como los
--   agentes Linux actuales), así que los equipos Linux siguen recibiendo exactamente lo mismo que antes.
-- Las RPC del panel aceptan la plataforma con 'linux' por defecto: las llamadas existentes siguen funcionando.
-- Idempotente: se puede correr dos veces.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

alter table public.mdm_firmware_releases add column if not exists platform text not null default 'linux';
alter table public.mdm_firmware_targets add column if not exists platform text not null default 'linux';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mdm_firmware_releases_platform_check') then
    alter table public.mdm_firmware_releases
      add constraint mdm_firmware_releases_platform_check check (platform in ('linux', 'android'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mdm_firmware_targets_platform_check') then
    alter table public.mdm_firmware_targets
      add constraint mdm_firmware_targets_platform_check check (platform in ('linux', 'android'));
  end if;
end;
$$;

-- Build único por plataforma (antes, único global).
alter table public.mdm_firmware_releases drop constraint if exists mdm_firmware_releases_build_key;
create unique index if not exists mdm_firmware_releases_platform_build_idx
  on public.mdm_firmware_releases (platform, build);

-- Un target por empresa y plataforma, y uno global por plataforma.
drop index if exists public.mdm_firmware_targets_company_idx;
drop index if exists public.mdm_firmware_targets_global_idx;
create unique index if not exists mdm_firmware_targets_company_platform_idx
  on public.mdm_firmware_targets (company_id, platform) where company_id is not null;
create unique index if not exists mdm_firmware_targets_global_platform_idx
  on public.mdm_firmware_targets (platform) where company_id is null;

-- ---------------------------------------------------------------------------
-- Sync del equipo: igual que v9, salvo la elección del release por plataforma.
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
    'restrict_reason', v_device.restrict_reason
  );
end;
$$;

revoke all on function public.mdm_device_sync(text, text, jsonb, jsonb, text) from public;
grant execute on function public.mdm_device_sync(text, text, jsonb, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de NEX (super-admin + 2FA reciente, como en v10), ahora con plataforma
-- ---------------------------------------------------------------------------

-- Cambian las firmas: se borran las de v8/v10 para que no queden dos versiones ambiguas.
drop function if exists public.mdm_publish_release(text, int, text, text, bigint, text, text);
drop function if exists public.mdm_set_firmware_target(uuid, uuid);
drop function if exists public.mdm_list_releases();
drop function if exists public.mdm_list_firmware_targets();

create or replace function public.mdm_publish_release(p_version text, p_build int, p_url text, p_sha256 text,
                                                      p_size bigint, p_sig text, p_notes text default null,
                                                      p_platform text default 'linux')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_platform text := coalesce(p_platform, 'linux');
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX publica firmware' using errcode = '42501';
  end if;
  perform public._mdm_require_recent_mfa();
  if v_platform not in ('linux', 'android') then
    raise exception 'Plataforma inválida (linux o android)' using errcode = '22023';
  end if;
  if exists (select 1 from public.mdm_firmware_releases where platform = v_platform and build = p_build) then
    raise exception 'Ya existe un release con ese build para esa plataforma' using errcode = '23505';
  end if;
  begin
    insert into public.mdm_firmware_releases (version, build, url, sha256, size, sig, notes, created_by, platform)
    values (trim(p_version), p_build, trim(p_url), lower(trim(p_sha256)), p_size, trim(p_sig),
            nullif(left(trim(p_notes), 2000), ''), public._mdm_uid(), v_platform)
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'Datos del release inválidos (versión, build > 0, URL https, sha256 hex, tamaño o firma base64)'
      using errcode = '22023';
  end;
  perform public._mdm_audit(null, 'firmware.publish', v_id::text,
    jsonb_build_object('version', p_version, 'build', p_build, 'sha256', lower(trim(p_sha256)), 'platform', v_platform));
  return v_id;
end;
$$;

-- La plataforma del target es la del release. Para borrar un target (p_release null) se indica la plataforma.
create or replace function public.mdm_set_firmware_target(p_company uuid, p_release uuid, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform text;
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX asigna firmware' using errcode = '42501';
  end if;
  perform public._mdm_require_recent_mfa();
  if p_company is not null and not exists (select 1 from public.mdm_companies where id = p_company) then
    raise exception 'Empresa inexistente' using errcode = 'P0002';
  end if;
  if p_release is not null then
    select platform into v_platform from public.mdm_firmware_releases where id = p_release;
    if not found then
      raise exception 'Release inexistente' using errcode = 'P0002';
    end if;
    if p_platform is not null and p_platform <> v_platform then
      raise exception 'El release es de otra plataforma' using errcode = '22023';
    end if;
  else
    v_platform := coalesce(p_platform, 'linux');
    if v_platform not in ('linux', 'android') then
      raise exception 'Plataforma inválida (linux o android)' using errcode = '22023';
    end if;
  end if;
  delete from public.mdm_firmware_targets
   where company_id is not distinct from p_company and platform = v_platform;
  if p_release is not null then
    insert into public.mdm_firmware_targets (company_id, release_id, updated_by, platform)
    values (p_company, p_release, public._mdm_uid(), v_platform);
  end if;
  perform public._mdm_audit(p_company, 'firmware.target', coalesce(p_company::text, 'global'),
                            jsonb_build_object('release', p_release, 'platform', v_platform));
end;
$$;

create or replace function public.mdm_list_releases()
returns table (id uuid, version text, build int, url text, sha256 text, size bigint, sig text, notes text,
               created_at timestamptz, created_by uuid, platform text)
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
    select r.id, r.version, r.build, r.url, r.sha256, r.size, r.sig, r.notes, r.created_at, r.created_by, r.platform
      from public.mdm_firmware_releases r
     order by r.platform, r.build desc;
end;
$$;

-- Targets actuales. company_id null = global.
create or replace function public.mdm_list_firmware_targets()
returns table (company_id uuid, company_name text, release_id uuid, version text, build int,
               updated_at timestamptz, platform text)
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
    select t.company_id, c.name, r.id, r.version, r.build, t.updated_at, t.platform
      from public.mdm_firmware_targets t
      join public.mdm_firmware_releases r on r.id = t.release_id
      left join public.mdm_companies c on c.id = t.company_id
     order by t.company_id is not null, c.name, t.platform;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'mdm_publish_release(text, int, text, text, bigint, text, text, text)',
    'mdm_set_firmware_target(uuid, uuid, text)',
    'mdm_list_releases()',
    'mdm_list_firmware_targets()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
