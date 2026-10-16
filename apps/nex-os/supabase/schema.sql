-- NEX Music — Global Playlists (Supabase)
-- Ejecutá este script en el SQL Editor de tu proyecto Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.global_playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover text,
  tracks jsonb not null default '[]'::jsonb,
  owner_nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_votes (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.global_playlists(id) on delete cascade,
  voter_nickname text not null,
  created_at timestamptz not null default now(),
  unique (playlist_id, voter_nickname)
);

create table if not exists public.playlist_reactions (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.global_playlists(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  user_nickname text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_playlist_votes_playlist on public.playlist_votes(playlist_id);
create index if not exists idx_playlist_reactions_playlist on public.playlist_reactions(playlist_id);
create index if not exists idx_global_playlists_updated on public.global_playlists(updated_at desc);

alter table public.global_playlists enable row level security;
alter table public.playlist_votes enable row level security;
alter table public.playlist_reactions enable row level security;

create policy "global_playlists_select" on public.global_playlists for select using (true);
create policy "global_playlists_insert" on public.global_playlists for insert with check (true);
create policy "global_playlists_update" on public.global_playlists for update using (true);

create policy "playlist_votes_select" on public.playlist_votes for select using (true);
create policy "playlist_votes_insert" on public.playlist_votes for insert with check (true);
create policy "playlist_votes_delete" on public.playlist_votes for delete using (true);

create policy "playlist_reactions_select" on public.playlist_reactions for select using (true);
create policy "playlist_reactions_insert" on public.playlist_reactions for insert with check (true);

-- Realtime (activar también en Dashboard → Database → Replication)
alter publication supabase_realtime add table public.global_playlists;
alter publication supabase_realtime add table public.playlist_votes;
alter publication supabase_realtime add table public.playlist_reactions;
