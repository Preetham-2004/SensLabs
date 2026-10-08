-- Run this file once in Supabase Dashboard > SQL Editor > New query.
-- SensLab account credentials are managed by Supabase Auth, not stored in these tables.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  preferred_game text not null check (preferred_game in ('valorant', 'cs2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_profiles_username_lower_uidx
  on public.user_profiles (lower(username));

-- Copy valid profile details from earlier accounts' Auth metadata.
insert into public.user_profiles (user_id, username, preferred_game)
select id, raw_user_meta_data ->> 'username', raw_user_meta_data ->> 'preferred_game'
from auth.users
where raw_user_meta_data ->> 'username' ~ '^[A-Za-z0-9_]{3,24}$'
  and raw_user_meta_data ->> 'preferred_game' in ('valorant', 'cs2')
order by created_at
on conflict do nothing;

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

-- Shared, short-lived counters used to limit account attempts across API workers.
create table if not exists public.auth_rate_limits (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  bucket_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key (key_hash, bucket_start)
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

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists calibrations_set_updated_at on public.calibrations;
create trigger calibrations_set_updated_at
  before update on public.calibrations
  for each row execute function public.set_updated_at();

alter table public.player_profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.calibrations enable row level security;
alter table public.practice_rounds enable row level security;

grant usage on schema public to service_role;
revoke all on public.user_profiles, public.player_profiles, public.calibrations, public.practice_rounds from anon, authenticated;
grant all on public.user_profiles, public.player_profiles, public.calibrations, public.practice_rounds to service_role;
alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated, service_role;

create or replace function public.consume_auth_rate_limit(p_key_hash text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket_start timestamptz;
  v_hits integer;
begin
  if p_key_hash is null or p_limit is null or p_key_hash !~ '^[0-9a-f]{64}$' or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid auth rate limit arguments';
  end if;

  v_bucket_start := to_timestamp(floor(extract(epoch from now()) / 60) * 60);
  insert into public.auth_rate_limits (key_hash, bucket_start, hits)
  values (p_key_hash, v_bucket_start, 1)
  on conflict (key_hash, bucket_start)
  do update set hits = public.auth_rate_limits.hits + 1
  returning hits into v_hits;

  delete from public.auth_rate_limits
  where bucket_start < v_bucket_start - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_auth_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, integer) to service_role;
