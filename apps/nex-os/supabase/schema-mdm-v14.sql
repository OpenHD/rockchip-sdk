-- NEX MDM v14: invitar miembros por email (sin pasarles la contraseña a mano).
--
-- Hasta v13, mdm_set_member solo sumaba cuentas que ya existían: NEX creaba el usuario con una contraseña y se la pasaba
-- a la persona. Ahora el dueño de la empresa invita desde el panel (Miembros): la Edge Function mdm-invite llama primero
-- a mdm_invite_precheck con el JWT del dueño (rol, 2FA reciente, formato y límite), después crea la invitación con la
-- clave de servicio (Supabase manda el email con el link) y por último suma al miembro con mdm_set_member, también con
-- el JWT del dueño (queda en la auditoría con su usuario). La persona define su contraseña desde el link.
-- Idempotente.

create or replace function public.mdm_invite_precheck(p_company uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  perform public._mdm_require_role(p_company, true);
  if p_role is null or p_role not in ('owner', 'admin') then
    raise exception 'Rol inválido' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Email inválido' using errcode = '22023';
  end if;
  if public._mdm_rate_limited('invite', p_company::text, 30, interval '1 day') then
    raise exception 'Demasiadas invitaciones hoy' using errcode = '54000';
  end if;
  perform public._mdm_audit(p_company, 'member.invite', v_email, jsonb_build_object('role', p_role));
  return jsonb_build_object('exists', exists (select 1 from auth.users where lower(email) = v_email));
end;
$$;
revoke all on function public.mdm_invite_precheck(uuid, text, text) from public, anon;
grant execute on function public.mdm_invite_precheck(uuid, text, text) to authenticated;
