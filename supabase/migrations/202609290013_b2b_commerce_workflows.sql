-- Phase 3 B2B workflow. Sensitive B2B state changes live in transactional
-- functions; browser roles retain read-only table access.

create table public.organization_verification_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  documents jsonb not null default '[]'::jsonb check (jsonb_typeof(documents) = 'array'),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision text check (decision in ('verified', 'rejected')),
  review_notes text,
  unique (organization_id)
);

create table public.quotation_messages (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.quotation_approvals (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  decision text not null check (decision in ('accepted', 'rejected')),
  decided_by uuid not null references public.profiles(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  unique (quotation_id)
);

create type public.bulk_order_status as enum ('approved', 'in_production', 'ready_to_ship', 'shipped', 'completed', 'cancelled');
create table public.bulk_orders (
  id uuid primary key default gen_random_uuid(),
  bulk_order_number text not null unique default ('B2B-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 8, '0')),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quotation_id uuid not null unique references public.quotations(id) on delete restrict,
  status public.bulk_order_status not null default 'approved',
  currency char(3) not null default 'IDR',
  total_amount numeric(16, 2) not null check (total_amount >= 0),
  payment_terms text not null default '',
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.bulk_order_items (
  id uuid primary key default gen_random_uuid(),
  bulk_order_id uuid not null references public.bulk_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(16, 2) not null check (line_total >= 0)
);
create index bulk_orders_organization_created_idx on public.bulk_orders(organization_id, created_at desc);
create index quotation_messages_quotation_created_idx on public.quotation_messages(quotation_id, created_at);
create trigger bulk_orders_set_updated_at before update on public.bulk_orders for each row execute function private.set_updated_at();

alter table public.organization_verification_requests enable row level security;
alter table public.quotation_messages enable row level security;
alter table public.quotation_approvals enable row level security;
alter table public.bulk_orders enable row level security;
alter table public.bulk_order_items enable row level security;
grant select on public.organization_verification_requests, public.quotation_messages, public.quotation_approvals, public.bulk_orders, public.bulk_order_items to authenticated;
create policy "organization readers can read verification" on public.organization_verification_requests for select to authenticated using (private.is_organization_member(organization_id) or private.has_platform_role(array['sales','admin']));
create policy "quotation readers can read messages" on public.quotation_messages for select to authenticated using (exists (select 1 from public.quotations q join public.rfqs r on r.id=q.rfq_id where q.id=quotation_id));
create policy "quotation readers can read approvals" on public.quotation_approvals for select to authenticated using (exists (select 1 from public.quotations q join public.rfqs r on r.id=q.rfq_id where q.id=quotation_id));
create policy "organization members can read bulk orders" on public.bulk_orders for select to authenticated using (private.is_organization_member(organization_id) or private.has_platform_role(array['sales','admin']));
create policy "bulk order readers can read items" on public.bulk_order_items for select to authenticated using (exists (select 1 from public.bulk_orders b where b.id=bulk_order_id));
revoke insert, update, delete on public.organization_verification_requests, public.quotation_messages, public.quotation_approvals, public.bulk_orders, public.bulk_order_items from anon, authenticated;

create or replace function public.create_business_organization(p_name text, p_legal_name text, p_tax_id text, p_industry text default null, p_website text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); org_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if char_length(trim(coalesce(p_name,''))) < 2 then raise exception 'organization name is required' using errcode='22023'; end if;
  insert into public.organizations(name,legal_name,tax_id,created_by) values (trim(p_name),nullif(trim(p_legal_name),''),nullif(trim(p_tax_id),''),actor) returning id into org_id;
  insert into public.organization_members(organization_id,user_id,role) values(org_id,actor,'owner');
  insert into public.business_profiles(organization_id,industry,website) values(org_id,nullif(trim(p_industry),''),nullif(trim(p_website),''));
  insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id) values(actor,org_id,'organization.created','organization',org_id::text);
  return org_id;
end; $$;

create or replace function public.submit_business_verification(p_organization_id uuid, p_documents jsonb, p_industry text default null, p_website text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_documents is null or jsonb_typeof(p_documents) <> 'array' then raise exception 'documents must be an array' using errcode='22023'; end if;
  if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=actor and role in ('owner','admin')) then raise exception 'organization owner or admin required' using errcode='42501'; end if;
  update public.business_profiles set documents=p_documents,industry=coalesce(nullif(trim(p_industry),''),industry),website=coalesce(nullif(trim(p_website),''),website) where organization_id=p_organization_id;
  insert into public.organization_verification_requests(organization_id,documents,submitted_by,submitted_at,reviewed_by,reviewed_at,decision,review_notes) values(p_organization_id,p_documents,actor,now(),null,null,null,null)
  on conflict(organization_id) do update set documents=excluded.documents,submitted_by=excluded.submitted_by,submitted_at=now(),reviewed_by=null,reviewed_at=null,decision=null,review_notes=null;
  update public.organizations set status='pending',verified_at=null,verified_by=null where id=p_organization_id;
  insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id) values(actor,p_organization_id,'organization.verification_submitted','organization',p_organization_id::text);
end; $$;

create or replace function public.review_business_verification(p_organization_id uuid, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.has_platform_role(array['sales','admin']) then raise exception 'sales or admin role required' using errcode='42501'; end if;
  if p_decision not in ('verified','rejected') then raise exception 'invalid decision' using errcode='22023'; end if;
  update public.organization_verification_requests set decision=p_decision,reviewed_by=actor,reviewed_at=now(),review_notes=nullif(trim(p_notes),'') where organization_id=p_organization_id;
  if not found then raise exception 'verification request not found' using errcode='P0002'; end if;
  update public.organizations set status=p_decision::public.organization_status,verified_at=case when p_decision='verified' then now() else null end,verified_by=case when p_decision='verified' then actor else null end where id=p_organization_id;
  insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,metadata) values(actor,p_organization_id,'organization.verification_reviewed','organization',p_organization_id::text,jsonb_build_object('decision',p_decision));
end; $$;

create or replace function public.create_b2b_quotation(p_rfq_id uuid, p_payment_terms text, p_valid_until timestamptz, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); quote_id uuid; next_revision integer; item jsonb;
begin
  if actor is null or not private.has_platform_role(array['sales','admin']) then raise exception 'sales or admin role required' using errcode='42501'; end if;
  if p_valid_until is null or p_valid_until <= now() or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'invalid quotation data' using errcode='22023'; end if;
  if not exists(select 1 from public.rfqs where id=p_rfq_id and status in ('reviewed','quoted','negotiating')) then raise exception 'RFQ is not ready for quotation' using errcode='22023'; end if;
  select coalesce(max(revision),0)+1 into next_revision from public.quotations where rfq_id=p_rfq_id;
  update public.quotations set status='superseded' where rfq_id=p_rfq_id and status in ('draft','sent');
  insert into public.quotations(rfq_id,revision,status,payment_terms,valid_until,created_by) values(p_rfq_id,next_revision,'draft',trim(coalesce(p_payment_terms,'')),p_valid_until,actor) returning id into quote_id;
  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce((item->>'quantity')::numeric,0)<=0 or coalesce((item->>'unitPrice')::numeric,-1)<0 or char_length(trim(coalesce(item->>'description','')))=0 then raise exception 'invalid quotation item' using errcode='22023'; end if;
    insert into public.quotation_items(quotation_id,rfq_item_id,description,quantity,unit_price) values(quote_id,nullif(item->>'rfqItemId','')::uuid,trim(item->>'description'),(item->>'quantity')::numeric,(item->>'unitPrice')::numeric);
  end loop;
  insert into public.quotation_revisions(quotation_id,revision,snapshot,changed_by) values(quote_id,next_revision,jsonb_build_object('payment_terms',p_payment_terms,'valid_until',p_valid_until,'items',p_items),actor);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id) values(actor,'quotation.created','quotation',quote_id::text);
  return quote_id;
end; $$;

create or replace function public.send_b2b_quotation(p_quotation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target_rfq uuid;
begin
  if actor is null or not private.has_platform_role(array['sales','admin']) then raise exception 'sales or admin role required' using errcode='42501'; end if;
  update public.quotations set status='sent' where id=p_quotation_id and status='draft' and valid_until>now() returning rfq_id into target_rfq;
  if target_rfq is null then raise exception 'quotation cannot be sent' using errcode='22023'; end if;
  update public.rfqs set status='quoted' where id=target_rfq and status in ('reviewed','negotiating','quoted');
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id) values(actor,'quotation.sent','quotation',p_quotation_id::text);
end; $$;

create or replace function public.respond_to_b2b_quotation(p_quotation_id uuid, p_decision text, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); org_id uuid; quote_rfq uuid; bulk_id uuid; total numeric(16,2);
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_decision not in ('accepted','rejected') then raise exception 'invalid decision' using errcode='22023'; end if;
  select r.organization_id,q.rfq_id into org_id,quote_rfq from public.quotations q join public.rfqs r on r.id=q.rfq_id where q.id=p_quotation_id and q.status='sent' and q.valid_until>now() for update;
  if org_id is null then raise exception 'organization quotation required' using errcode='42501'; end if;
  if not exists(select 1 from public.organization_members where organization_id=org_id and user_id=actor and role in ('owner','admin')) then raise exception 'organization owner or admin required' using errcode='42501'; end if;
  update public.quotations set status=p_decision::public.quotation_status where id=p_quotation_id;
  insert into public.quotation_approvals(quotation_id,organization_id,decision,decided_by,note) values(p_quotation_id,org_id,p_decision,actor,nullif(trim(p_note),''));
  if p_decision='accepted' then
    select coalesce(sum(line_total),0) into total from public.quotation_items where quotation_id=p_quotation_id;
    insert into public.bulk_orders(organization_id,quotation_id,total_amount,payment_terms,approved_by) select org_id,p_quotation_id,total,payment_terms,actor from public.quotations where id=p_quotation_id returning id into bulk_id;
    insert into public.bulk_order_items(bulk_order_id,product_id,description,quantity,unit_price,line_total) select bulk_id,ri.product_id,qi.description,qi.quantity,qi.unit_price,qi.line_total from public.quotation_items qi left join public.rfq_items ri on ri.id=qi.rfq_item_id where qi.quotation_id=p_quotation_id;
    update public.rfqs set status='accepted' where id=quote_rfq;
  else update public.rfqs set status='negotiating' where id=quote_rfq; end if;
  insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,metadata) values(actor,org_id,'quotation.responded','quotation',p_quotation_id::text,jsonb_build_object('decision',p_decision));
  return bulk_id;
end; $$;

create or replace function public.add_b2b_quotation_message(p_quotation_id uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'invalid message' using errcode='22023'; end if;
  if not exists(select 1 from public.quotations q join public.rfqs r on r.id=q.rfq_id where q.id=p_quotation_id and (r.user_id=actor or (r.organization_id is not null and private.is_organization_member(r.organization_id)) or private.has_platform_role(array['sales','admin']))) then raise exception 'quotation access required' using errcode='42501'; end if;
  insert into public.quotation_messages(quotation_id,author_user_id,body) values(p_quotation_id,actor,trim(p_body));
  update public.rfqs set status='negotiating' where id=(select rfq_id from public.quotations where id=p_quotation_id) and status='quoted';
end; $$;

revoke all on function public.create_business_organization(text,text,text,text,text), public.submit_business_verification(uuid,jsonb,text,text), public.review_business_verification(uuid,text,text), public.create_b2b_quotation(uuid,text,timestamptz,jsonb), public.send_b2b_quotation(uuid), public.respond_to_b2b_quotation(uuid,text,text), public.add_b2b_quotation_message(uuid,text) from public, anon;
grant execute on function public.create_business_organization(text,text,text,text,text), public.submit_business_verification(uuid,jsonb,text,text), public.review_business_verification(uuid,text,text), public.create_b2b_quotation(uuid,text,timestamptz,jsonb), public.send_b2b_quotation(uuid), public.respond_to_b2b_quotation(uuid,text,text), public.add_b2b_quotation_message(uuid,text) to authenticated;
