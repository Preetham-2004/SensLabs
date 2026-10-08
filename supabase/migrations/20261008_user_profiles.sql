-- Add persistent username and game preference fields for existing SensLab installs.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  preferred_game text not null check (preferred_game in ('valorant', 'cs2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_profiles_username_lower_uidx
  on public.user_profiles (lower(username));

insert into public.user_profiles (user_id, username, preferred_game)
select id, raw_user_meta_data ->> 'username', raw_user_meta_data ->> 'preferred_game'
from auth.users
where raw_user_meta_data ->> 'username' ~ '^[A-Za-z0-9_]{3,24}$'
  and raw_user_meta_data ->> 'preferred_game' in ('valorant', 'cs2')
order by created_at
on conflict do nothing;

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

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;
grant usage on schema public to service_role;
grant all on public.user_profiles to service_role;
