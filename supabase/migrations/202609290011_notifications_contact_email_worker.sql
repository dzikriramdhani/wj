-- Notification, contact, and durable email-delivery foundations.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (char_length(type) between 2 and 80),
  title text not null check (char_length(title) between 2 and 180),
  body text not null default '' check (char_length(body) <= 2000),
  link_path text check (link_path is null or link_path ~ '^/[^\\s]*$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null check (char_length(subject) between 3 and 200),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'read', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contact_messages_status_created_idx on public.contact_messages (status, created_at desc);
create trigger contact_messages_set_updated_at before update on public.contact_messages
  for each row execute function private.set_updated_at();

alter table public.notifications enable row level security;
alter table public.contact_messages enable row level security;

grant select, update (read_at) on public.notifications to authenticated;
create policy "users read their notifications" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "users mark their notifications read" on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.contact_messages from anon, authenticated;

create or replace function public.claim_email_outbox(p_limit integer default 20)
returns table (
  id uuid,
  recipient_email text,
  template_key text,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid email batch limit' using errcode = '22023';
  end if;

  return query
  with claimed as (
    select e.id
    from public.email_outbox e
    where e.status in ('pending', 'failed') and e.available_at <= now()
    order by e.available_at, e.created_at
    limit p_limit
    for update skip locked
  )
  update public.email_outbox e
  set status = 'processing', attempts = e.attempts + 1, last_error = null
  from claimed
  where e.id = claimed.id
  returning e.id, e.recipient_email, e.template_key, e.payload;
end;
$$;

create or replace function public.complete_email_outbox(
  p_id uuid,
  p_sent boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null then raise exception 'email id required' using errcode = '22023'; end if;

  update public.email_outbox
  set status = case when p_sent then 'sent' else 'failed' end,
      sent_at = case when p_sent then now() else sent_at end,
      available_at = case
        when p_sent then available_at
        else now() + least(interval '1 hour', interval '1 minute' * power(2, least(attempts, 6)))
      end,
      last_error = case when p_sent then null else left(coalesce(p_error, 'delivery failed'), 1000) end
  where id = p_id and status = 'processing';
end;
$$;

revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_email_outbox(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;
grant execute on function public.complete_email_outbox(uuid, boolean, text) to service_role;

comment on table public.notifications is 'User-owned in-app notifications; server and worker write only.';
comment on table public.contact_messages is 'Public contact messages. Browser roles have no direct table access.';
