-- NEX-OS MDM v8 — verificación reforzada (step-up) para acciones críticas del panel.
-- Ejecutá DESPUÉS de schema-mdm-v7.sql. Es idempotente.
--
-- Una sesión robada (token copiado de un navegador) no alcanza para:
--   desvincular equipos, cambiar miembros, crear empresas, editar el catálogo global,
--   clasificar dominios como piratería, ni redirigir los avisos de seguridad.
-- Esas acciones exigen que el segundo factor (TOTP) se haya ingresado hace menos de 5 minutos.
-- Supabase lo informa en el JWT: claim "amr" = [{"method": "totp", "timestamp": <epoch>}, ...].
-- El panel pide el código cuando hace falta y reintenta.

create or replace function public._mdm_require_recent_mfa(p_max_age interval default interval '5 minutes')
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from jsonb_array_elements(
             case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
           ) a
     where a ->> 'method' = 'totp'
       and (a ->> 'timestamp') ~ '^[0-9]{9,11}$'
       and to_timestamp((a ->> 'timestamp')::bigint) > now() - p_max_age
  ) then
    -- SQLSTATE propio: el panel lo reconoce y pide el código.
    raise exception 'Confirmá con tu código de segundo factor para continuar'
      using errcode = 'P0401', hint = 'step_up_required';
  end if;
end;
$$;
revoke all on function public._mdm_require_recent_mfa(interval) from public, anon, authenticated;

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
  if p_owner_only then
    perform public._mdm_require_recent_mfa();
  end if;
  return v_role;
end;
$$;

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
  perform public._mdm_require_recent_mfa();
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
  perform public._mdm_require_recent_mfa();
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
  perform public._mdm_require_recent_mfa();
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
  -- Cambiar a dónde llegan los avisos podría ocultar una manipulación: exige 2FA reciente.
  perform public._mdm_require_recent_mfa();
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
