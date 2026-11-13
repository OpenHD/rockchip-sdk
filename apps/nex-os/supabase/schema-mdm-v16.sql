-- NEX MDM v16: dar de alta empresas y reenviar accesos sin tocar Supabase a mano.
--
-- Hasta v15, para una empresa nueva había que crear el usuario del dueño en el dashboard de Supabase y después la
-- empresa en el panel. Ahora la Edge Function mdm-invite también:
-- * kind = 'company': NEX (super-admin con 2FA reciente) crea la empresa y su dueño en un paso. Si el email no tiene
--   cuenta, Supabase le manda la invitación; después la función llama a mdm_create_company con el JWT de NEX.
-- * kind = 'resend': reenvía el acceso a un miembro (invitación si nunca entró, link de "contraseña nueva" si ya
--   tenía cuenta). Lo puede pedir NEX o un dueño de una empresa de la que esa persona es miembro.
-- mdm_list_members devuelve los miembros con su email y si ya entraron, para que el panel no muestre solo IDs.
-- Idempotente.

-- Alta de empresa: permisos y datos, antes de mandar ningún email.
create or replace function public.mdm_company_precheck(p_name text, p_owner_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_owner_email, '')));
begin
  if not public.mdm_is_super_admin() then
    raise exception 'Solo NEX puede crear empresas' using errcode = '42501';
  end if;
  perform public._mdm_require_recent_mfa();
  if length(btrim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'El nombre de la empresa debe tener entre 2 y 80 caracteres' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Email inválido' using errcode = '22023';
  end if;
  if exists (select 1 from public.mdm_companies where lower(name) = lower(btrim(p_name))) then
    raise exception 'Ya existe una empresa con ese nombre' using errcode = '23505';
  end if;
  if public._mdm_rate_limited('company-create', public._mdm_uid()::text, 50, interval '1 day') then
    raise exception 'Demasiadas empresas creadas hoy' using errcode = '54000';
  end if;
  return jsonb_build_object('exists', exists (select 1 from auth.users where lower(email) = v_email));
end;
$$;
revoke all on function public.mdm_company_precheck(text, text) from public, anon;
grant execute on function public.mdm_company_precheck(text, text) to authenticated;

-- Reenviar acceso: quién puede pedirlo y qué email corresponde mandar.
-- 'invite' si la persona nunca confirmó su cuenta; 'recovery' si ya la usaba.
create or replace function public.mdm_resend_precheck(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user auth.users;
begin
  select * into v_user from auth.users where lower(email) = v_email;
  if v_user.id is null then
    raise exception 'No hay una cuenta con ese email' using errcode = 'P0002';
  end if;
  if not public.mdm_is_super_admin() and not exists (
       select 1 from public.mdm_members m
        where m.user_id = v_user.id
          and public._mdm_company_role(m.company_id) in ('owner', 'super')) then
    raise exception 'Sin permiso sobre esa persona' using errcode = '42501';
  end if;
  perform public._mdm_require_recent_mfa();
  if public._mdm_rate_limited('resend', v_email, 5, interval '1 hour') then
    raise exception 'Ya se le reenvió el acceso varias veces en la última hora' using errcode = '54000';
  end if;
  perform public._mdm_audit(null, 'member.resend', v_email, '{}'::jsonb);
  return jsonb_build_object('type', case when v_user.email_confirmed_at is null and v_user.last_sign_in_at is null
                                         then 'invite' else 'recovery' end);
end;
$$;
revoke all on function public.mdm_resend_precheck(text) from public, anon;
grant execute on function public.mdm_resend_precheck(text) to authenticated;

-- Miembros con email y estado (los miembros de la empresa ven a sus compañeros; nada de otras empresas).
create or replace function public.mdm_list_members(p_company uuid)
returns table (user_id uuid, email text, role text, invited_at timestamptz, last_sign_in_at timestamptz, pending boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._mdm_require_role(p_company);
  return query
    select m.user_id, u.email::text, m.role, u.invited_at, u.last_sign_in_at,
           (u.last_sign_in_at is null)
      from public.mdm_members m
      join auth.users u on u.id = m.user_id
     where m.company_id = p_company
     order by m.role desc, lower(u.email);
end;
$$;
revoke all on function public.mdm_list_members(uuid) from public, anon;
grant execute on function public.mdm_list_members(uuid) to authenticated;
