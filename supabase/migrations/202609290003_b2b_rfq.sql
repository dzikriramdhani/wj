-- B2B RFQ/quotation records. RFQ creation is atomic and idempotent; browser
-- roles have read access only and cannot set workflow status or quote prices.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.rfq_status as enum (
  'submitted', 'reviewed', 'quoted', 'negotiating', 'accepted', 'rejected', 'in_production', 'completed'
);
create type public.quotation_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded');

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  status public.rfq_status not null default 'submitted',
  specifications jsonb not null default '{}'::jsonb check (jsonb_typeof(specifications) = 'object'),
  deadline timestamptz,
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rfqs_user_created_idx on public.rfqs (user_id, created_at desc);
create index rfqs_organization_created_idx on public.rfqs (organization_id, created_at desc);
create index rfqs_status_created_idx on public.rfqs (status, created_at desc);

create table public.rfq_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  requested_quantity numeric(12, 2) not null check (requested_quantity > 0),
  unit text not null default 'meter' check (char_length(unit) between 1 and 24),
  custom_specifications jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_specifications) = 'object'),
  created_at timestamptz not null default now()
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  status public.quotation_status not null default 'draft',
  currency char(3) not null default 'IDR',
  payment_terms text not null default '',
  valid_until timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (rfq_id, revision)
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  rfq_item_id uuid references public.rfq_items(id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(16, 2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now()
);

create table public.quotation_revisions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  revision integer not null check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  changed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (quotation_id, revision)
);

create table public.idempotency_keys (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_key text not null check (char_length(request_key) between 8 and 128),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  primary key (user_id, request_key)
);

create table public.outbox_events (
  id bigint generated always as identity primary key,
  event_type text not null check (char_length(event_type) between 1 and 120),
  aggregate_type text not null check (char_length(aggregate_type) between 1 and 80),
  aggregate_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0)
);

create index outbox_unprocessed_idx on public.outbox_events (created_at, id) where processed_at is null;

create or replace function private.has_platform_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid()) and r.name::text = any (allowed_roles)
  );
$$;

grant execute on function private.has_platform_role(text[]) to authenticated;

create trigger rfqs_set_updated_at before update on public.rfqs
  for each row execute function private.set_updated_at();

alter table public.rfqs enable row level security;
alter table public.rfq_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_revisions enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.outbox_events enable row level security;

grant select on public.rfqs, public.rfq_items, public.quotations, public.quotation_items, public.quotation_revisions to authenticated;

create policy "customers and assigned staff can read RFQs" on public.rfqs
  for select to authenticated using (
    user_id = (select auth.uid())
    or (organization_id is not null and private.is_organization_member(organization_id))
    or private.has_platform_role(array['sales', 'admin'])
  );
create policy "RFQ readers can read RFQ items" on public.rfq_items
  for select to authenticated using (
    exists (select 1 from public.rfqs r where r.id = rfq_id)
  );
create policy "RFQ readers can read quotations" on public.quotations
  for select to authenticated using (
    exists (select 1 from public.rfqs r where r.id = rfq_id)
  );
create policy "RFQ readers can read quotation items" on public.quotation_items
  for select to authenticated using (
    exists (
      select 1 from public.quotations q
      join public.rfqs r on r.id = q.rfq_id
      where q.id = quotation_id
    )
  );
create policy "RFQ readers can read quotation revisions" on public.quotation_revisions
  for select to authenticated using (
    exists (
      select 1 from public.quotations q
      join public.rfqs r on r.id = q.rfq_id
      where q.id = quotation_id
    )
  );

revoke all on public.idempotency_keys, public.outbox_events from anon, authenticated;
revoke insert, update, delete on public.rfqs, public.rfq_items, public.quotations,
  public.quotation_items, public.quotation_revisions from anon, authenticated;

create or replace function public.create_rfq(
  p_request_key text,
  p_product_id uuid,
  p_quantity numeric,
  p_specifications jsonb,
  p_deadline timestamptz default null,
  p_attachments jsonb default '[]'::jsonb,
  p_organization_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  payload_hash text;
  saved_hash text;
  saved_response jsonb;
  created_rfq_id uuid;
begin
  if actor_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid quantity' using errcode = '22023'; end if;
  if p_request_key is null or char_length(p_request_key) < 8 or char_length(p_request_key) > 128 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;
  if p_specifications is null or jsonb_typeof(p_specifications) <> 'object' then
    raise exception 'invalid specifications' using errcode = '22023';
  end if;
  if p_attachments is null or jsonb_typeof(p_attachments) <> 'array' then
    raise exception 'invalid attachments' using errcode = '22023';
  end if;
  if jsonb_array_length(p_attachments) > 0 then
    raise exception 'file upload workflow is not enabled' using errcode = '22023';
  end if;
  if p_product_id is not null and not exists (
    select 1 from public.products p where p.id = p_product_id and p.is_active
      and p.published_at is not null and p.published_at <= now()
  ) then raise exception 'product unavailable' using errcode = '22023'; end if;
  if p_organization_id is not null and not exists (
    select 1 from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = p_organization_id and om.user_id = actor_id
      and om.role in ('owner', 'admin', 'buyer') and o.status = 'verified'
  ) then raise exception 'verified organization membership required' using errcode = '42501'; end if;

  payload_hash := encode(extensions.digest(
    convert_to(jsonb_build_object(
      'product_id', p_product_id,
      'quantity', p_quantity,
      'specifications', p_specifications,
      'deadline', p_deadline,
      'attachments', p_attachments,
      'organization_id', p_organization_id
    )::text, 'UTF8'), 'sha256'), 'hex');

  delete from public.idempotency_keys
  where user_id = actor_id and request_key = p_request_key and expires_at <= now();

  insert into public.idempotency_keys (user_id, request_key, request_hash)
  values (actor_id, p_request_key, payload_hash)
  on conflict (user_id, request_key) do nothing;

  select request_hash, response into saved_hash, saved_response
  from public.idempotency_keys
  where user_id = actor_id and request_key = p_request_key
  for update;

  if saved_hash <> payload_hash then
    raise exception 'idempotency key reused with different request' using errcode = '22023';
  end if;
  if saved_response is not null then return (saved_response ->> 'rfq_id')::uuid; end if;

  insert into public.rfqs (user_id, organization_id, specifications, deadline, attachments)
  values (actor_id, p_organization_id, p_specifications, p_deadline, p_attachments)
  returning id into created_rfq_id;

  insert into public.rfq_items (rfq_id, product_id, requested_quantity, custom_specifications)
  values (created_rfq_id, p_product_id, p_quantity, p_specifications);

  insert into public.audit_logs (actor_user_id, organization_id, action, entity_type, entity_id, metadata)
  values (actor_id, p_organization_id, 'rfq.created', 'rfq', created_rfq_id::text,
    jsonb_build_object('status', 'submitted'));

  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
  values (
    'rfq.submitted', 'rfq', created_rfq_id::text,
    jsonb_build_object('rfq_id', created_rfq_id, 'user_id', actor_id)
  );

  update public.idempotency_keys set response = jsonb_build_object('rfq_id', created_rfq_id)
  where user_id = actor_id and request_key = p_request_key;

  return created_rfq_id;
end;
$$;

revoke all on function public.create_rfq(text, uuid, numeric, jsonb, timestamptz, jsonb, uuid) from public, anon;
grant execute on function public.create_rfq(text, uuid, numeric, jsonb, timestamptz, jsonb, uuid) to authenticated;

create or replace function public.update_rfq_status(p_rfq_id uuid, p_next_status public.rfq_status)
returns public.rfq_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_status public.rfq_status;
  transition_allowed boolean := false;
begin
  if actor_id is null or not private.has_platform_role(array['sales', 'admin']) then
    raise exception 'sales or admin role required' using errcode = '42501';
  end if;

  select status into current_status from public.rfqs where id = p_rfq_id for update;
  if current_status is null then raise exception 'RFQ not found' using errcode = 'P0002'; end if;
  if current_status = p_next_status then return current_status; end if;

  transition_allowed := case current_status
    when 'submitted' then p_next_status in ('reviewed', 'rejected')
    when 'reviewed' then p_next_status in ('quoted', 'rejected')
    when 'quoted' then p_next_status in ('negotiating', 'accepted', 'rejected')
    when 'negotiating' then p_next_status in ('quoted', 'accepted', 'rejected')
    when 'accepted' then p_next_status = 'in_production'
    when 'in_production' then p_next_status = 'completed'
    else false
  end;

  if not transition_allowed then
    raise exception 'invalid RFQ status transition' using errcode = '22023';
  end if;

  update public.rfqs set status = p_next_status where id = p_rfq_id;
  insert into public.audit_logs (actor_user_id, organization_id, action, entity_type, entity_id, metadata)
  select actor_id, organization_id, 'rfq.status_changed', 'rfq', id::text,
    jsonb_build_object('from', current_status, 'to', p_next_status)
  from public.rfqs where id = p_rfq_id;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
  values ('rfq.status_changed', 'rfq', p_rfq_id::text,
    jsonb_build_object('rfq_id', p_rfq_id, 'from', current_status, 'to', p_next_status));

  return p_next_status;
end;
$$;

revoke all on function public.update_rfq_status(uuid, public.rfq_status) from public, anon;
grant execute on function public.update_rfq_status(uuid, public.rfq_status) to authenticated;

comment on table public.outbox_events is 'Transactional outbox; consumers process events asynchronously and idempotently.';
comment on function public.create_rfq(text, uuid, numeric, jsonb, timestamptz, jsonb, uuid) is 'Creates an RFQ and outbox event atomically, scoped to the authenticated user and idempotency key.';
