-- NEX Music — Perfiles + usuarios verificados (v4)
-- Ejecutá en Supabase SQL Editor DESPUÉS de schema-v2 / schema-social-v3.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  nickname_normalized text generated always as (lower(trim(nickname))) stored,
  display_name text,
  bio text check (bio is null or char_length(bio) <= 160),
  avatar_url text,
  verified boolean not null default false,
  verified_at timestamptz,
  verified_reason text
    check (
      verified_reason is null
      or verified_reason in ('creator', 'artist', 'staff', 'partner')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nickname_normalized)
);

create index if not exists idx_user_profiles_verified
  on public.user_profiles (verified, updated_at desc)
  where verified = true;

create index if not exists idx_user_profiles_nickname
  on public.user_profiles (nickname_normalized);

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;

create policy "user_profiles_select" on public.user_profiles
  for select using (true);

create policy "user_profiles_insert_own" on public.user_profiles
  for insert with check (auth.uid() = user_id);

create policy "user_profiles_update_own" on public.user_profiles
  for update using (auth.uid() = user_id);

-- Impide que el cliente se auto-verifique (solo admin_verify_nickname / SQL con flag)
create or replace function public.protect_user_profile_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bypass for admin_verify_nickname (set_config local to transaction)
  if current_setting('nex.allow_verify', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.verified_at := null;
    new.verified_reason := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.verified := old.verified;
    new.verified_at := old.verified_at;
    new.verified_reason := old.verified_reason;
    new.updated_at := now();
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_user_profile_verified on public.user_profiles;
create trigger trg_protect_user_profile_verified
  before insert or update on public.user_profiles
  for each row execute function public.protect_user_profile_verified();

-- Solicitudes de verificación (revisión manual)
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  message text check (message is null or char_length(message) <= 280),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_verification_one_pending
  on public.verification_requests (user_id)
  where status = 'pending';

alter table public.verification_requests enable row level security;

drop policy if exists "verification_requests_select_own" on public.verification_requests;
drop policy if exists "verification_requests_insert_own" on public.verification_requests;

create policy "verification_requests_select_own" on public.verification_requests
  for select using (auth.uid() = user_id);

create policy "verification_requests_insert_own" on public.verification_requests
  for insert with check (auth.uid() = user_id);

-- Admin helpers (correr en SQL Editor como postgres / service role)
-- Verificar un nickname:
--   select public.admin_verify_nickname('Salva', 'creator');
create or replace function public.admin_verify_nickname(
  p_nickname text,
  p_reason text default 'creator'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('nex.allow_verify', 'on', true);

  update public.user_profiles
  set
    verified = true,
    verified_at = now(),
    verified_reason = p_reason,
    updated_at = now()
  where nickname_normalized = lower(trim(p_nickname));

  if not found then
    raise exception 'No hay perfil con nickname % — que el usuario abra NEX Music una vez con ese nick', p_nickname;
  end if;

  update public.verification_requests
  set status = 'approved'
  where lower(trim(nickname)) = lower(trim(p_nickname))
    and status = 'pending';
end;
$$;

revoke all on function public.admin_verify_nickname(text, text) from public, anon, authenticated;

comment on table public.user_profiles is 'Perfiles NEX Music; verified solo vía admin_verify_nickname / SQL';
