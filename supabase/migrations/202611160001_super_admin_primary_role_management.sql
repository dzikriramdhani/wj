-- Let authenticated Super Admins set one primary platform role per account.
-- The baseline `user` role remains assigned to every account for compatibility.
create or replace function public.replace_platform_user_role(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_role_name public.platform_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role_id uuid;
  baseline_role_id uuid;
  before_primary_role text;
  before_roles jsonb;
  after_roles jsonb;
  super_admin_count integer;
  target_is_super_admin boolean;
begin
  -- Serialize all changes against the shared Super Admin role row so two
  -- concurrent edits cannot remove the final Super Admin account.
  perform id
  from public.roles
  where name = 'super_admin'::public.platform_role
  for update;

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

  if p_role_name not in (
    'user'::public.platform_role,
    'admin'::public.platform_role,
    'super_admin'::public.platform_role
  ) then
    raise exception 'unsupported platform role' using errcode = '22023';
  end if;

  if p_target_user_id = p_actor_user_id and p_role_name <> 'super_admin'::public.platform_role then
    raise exception 'super admin cannot change their own role' using errcode = '42501';
  end if;

  select id into target_role_id from public.roles where name = p_role_name;
  select id into baseline_role_id from public.roles where name = 'user'::public.platform_role;
  if target_role_id is null or baseline_role_id is null then
    raise exception 'platform role definition not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(r.name::text order by r.name::text), '[]'::jsonb)
  into before_roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_target_user_id
    and r.name in ('user'::public.platform_role, 'admin'::public.platform_role, 'super_admin'::public.platform_role);

  if exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_target_user_id and r.name = 'super_admin'::public.platform_role
  ) then
    before_primary_role := 'super_admin';
  elsif exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_target_user_id and r.name = 'admin'::public.platform_role
  ) then
    before_primary_role := 'admin';
  else
    before_primary_role := 'user';
  end if;

  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_target_user_id and r.name = 'super_admin'::public.platform_role
  ) into target_is_super_admin;

  if target_is_super_admin and p_role_name <> 'super_admin'::public.platform_role then
    select count(*) into super_admin_count
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.name = 'super_admin'::public.platform_role;
    if super_admin_count <= 1 then
      raise exception 'at least one super admin is required' using errcode = '22023';
    end if;
  end if;

  after_roles := case
    when p_role_name = 'user'::public.platform_role then jsonb_build_array('user')
    when p_role_name = 'admin'::public.platform_role then jsonb_build_array('admin', 'user')
    else jsonb_build_array('super_admin', 'user')
  end;

  if before_roles = after_roles then
    return;
  end if;

  delete from public.user_roles ur
  using public.roles r
  where ur.role_id = r.id
    and ur.user_id = p_target_user_id
    and r.name in ('admin'::public.platform_role, 'super_admin'::public.platform_role);

  insert into public.user_roles(user_id, role_id, assigned_by)
  values (p_target_user_id, baseline_role_id, p_actor_user_id)
  on conflict (user_id, role_id) do nothing;

  if p_role_name <> 'user'::public.platform_role then
    insert into public.user_roles(user_id, role_id, assigned_by)
    values (p_target_user_id, target_role_id, p_actor_user_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_user_id,
    'security.role_changed',
    'user_role',
    p_target_user_id::text,
    jsonb_build_object('primary_role', before_primary_role, 'roles', before_roles),
    jsonb_build_object('primary_role', p_role_name::text, 'roles', after_roles)
  );
end;
$$;

revoke all on function public.replace_platform_user_role(uuid, uuid, public.platform_role) from public, anon, authenticated;
grant execute on function public.replace_platform_user_role(uuid, uuid, public.platform_role) to service_role;

comment on function public.replace_platform_user_role(uuid, uuid, public.platform_role)
  is 'Server-only Super Admin role replacement with baseline user assignment, audit logging, self-demotion protection, and final-Super-Admin protection.';
