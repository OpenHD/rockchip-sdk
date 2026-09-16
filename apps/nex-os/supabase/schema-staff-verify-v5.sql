-- NEX Music — Staff verify desde la app (sin SQL cada vez)
-- Ejecutá UNA VEZ en Supabase SQL Editor (después de schema-profiles-v4.sql).

-- Clave de staff (cambiá el valor por defecto después del primer run)
create table if not exists public.nex_staff_config (
  id int primary key default 1 check (id = 1),
  staff_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.nex_staff_config enable row level security;
-- Sin policies de SELECT/INSERT/UPDATE para anon/authenticated:
-- solo functions security definer leen esta tabla.

insert into public.nex_staff_config (id, staff_key)
values (1, 'nex-staff-cambia-esto')
on conflict (id) do nothing;

create or replace function public._nex_staff_key_ok(p_staff_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.nex_staff_config c
    where c.id = 1
      and c.staff_key = p_staff_key
      and length(trim(p_staff_key)) >= 6
  );
$$;

revoke all on function public._nex_staff_key_ok(text) from public, anon, authenticated;

create or replace function public.staff_unlock(p_staff_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._nex_staff_key_ok(p_staff_key);
end;
$$;

grant execute on function public.staff_unlock(text) to anon, authenticated;

create or replace function public.staff_verify_nickname(
  p_nickname text,
  p_reason text default 'creator',
  p_staff_key text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if not public._nex_staff_key_ok(p_staff_key) then
    raise exception 'Clave de staff inválida';
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), 'creator');
  if v_reason not in ('creator', 'artist', 'staff', 'partner') then
    v_reason := 'creator';
  end if;

  perform set_config('nex.allow_verify', 'on', true);

  update public.user_profiles
  set
    verified = true,
    verified_at = now(),
    verified_reason = v_reason,
    updated_at = now()
  where nickname_normalized = lower(trim(p_nickname));

  if not found then
    raise exception 'No hay perfil con nickname "%" — que abra NEX Music una vez con ese nick', p_nickname;
  end if;

  update public.verification_requests
  set status = 'approved'
  where lower(trim(nickname)) = lower(trim(p_nickname))
    and status = 'pending';

  return jsonb_build_object('ok', true, 'nickname', trim(p_nickname), 'reason', v_reason);
end;
$$;

grant execute on function public.staff_verify_nickname(text, text, text) to anon, authenticated;

create or replace function public.staff_unverify_nickname(
  p_nickname text,
  p_staff_key text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._nex_staff_key_ok(p_staff_key) then
    raise exception 'Clave de staff inválida';
  end if;

  perform set_config('nex.allow_verify', 'on', true);

  update public.user_profiles
  set
    verified = false,
    verified_at = null,
    verified_reason = null,
    updated_at = now()
  where nickname_normalized = lower(trim(p_nickname));

  if not found then
    raise exception 'No hay perfil con nickname "%"', p_nickname;
  end if;

  return jsonb_build_object('ok', true, 'nickname', trim(p_nickname));
end;
$$;

grant execute on function public.staff_unverify_nickname(text, text) to anon, authenticated;

create or replace function public.staff_list_pending(p_staff_key text default '')
returns table (
  id uuid,
  user_id uuid,
  nickname text,
  message text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._nex_staff_key_ok(p_staff_key) then
    raise exception 'Clave de staff inválida';
  end if;

  return query
  select r.id, r.user_id, r.nickname, r.message, r.status, r.created_at
  from public.verification_requests r
  where r.status = 'pending'
  order by r.created_at asc
  limit 100;
end;
$$;

grant execute on function public.staff_list_pending(text) to anon, authenticated;

create or replace function public.staff_reject_request(
  p_request_id uuid,
  p_staff_key text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._nex_staff_key_ok(p_staff_key) then
    raise exception 'Clave de staff inválida';
  end if;

  update public.verification_requests
  set status = 'rejected'
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'Solicitud no encontrada o ya resuelta';
  end if;

  return jsonb_build_object('ok', true, 'id', p_request_id);
end;
$$;

grant execute on function public.staff_reject_request(uuid, text) to anon, authenticated;

create or replace function public.staff_set_key(
  p_old_key text,
  p_new_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._nex_staff_key_ok(p_old_key) then
    raise exception 'Clave de staff inválida';
  end if;
  if length(trim(p_new_key)) < 8 then
    raise exception 'La nueva clave debe tener al menos 8 caracteres';
  end if;

  update public.nex_staff_config
  set staff_key = trim(p_new_key), updated_at = now()
  where id = 1;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.staff_set_key(text, text) to anon, authenticated;

comment on table public.nex_staff_config is 'Clave staff para verificar usuarios desde la app. Cambiá el default.';
