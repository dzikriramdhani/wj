-- Phase 5 enterprise-readiness: permission grants, richer immutable audit data,
-- data-subject requests, and non-secret SSO domain metadata.

alter type public.platform_role add value if not exists 'warehouse';

alter table public.audit_logs add column if not exists before_data jsonb;
alter table public.audit_logs add column if not exists after_data jsonb;
alter table public.audit_logs add column if not exists ip_address inet;
alter table public.audit_logs add column if not exists user_agent text;
create index if not exists audit_logs_action_created_idx on public.audit_logs(action, created_at desc);

create table public.security_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 120),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index security_events_type_created_idx on public.security_events(event_type, created_at desc);

create type public.data_subject_request_type as enum ('access', 'export', 'erasure');
create type public.data_subject_request_status as enum ('submitted', 'in_review', 'completed', 'rejected');
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  request_type public.data_subject_request_type not null,
  status public.data_subject_request_status not null default 'submitted',
  note text check (note is null or char_length(note) <= 2000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index data_subject_requests_status_created_idx on public.data_subject_requests(status, created_at);
create trigger data_subject_requests_set_updated_at before update on public.data_subject_requests for each row execute function private.set_updated_at();

create table public.organization_sso_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null check (domain ~ '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  provider text not null check (provider in ('saml','oidc')),
  enforcement_enabled boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(domain)
);
create trigger organization_sso_domains_set_updated_at before update on public.organization_sso_domains for each row execute function private.set_updated_at();

insert into public.permissions(name,description) values
  ('admin.audit.read','Read governance audit records'),
  ('admin.privacy.review','Review data-subject requests'),
  ('admin.sso.manage','Manage enterprise SSO domain metadata'),
  ('admin.roles.manage','Manage platform role grants'),
  ('warehouse.inventory.read','Read warehouse inventory'),
  ('warehouse.inventory.update','Update warehouse inventory'),
  ('sales.rfq.read','Read RFQs'),
  ('sales.rfq.quote','Create and send quotations'),
  ('finance.payment.read','Read payment reconciliation')
on conflict(name) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.name='admin'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.name in ('sales.rfq.read','sales.rfq.quote') where r.name='sales'
on conflict do nothing;

alter table public.security_events enable row level security;
alter table public.data_subject_requests enable row level security;
alter table public.organization_sso_domains enable row level security;
revoke all on public.security_events, public.data_subject_requests, public.organization_sso_domains from anon,authenticated;
grant select on public.data_subject_requests to authenticated;
create policy "users read own data-subject requests" on public.data_subject_requests for select to authenticated using (user_id=(select auth.uid()));

create or replace function private.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=(select auth.uid()) and p.name=p_permission);
$$;
grant execute on function private.has_permission(text) to authenticated;

create or replace function public.create_data_subject_request(p_request_type public.data_subject_request_type,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); request_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if exists(select 1 from public.data_subject_requests where user_id=actor and request_type=p_request_type and status in ('submitted','in_review')) then raise exception 'an active request of this type already exists' using errcode='23505'; end if;
  insert into public.data_subject_requests(user_id,request_type,note) values(actor,p_request_type,nullif(trim(p_note),'')) returning id into request_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,after_data) values(actor,'privacy.request_created','data_subject_request',request_id::text,jsonb_build_object('request_type',p_request_type));
  return request_id;
end; $$;

create or replace function public.review_data_subject_request(p_request_id uuid,p_status public.data_subject_request_status,p_resolution_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); previous_status public.data_subject_request_status;
begin
  if actor is null or not private.has_permission('admin.privacy.review') then raise exception 'privacy review permission required' using errcode='42501'; end if;
  if p_status not in ('in_review','completed','rejected') then raise exception 'invalid request status' using errcode='22023'; end if;
  select status into previous_status from public.data_subject_requests where id=p_request_id for update;
  if previous_status is null then raise exception 'request not found' using errcode='P0002'; end if;
  update public.data_subject_requests set status=p_status,reviewed_by=actor,reviewed_at=now(),resolution_note=nullif(trim(p_resolution_note),'') where id=p_request_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data) values(actor,'privacy.request_reviewed','data_subject_request',p_request_id::text,jsonb_build_object('status',previous_status),jsonb_build_object('status',p_status));
end; $$;

create or replace function public.record_security_event(p_event_type text,p_severity text default 'info',p_metadata jsonb default '{}'::jsonb,p_ip_address inet default null,p_user_agent text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_severity not in ('info','warning','critical') then raise exception 'invalid security event severity' using errcode='22023'; end if;
  insert into public.security_events(actor_user_id,event_type,severity,metadata,ip_address,user_agent) values((select auth.uid()),p_event_type,p_severity,coalesce(p_metadata,'{}'::jsonb),p_ip_address,left(p_user_agent,500));
end; $$;

revoke all on function public.create_data_subject_request(public.data_subject_request_type,text), public.review_data_subject_request(uuid,public.data_subject_request_status,text), public.record_security_event(text,text,jsonb,inet,text) from public,anon;
grant execute on function public.create_data_subject_request(public.data_subject_request_type,text) to authenticated;
grant execute on function public.review_data_subject_request(uuid,public.data_subject_request_status,text) to authenticated;
grant execute on function public.record_security_event(text,text,jsonb,inet,text) to service_role;
