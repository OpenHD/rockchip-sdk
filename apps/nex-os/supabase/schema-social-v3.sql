-- NEX Music social extras (comments, follows, share opens)
-- Ejecutá en Supabase SQL Editor después de schema.sql / schema-playlist-shares.sql

create table if not exists public.playlist_comments (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.global_playlists(id) on delete cascade,
  user_nickname text not null,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists idx_playlist_comments_playlist on public.playlist_comments(playlist_id, created_at desc);

alter table public.playlist_comments enable row level security;
drop policy if exists "playlist_comments_select" on public.playlist_comments;
drop policy if exists "playlist_comments_insert" on public.playlist_comments;
create policy "playlist_comments_select" on public.playlist_comments for select using (true);
create policy "playlist_comments_insert" on public.playlist_comments for insert with check (true);

create table if not exists public.creator_follows (
  id uuid primary key default gen_random_uuid(),
  follower_nickname text not null,
  creator_nickname text not null,
  created_at timestamptz not null default now(),
  unique (follower_nickname, creator_nickname)
);

alter table public.creator_follows enable row level security;
drop policy if exists "creator_follows_select" on public.creator_follows;
drop policy if exists "creator_follows_insert" on public.creator_follows;
drop policy if exists "creator_follows_delete" on public.creator_follows;
create policy "creator_follows_select" on public.creator_follows for select using (true);
create policy "creator_follows_insert" on public.creator_follows for insert with check (true);
create policy "creator_follows_delete" on public.creator_follows for delete using (true);

-- Contador de opens en links cortos
alter table public.playlist_shares
  add column if not exists open_count integer not null default 0;
