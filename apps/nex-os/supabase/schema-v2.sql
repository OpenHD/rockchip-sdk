-- NEX Music — Schema v2 (auth, rankings, biblioteca en nube)
-- Ejecutá DESPUÉS de schema.sql si ya tenés la v1 instalada.

-- Habilitar auth anónimo en Dashboard → Authentication → Providers → Anonymous

alter table public.global_playlists
  add column if not exists play_count int not null default 0,
  add column if not exists owner_user_id uuid references auth.users(id);

alter table public.playlist_votes
  add column if not exists user_id uuid references auth.users(id);

alter table public.playlist_reactions
  add column if not exists user_id uuid references auth.users(id);

-- Migrar constraint de votos a user_id (1 voto por usuario autenticado)
alter table public.playlist_votes drop constraint if exists playlist_votes_playlist_id_voter_nickname_key;
create unique index if not exists idx_playlist_votes_user
  on public.playlist_votes(playlist_id, user_id)
  where user_id is not null;

create index if not exists idx_playlist_votes_created on public.playlist_votes(created_at desc);
create index if not exists idx_playlist_reactions_created on public.playlist_reactions(created_at desc);

create table if not exists public.user_library (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  favorites jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.increment_playlist_plays(playlist_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.global_playlists
  set play_count = play_count + 1, updated_at = now()
  where id = playlist_uuid;
$$;

grant execute on function public.increment_playlist_plays(uuid) to anon, authenticated;

-- Políticas con auth (reemplazan las abiertas para votos/reacciones/biblioteca)
drop policy if exists "playlist_votes_insert" on public.playlist_votes;
drop policy if exists "playlist_votes_delete" on public.playlist_votes;
drop policy if exists "playlist_reactions_insert" on public.playlist_reactions;

create policy "playlist_votes_insert_auth" on public.playlist_votes
  for insert with check (auth.uid() = user_id);

create policy "playlist_votes_delete_auth" on public.playlist_votes
  for delete using (auth.uid() = user_id);

create policy "playlist_reactions_insert_auth" on public.playlist_reactions
  for insert with check (auth.uid() = user_id);

alter table public.user_library enable row level security;

create policy "user_library_select_own" on public.user_library
  for select using (auth.uid() = user_id);

create policy "user_library_insert_own" on public.user_library
  for insert with check (auth.uid() = user_id);

create policy "user_library_update_own" on public.user_library
  for update using (auth.uid() = user_id);

alter publication supabase_realtime add table public.user_library;
