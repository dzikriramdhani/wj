-- A missing membership yields NULL in PL/pgSQL. Treat it as unauthorized
-- explicitly so the server-only B2B role routine remains safe even if it is
-- called by a future service integration.
create or replace function public.manage_organization_member(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_member_user_id uuid,
  p_role public.organization_member_role default 'buyer',
  p_action text default 'upsert'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.organization_member_role;
  previous_role public.organization_member_role;
  owner_count integer;
begin
  if p_actor_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_action not in ('upsert', 'remove') then
    raise exception 'invalid member action' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles where id = p_member_user_id) then
    raise exception 'member user not found' using errcode = 'P0002';
  end if;

  select role into actor_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = p_actor_user_id;
  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'organization owner or admin required' using errcode = '42501';
  end if;

  select role into previous_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = p_member_user_id
  for update;

  if actor_role <> 'owner' and (p_role = 'owner' or previous_role = 'owner') then
    raise exception 'organization owner required to manage an owner' using errcode = '42501';
  end if;

  if p_action = 'remove' then
    if previous_role is null then
      raise exception 'organization member not found' using errcode = 'P0002';
    end if;
    if previous_role = 'owner' then
      select count(*) into owner_count
      from public.organization_members
      where organization_id = p_organization_id and role = 'owner';
      if owner_count <= 1 then
        raise exception 'at least one organization owner is required' using errcode = '22023';
      end if;
    end if;

    delete from public.organization_members
    where organization_id = p_organization_id and user_id = p_member_user_id;
  else
    if previous_role = 'owner' and p_role <> 'owner' then
      select count(*) into owner_count
      from public.organization_members
      where organization_id = p_organization_id and role = 'owner';
      if owner_count <= 1 then
        raise exception 'at least one organization owner is required' using errcode = '22023';
      end if;
    end if;

    insert into public.organization_members(organization_id, user_id, role, invited_by)
    values (p_organization_id, p_member_user_id, p_role, p_actor_user_id)
    on conflict (organization_id, user_id) do update
      set role = excluded.role,
          invited_by = excluded.invited_by;
  end if;

  insert into public.audit_logs(
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    p_actor_user_id,
    p_organization_id,
    case when p_action = 'remove' then 'organization.member_removed' else 'organization.member_saved' end,
    'organization_member',
    p_organization_id::text || ':' || p_member_user_id::text,
    jsonb_build_object('role', previous_role::text),
    case when p_action = 'remove' then null else jsonb_build_object('role', p_role::text) end,
    jsonb_build_object('member_user_id', p_member_user_id, 'action', p_action)
  );
end;
$$;

revoke all on function public.manage_organization_member(uuid, uuid, uuid, public.organization_member_role, text) from public, anon, authenticated;
grant execute on function public.manage_organization_member(uuid, uuid, uuid, public.organization_member_role, text) to service_role;
