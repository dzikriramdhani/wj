-- Seed the PRD role catalogue after migration 017 has committed the enum values.
insert into public.roles(name,description) values
  ('finance','Wina Jaya finance operator'),
  ('content_admin','Wina Jaya catalog and content operator'),
  ('super_admin','System administrator with security and role-management access')
on conflict(name) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.name in ('finance.payment.read','finance.payment.reconcile','finance.payment.refund')
where r.name='finance'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.name in ('warehouse.inventory.read','warehouse.inventory.update','warehouse.fulfillment.read','warehouse.fulfillment.update')
where r.name='warehouse'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.name in ('content.catalog.read','content.catalog.write','content.media.manage','content.lookbook.manage')
where r.name='content_admin'
on conflict do nothing;

-- An operational Admin remains able to operate the existing back office, but
-- system role and SSO configuration belong only to Super Admin.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id=r.id and rp.permission_id=p.id
  and r.name='admin'
  and p.name in ('admin.roles.manage','admin.sso.manage');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r cross join public.permissions p
where r.name='admin'
  and p.name not in ('admin.roles.manage','admin.sso.manage')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r cross join public.permissions p
where r.name='super_admin'
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
    join public.roles r on r.id=ur.role_id
    where ur.user_id=p_actor_user_id and r.name='super_admin'::public.platform_role
  ) then
    raise exception 'super admin role required' using errcode='42501';
  end if;

  if not exists(select 1 from public.profiles where id=p_target_user_id) then
    raise exception 'target user not found' using errcode='P0002';
  end if;

  if p_role_name='customer'::public.platform_role then
    raise exception 'customer baseline role is managed by account creation' using errcode='22023';
  end if;

  select id into target_role_id from public.roles where name=p_role_name;
  if target_role_id is null then
    raise exception 'role not found' using errcode='P0002';
  end if;

  if not p_enabled and p_role_name='super_admin'::public.platform_role then
    select count(*) into super_admin_count
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where r.name='super_admin'::public.platform_role;
    if super_admin_count <= 1 then
      raise exception 'at least one super admin is required' using errcode='22023';
    end if;
  end if;

  if p_enabled then
    insert into public.user_roles(user_id,role_id,assigned_by)
    values(p_target_user_id,target_role_id,p_actor_user_id)
    on conflict(user_id,role_id) do nothing;
  else
    delete from public.user_roles
    where user_id=p_target_user_id and role_id=target_role_id;
  end if;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data)
  values(
    p_actor_user_id,
    case when p_enabled then 'security.role_granted' else 'security.role_revoked' end,
    'user_role',
    p_target_user_id::text,
    jsonb_build_object('role',p_role_name::text,'assigned',not p_enabled),
    jsonb_build_object('role',p_role_name::text,'assigned',p_enabled)
  );
end;
$$;

revoke all on function public.set_platform_user_role(uuid,uuid,public.platform_role,boolean) from public,anon,authenticated;
grant execute on function public.set_platform_user_role(uuid,uuid,public.platform_role,boolean) to service_role;

comment on function public.set_platform_user_role(uuid,uuid,public.platform_role,boolean)
  is 'Server-only Super Admin role assignment with an immutable audit record and last-Super-Admin protection.';
