-- Password-reset rate-limit storage. Do not store raw email addresses, IP addresses,
-- reset codes, or any other identifier here. The application passes a scoped HMAC-SHA-256
-- digest made with PASSWORD_RESET_RATE_LIMIT_HMAC_SECRET.
--
-- This file is intentionally not applied by this change. Apply it only through the normal
-- reviewed Supabase migration process after the server-side caller is deployed.

begin;

create table public.password_reset_rate_limits (
  scope text not null check (scope in (
    'forgot_password_ip',
    'forgot_password_email',
    'reset_password_ip',
    'reset_password_user'
  )),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  request_count integer not null check (request_count >= 1),
  window_started_at timestamptz not null,
  window_ends_at timestamptz not null check (window_ends_at > window_started_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash)
);

create index password_reset_rate_limits_expiry_idx
  on public.password_reset_rate_limits (window_ends_at);

alter table public.password_reset_rate_limits enable row level security;

-- Browser roles have neither direct table access nor RLS policies. Only the server invokes
-- the security-definer RPC through the service-role client.
revoke all on table public.password_reset_rate_limits from public, anon, authenticated;

create or replace function public.purge_password_reset_rate_limits(p_limit integer default 1000)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate-limit purge limit' using errcode = '22023';
  end if;

  with expired as (
    select ctid
    from public.password_reset_rate_limits
    where window_ends_at <= clock_timestamp()
    order by window_ends_at
    limit p_limit
  )
  delete from public.password_reset_rate_limits as rate_limit
  using expired
  where rate_limit.ctid = expired.ctid;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.consume_password_reset_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_time timestamptz := clock_timestamp();
  current_count integer;
  current_window_ends_at timestamptz;
begin
  if p_scope not in (
    'forgot_password_ip',
    'forgot_password_email',
    'reset_password_ip',
    'reset_password_user'
  ) then
    raise exception 'invalid rate-limit scope' using errcode = '22023';
  end if;

  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid rate-limit key' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid rate-limit limit' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit window' using errcode = '22023';
  end if;

  -- Bounded cleanup keeps the table small without a table-wide delete on every request.
  perform public.purge_password_reset_rate_limits(100);

  -- A single UPSERT consumes this bucket atomically. Concurrent requests serialize on the
  -- primary key, so exactly one request sees each incremented counter value.
  insert into public.password_reset_rate_limits as rate_limit (
    scope,
    key_hash,
    request_count,
    window_started_at,
    window_ends_at,
    updated_at
  )
  values (
    p_scope,
    p_key_hash,
    1,
    request_time,
    request_time + (p_window_seconds * interval '1 second'),
    request_time
  )
  on conflict (scope, key_hash) do update
  set
    request_count = case
      when rate_limit.window_ends_at <= request_time then 1
      else rate_limit.request_count + 1
    end,
    window_started_at = case
      when rate_limit.window_ends_at <= request_time then request_time
      else rate_limit.window_started_at
    end,
    window_ends_at = case
      when rate_limit.window_ends_at <= request_time
        then request_time + (p_window_seconds * interval '1 second')
      else rate_limit.window_ends_at
    end,
    updated_at = request_time
  returning request_count, window_ends_at
  into current_count, current_window_ends_at;

  return query
  select
    current_count <= p_limit,
    greatest(0, ceil(extract(epoch from current_window_ends_at - request_time))::integer);
end;
$$;

revoke all on function public.purge_password_reset_rate_limits(integer) from public, anon, authenticated;
revoke all on function public.consume_password_reset_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.purge_password_reset_rate_limits(integer) to service_role;
grant execute on function public.consume_password_reset_rate_limit(text, text, integer, integer) to service_role;

comment on table public.password_reset_rate_limits is
  'Server-only HMAC-keyed reset-password rate-limit buckets. No raw identifiers are stored.';
comment on function public.consume_password_reset_rate_limit(text, text, integer, integer) is
  'Atomically consumes one HMAC-keyed reset-password rate-limit bucket. Service role only.';

commit;
