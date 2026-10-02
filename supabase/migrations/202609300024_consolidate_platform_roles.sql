-- Consolidate legacy internal assignments into the three active platform roles:
-- user, admin, and super_admin. Organization membership roles are separate.

insert into public.roles(name, description)
values ('user', 'Default authenticated user')
on conflict (name) do update set description = excluded.description;

-- Every existing profile receives the baseline user role. New profiles receive
-- it through the authentication trigger redefined below.
insert into public.user_roles(user_id, role_id)
select p.id, r.id
from public.profiles p
cross join public.roles r
where r.name = 'user'::public.platform_role
on conflict (user_id, role_id) do nothing;

-- Existing operational specialists retain their internal access as Admin.
insert into public.user_roles(user_id, role_id)
select distinct ur.user_id, admin_role.id
from public.user_roles ur
join public.roles legacy_role on legacy_role.id = ur.role_id
cross join public.roles admin_role
where legacy_role.name in (
  'sales'::public.platform_role,
  'finance'::public.platform_role,
  'warehouse'::public.platform_role,
  'content_admin'::public.platform_role
)
  and admin_role.name = 'admin'::public.platform_role
on conflict (user_id, role_id) do nothing;

-- Retire the old platform role rows after their assignments have been moved.
delete from public.user_roles ur
using public.roles r
where r.id = ur.role_id
  and r.name in (
    'customer'::public.platform_role,
    'sales'::public.platform_role,
    'finance'::public.platform_role,
    'warehouse'::public.platform_role,
    'content_admin'::public.platform_role
  );

delete from public.roles
where name in (
  'customer'::public.platform_role,
  'sales'::public.platform_role,
  'finance'::public.platform_role,
  'warehouse'::public.platform_role,
  'content_admin'::public.platform_role
);

-- Admin performs all operational work. Role and SSO management remain limited
-- to Super Admin.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'admin'::public.platform_role
  and p.name not in ('admin.roles.manage', 'admin.sso.manage')
on conflict do nothing;

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
      and r.name in ('admin'::public.platform_role, 'super_admin'::public.platform_role)
  );
$$;

-- Historical policies and functions use this helper. Map their former staff
-- checks to Admin while keeping Super Admin as an operational administrator.
create or replace function private.has_platform_role(allowed_roles text[])
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
      and (
        r.name = 'super_admin'::public.platform_role
        or (
          r.name = 'admin'::public.platform_role
          and allowed_roles && array['admin', 'sales', 'finance', 'warehouse', 'content_admin']::text[]
        )
        or (
          r.name = 'user'::public.platform_role
          and allowed_roles && array['user', 'customer']::text[]
        )
      )
  );
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_role_id uuid;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );

  select id into user_role_id
  from public.roles
  where name = 'user'::public.platform_role;

  if user_role_id is not null then
    insert into public.user_roles (user_id, role_id) values (new.id, user_role_id);
  end if;
  return new;
end;
$$;

create or replace function public.set_platform_user_role(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_role_name public.platform_role,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role_id uuid;
  super_admin_count integer;
begin
  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_actor_user_id
      and r.name = 'super_admin'::public.platform_role
  ) then
    raise exception 'super admin role required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'target user not found' using errcode = 'P0002';
  end if;

  if p_role_name = 'user'::public.platform_role then
    raise exception 'user baseline role is managed by account creation' using errcode = '22023';
  end if;

  if p_role_name not in ('admin'::public.platform_role, 'super_admin'::public.platform_role) then
    raise exception 'only admin and super_admin can be assigned' using errcode = '22023';
  end if;

  select id into target_role_id
  from public.roles
  where name = p_role_name;
  if target_role_id is null then
    raise exception 'role not found' using errcode = 'P0002';
  end if;

  if not p_enabled and p_role_name = 'super_admin'::public.platform_role then
    select count(*) into super_admin_count
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.name = 'super_admin'::public.platform_role;
    if super_admin_count <= 1 then
      raise exception 'at least one super admin is required' using errcode = '22023';
    end if;
  end if;

  if p_enabled then
    insert into public.user_roles(user_id, role_id, assigned_by)
    values (p_target_user_id, target_role_id, p_actor_user_id)
    on conflict (user_id, role_id) do nothing;
  else
    delete from public.user_roles
    where user_id = p_target_user_id and role_id = target_role_id;
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_user_id,
    case when p_enabled then 'security.role_granted' else 'security.role_revoked' end,
    'user_role',
    p_target_user_id::text,
    jsonb_build_object('role', p_role_name::text, 'assigned', not p_enabled),
    jsonb_build_object('role', p_role_name::text, 'assigned', p_enabled)
  );
end;
$$;

revoke all on function public.set_platform_user_role(uuid, uuid, public.platform_role, boolean) from public, anon, authenticated;
grant execute on function public.set_platform_user_role(uuid, uuid, public.platform_role, boolean) to service_role;

comment on function public.set_platform_user_role(uuid, uuid, public.platform_role, boolean)
  is 'Server-only Super Admin assignment for Admin and Super Admin with an immutable audit record and final-Super-Admin protection.';
