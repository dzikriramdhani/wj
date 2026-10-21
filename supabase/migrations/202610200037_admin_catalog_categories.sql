-- Server-only category management for Admin and Super Admin.
-- Category changes are audited in the same transaction; referenced categories
-- are deactivated instead of deleted so existing products remain connected.
create or replace function public.admin_save_catalog_category(
  p_actor_user_id uuid,
  p_category_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_position integer,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_category_id uuid;
  previous_data jsonb;
  next_data jsonb;
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_actor_user_id
      and r.name in ('admin'::public.platform_role, 'super_admin'::public.platform_role)
  ) then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2
    or char_length(trim(p_name)) > 80
    or char_length(trim(coalesce(p_slug, ''))) < 2
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(coalesce(p_description, '')) > 500
    or p_position is null or p_position < 0 or p_position > 9999
    or p_is_active is null then
    raise exception 'invalid category values' using errcode = '22023';
  end if;

  next_data := jsonb_build_object(
    'name', trim(p_name),
    'slug', p_slug,
    'description', nullif(trim(coalesce(p_description, '')), ''),
    'position', p_position,
    'is_active', p_is_active
  );

  if p_category_id is null then
    insert into public.categories (name, slug, description, position, is_active)
    values (
      trim(p_name), p_slug, nullif(trim(coalesce(p_description, '')), ''), p_position, p_is_active
    ) returning id into saved_category_id;
  else
    select jsonb_build_object(
      'name', c.name,
      'slug', c.slug,
      'description', c.description,
      'position', c.position,
      'is_active', c.is_active
    ) into previous_data
    from public.categories c
    where c.id = p_category_id
    for update;

    if not found then
      raise exception 'category not found' using errcode = 'P0002';
    end if;

    update public.categories
    set name = trim(p_name),
        slug = p_slug,
        description = nullif(trim(coalesce(p_description, '')), ''),
        position = p_position,
        is_active = p_is_active
    where id = p_category_id
    returning id into saved_category_id;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_user_id,
    case when p_category_id is null then 'catalog.category_created' else 'catalog.category_updated' end,
    'category', saved_category_id::text, previous_data, next_data
  );

  return saved_category_id;
end;
$$;

revoke all on function public.admin_save_catalog_category(uuid, uuid, text, text, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_save_catalog_category(uuid, uuid, text, text, text, integer, boolean)
  to service_role;

comment on function public.admin_save_catalog_category is
  'Server-only Admin and Super Admin category create/update with validation and an atomic audit record.';
