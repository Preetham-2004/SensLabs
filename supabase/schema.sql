-- Run this file once in Supabase Dashboard > SQL Editor > New query.
-- SensLab account credentials are managed by Supabase Auth, not stored in these tables.

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.calibrations (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.practice_rounds (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists calibrations_user_date_idx
  on public.calibrations (user_id, created_at desc);
create index if not exists practice_rounds_user_date_idx
  on public.practice_rounds (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_profiles_set_updated_at on public.player_profiles;
create trigger player_profiles_set_updated_at
  before update on public.player_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists calibrations_set_updated_at on public.calibrations;
create trigger calibrations_set_updated_at
  before update on public.calibrations
  for each row execute function public.set_updated_at();

alter table public.player_profiles enable row level security;
alter table public.calibrations enable row level security;
alter table public.practice_rounds enable row level security;

grant usage on schema public to service_role;
grant all on public.player_profiles, public.calibrations, public.practice_rounds to service_role;
