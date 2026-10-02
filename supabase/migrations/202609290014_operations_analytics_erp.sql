-- Phase 4 operations: aggregated analytics, customer segments, a durable
-- outbox worker contract, and traceable ERP synchronization.

create table public.analytics_daily_metrics (
  metric_date date primary key,
  paid_order_count integer not null default 0 check (paid_order_count >= 0),
  paid_revenue numeric(16,2) not null default 0 check (paid_revenue >= 0),
  new_rfq_count integer not null default 0 check (new_rfq_count >= 0),
  accepted_bulk_order_count integer not null default 0 check (accepted_bulk_order_count >= 0),
  accepted_bulk_revenue numeric(16,2) not null default 0 check (accepted_bulk_revenue >= 0),
  updated_at timestamptz not null default now()
);

create type public.customer_segment_key as enum ('new_customer', 'b2b_verified', 'high_value', 'inactive');
create table public.customer_segment_memberships (
  segment public.customer_segment_key not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  computed_at timestamptz not null default now(),
  primary key (segment, user_id)
);
create index customer_segment_memberships_user_idx on public.customer_segment_memberships(user_id);

alter table public.outbox_events add column if not exists locked_at timestamptz;
alter table public.outbox_events add column if not exists last_error text;
alter table public.outbox_events add column if not exists next_attempt_at timestamptz not null default now();
create index if not exists outbox_ready_idx on public.outbox_events(next_attempt_at, id) where processed_at is null;

create type public.erp_sync_status as enum ('pending', 'processing', 'synced', 'retrying', 'failed');
create table public.erp_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  outbox_event_id bigint not null unique references public.outbox_events(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status public.erp_sync_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index erp_sync_jobs_ready_idx on public.erp_sync_jobs(next_attempt_at, id) where status in ('pending','retrying');
create trigger erp_sync_jobs_set_updated_at before update on public.erp_sync_jobs for each row execute function private.set_updated_at();

alter table public.analytics_daily_metrics enable row level security;
alter table public.customer_segment_memberships enable row level security;
alter table public.erp_sync_jobs enable row level security;
revoke all on public.analytics_daily_metrics, public.customer_segment_memberships, public.erp_sync_jobs from anon, authenticated;

create or replace function public.refresh_operational_metrics(p_metric_date date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.analytics_daily_metrics(metric_date,paid_order_count,paid_revenue,new_rfq_count,accepted_bulk_order_count,accepted_bulk_revenue,updated_at)
  select p_metric_date,
    (select count(*) from public.orders o join public.payments p on p.order_id=o.id where p.status in ('capture','settlement') and o.paid_at::date=p_metric_date),
    coalesce((select sum(o.grand_total) from public.orders o join public.payments p on p.order_id=o.id where p.status in ('capture','settlement') and o.paid_at::date=p_metric_date),0),
    (select count(*) from public.rfqs where created_at::date=p_metric_date),
    (select count(*) from public.bulk_orders where approved_at::date=p_metric_date),
    coalesce((select sum(total_amount) from public.bulk_orders where approved_at::date=p_metric_date),0), now()
  on conflict(metric_date) do update set paid_order_count=excluded.paid_order_count,paid_revenue=excluded.paid_revenue,new_rfq_count=excluded.new_rfq_count,accepted_bulk_order_count=excluded.accepted_bulk_order_count,accepted_bulk_revenue=excluded.accepted_bulk_revenue,updated_at=now();
end; $$;

create or replace function public.refresh_customer_segments()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.customer_segment_memberships;
  insert into public.customer_segment_memberships(segment,user_id)
  select 'new_customer'::public.customer_segment_key,id from public.profiles where created_at >= now()-interval '30 days';
  insert into public.customer_segment_memberships(segment,user_id)
  select distinct om.user_id,'b2b_verified'::public.customer_segment_key from public.organization_members om join public.organizations o on o.id=om.organization_id where o.status='verified';
  insert into public.customer_segment_memberships(segment,user_id)
  select o.user_id,'high_value'::public.customer_segment_key from public.orders o join public.payments p on p.order_id=o.id where o.user_id is not null and p.status in ('capture','settlement') group by o.user_id having sum(o.grand_total)>=10000000
  on conflict do nothing;
  insert into public.customer_segment_memberships(segment,user_id)
  select p.id,'inactive'::public.customer_segment_key from public.profiles p where p.created_at < now()-interval '90 days' and not exists(select 1 from public.orders o where o.user_id=p.id and o.created_at>=now()-interval '90 days') and not exists(select 1 from public.rfqs r where r.user_id=p.id and r.created_at>=now()-interval '90 days')
  on conflict do nothing;
end; $$;

create or replace function public.claim_outbox_events(p_limit integer default 25)
returns table(id bigint,event_type text,aggregate_type text,aggregate_id text,payload jsonb) language plpgsql security definer set search_path = '' as $$
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'invalid claim limit' using errcode='22023'; end if;
  return query with claimed as (
    select e.id from public.outbox_events e where e.processed_at is null and e.next_attempt_at<=now() and (e.locked_at is null or e.locked_at<now()-interval '10 minutes') order by e.id limit p_limit for update skip locked
  ) update public.outbox_events e set locked_at=now(),attempts=e.attempts+1 from claimed c where e.id=c.id returning e.id,e.event_type,e.aggregate_type,e.aggregate_id,e.payload;
end; $$;

create or replace function public.complete_outbox_event(p_id bigint,p_success boolean,p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.outbox_events set processed_at=case when p_success then now() else null end,locked_at=null,last_error=case when p_success then null else left(coalesce(p_error,'worker failed'),2000) end,next_attempt_at=case when p_success then next_attempt_at else now()+least(interval '6 hours',interval '1 minute'*power(2,least(attempts,12))) end where id=p_id;
  if not found then raise exception 'outbox event not found' using errcode='P0002'; end if;
end; $$;

create or replace function public.enqueue_erp_sync(p_outbox_event_id bigint,p_event_type text,p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.erp_sync_jobs(outbox_event_id,event_type,payload) values(p_outbox_event_id,p_event_type,p_payload) on conflict(outbox_event_id) do nothing;
end; $$;

create or replace function public.claim_erp_sync_jobs(p_limit integer default 20)
returns table(id uuid,event_type text,payload jsonb) language plpgsql security definer set search_path = '' as $$
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'invalid claim limit' using errcode='22023'; end if;
  return query with claimed as (select j.id from public.erp_sync_jobs j where j.status in ('pending','retrying') and j.next_attempt_at<=now() and (j.locked_at is null or j.locked_at<now()-interval '10 minutes') order by j.created_at limit p_limit for update skip locked)
  update public.erp_sync_jobs j set status='processing',locked_at=now(),attempts=j.attempts+1 from claimed c where j.id=c.id returning j.id,j.event_type,j.payload;
end; $$;

create or replace function public.complete_erp_sync_job(p_id uuid,p_success boolean,p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.erp_sync_jobs set status=case when p_success then 'synced' else case when attempts>=10 then 'failed' else 'retrying' end end,locked_at=null,last_error=case when p_success then null else left(coalesce(p_error,'ERP sync failed'),2000) end,synced_at=case when p_success then now() else null end,next_attempt_at=case when p_success then next_attempt_at else now()+least(interval '12 hours',interval '1 minute'*power(2,least(attempts,12))) end where id=p_id;
  if not found then raise exception 'ERP sync job not found' using errcode='P0002'; end if;
end; $$;

revoke all on function public.refresh_operational_metrics(date), public.refresh_customer_segments(), public.claim_outbox_events(integer), public.complete_outbox_event(bigint,boolean,text), public.enqueue_erp_sync(bigint,text,jsonb), public.claim_erp_sync_jobs(integer), public.complete_erp_sync_job(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.refresh_operational_metrics(date), public.refresh_customer_segments(), public.claim_outbox_events(integer), public.complete_outbox_event(bigint,boolean,text), public.enqueue_erp_sync(bigint,text,jsonb), public.claim_erp_sync_jobs(integer), public.complete_erp_sync_job(uuid,boolean,text) to service_role;
