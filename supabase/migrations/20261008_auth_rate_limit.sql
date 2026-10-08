-- Shared account-attempt counters used by the API across workers and replicas.
create table if not exists public.auth_rate_limits (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  bucket_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key (key_hash, bucket_start)
);

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
