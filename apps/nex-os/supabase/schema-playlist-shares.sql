-- NEX Music — short playlist share links
-- Ejecutá en el SQL Editor de Supabase.

create table if not exists public.playlist_shares (
  code text primary key,
  name text not null,
  cover text,
  tracks jsonb not null default '[]'::jsonb,
  owner_nickname text not null default 'Anonymous',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_playlist_shares_created on public.playlist_shares(created_at desc);

alter table public.playlist_shares enable row level security;

drop policy if exists "playlist_shares_select" on public.playlist_shares;
drop policy if exists "playlist_shares_insert" on public.playlist_shares;

create policy "playlist_shares_select" on public.playlist_shares for select using (true);
create policy "playlist_shares_insert" on public.playlist_shares for insert with check (true);
