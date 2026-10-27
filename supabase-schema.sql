-- AGCC Scorer starter schema for Supabase (PostgreSQL)
-- Run in Supabase SQL Editor. Review and tighten RLS policies before production.
create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  role text not null default 'Batter',
  is_playing_xi boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  team_a uuid references public.teams(id) on delete set null,
  team_b uuid references public.teams(id) on delete set null,
  overs_limit integer not null default 5 check (overs_limit > 0),
  status text not null default 'scheduled' check (status in ('scheduled','live','completed')),
  target integer,
  result text,
  created_at timestamptz not null default now()
);
create table if not exists public.innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  innings_number integer not null check (innings_number in (1,2)),
  batting_team uuid references public.teams(id) on delete set null,
  bowling_team uuid references public.teams(id) on delete set null,
  runs integer not null default 0,
  wickets integer not null default 0,
  legal_balls integer not null default 0,
  unique(match_id, innings_number)
);
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references public.innings(id) on delete cascade,
  ball_number integer not null,
  batter_id uuid references public.players(id) on delete set null,
  bowler_id uuid references public.players(id) on delete set null,
  batter_runs integer not null default 0,
  extras_type text,
  extras_runs integer not null default 0,
  is_legal boolean not null default true,
  wicket_type text,
  created_at timestamptz not null default now(),
  unique(innings_id, ball_number)
);
create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  round_name text not null default 'League',
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Starter policies: public reads only. Admin write operations should be done via
-- authenticated admin accounts and stricter policies, not anonymous public write access.
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.innings enable row level security;
alter table public.deliveries enable row level security;
alter table public.fixtures enable row level security;

create policy "Public can read teams" on public.teams for select using (true);
create policy "Public can read players" on public.players for select using (true);
create policy "Public can read matches" on public.matches for select using (true);
create policy "Public can read innings" on public.innings for select using (true);
create policy "Public can read deliveries" on public.deliveries for select using (true);
create policy "Public can read fixtures" on public.fixtures for select using (true);


-- Shared app snapshot used by this starter's realtime sync.
create table if not exists public.app_state (
  id text primary key check (id = 'main'),
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security;
create policy "Public can read shared scoreboard" on public.app_state
  for select using (true);
create policy "Only admin-role users can insert shared scoreboard" on public.app_state
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Only admin-role users can update shared scoreboard" on public.app_state
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Enable Realtime for app_state in Supabase Dashboard > Database > Publications
-- (or add public.app_state to the supabase_realtime publication).
