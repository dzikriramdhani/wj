-- Wina Jaya foundation: Supabase Auth-backed identity and tenant security.
-- Apply through Supabase CLI migrations, first in DEV, then STAGING and PROD.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.platform_role as enum ('customer', 'sales', 'admin');
create type public.organization_status as enum ('pending', 'verified', 'rejected', 'suspended');
create type public.organization_member_role as enum ('owner', 'admin', 'buyer', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text check (phone is null or char_length(phone) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name public.platform_role not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name ~ '^[a-z][a-z0-9_.:-]*$'),
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  legal_name text,
  tax_id text,
  status public.organization_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_tax_id_unique
  on public.organizations (tax_id) where tax_id is not null;

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_member_role not null default 'buyer',
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);

create table public.business_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  industry text,
  website text,
  verification_notes text,
  documents jsonb not null default '[]'::jsonb check (jsonb_typeof(documents) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_organization_idx on public.audit_logs (organization_id, created_at desc);

insert into public.roles (name, description) values
  ('customer', 'Default authenticated customer'),
  ('sales', 'Wina Jaya sales operator'),
  ('admin', 'Wina Jaya platform administrator')
on conflict (name) do nothing;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'admin'::public.platform_role
  );
$$;

create or replace function private.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = (select auth.uid())
  );
$$;

grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_role_id uuid;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );

  select id into customer_role_id from public.roles where name = 'customer';
  if customer_role_id is not null then
    insert into public.user_roles (user_id, role_id) values (new.id, customer_role_id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger business_profiles_set_updated_at before update on public.business_profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.business_profiles enable row level security;
alter table public.audit_logs enable row level security;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select on public.roles, public.permissions, public.role_permissions, public.user_roles to authenticated;
grant select on public.organizations, public.organization_members, public.business_profiles to authenticated;
revoke all on public.audit_logs from anon, authenticated;

create policy "profile owner can read profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profile owner can update profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "users can read own role assignments" on public.user_roles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "authenticated users can read role definitions" on public.roles
  for select to authenticated using (true);
create policy "authenticated users can read permissions" on public.permissions
  for select to authenticated using (true);
create policy "authenticated users can read role permissions" on public.role_permissions
  for select to authenticated using (true);

create policy "organization members can read organization" on public.organizations
  for select to authenticated using (private.is_organization_member(id) or private.is_platform_admin());
create policy "organization members can read memberships" on public.organization_members
  for select to authenticated using (private.is_organization_member(organization_id) or private.is_platform_admin());
create policy "organization members can read business profile" on public.business_profiles
  for select to authenticated using (private.is_organization_member(organization_id) or private.is_platform_admin());

comment on table public.profiles is 'Application profile linked one-to-one with Supabase Auth users.';
comment on table public.organizations is 'Tenant boundary for B2B customers; membership controls access.';
comment on table public.audit_logs is 'Server-written audit trail; never directly writable by browser clients.';
