-- A Super Admin is the platform-wide escalation role. Existing RLS policies
-- use this helper for staff access, so make that inheritance explicit here
-- instead of duplicating super_admin in every policy and database function.
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
        r.name::text = any (allowed_roles)
        or r.name = 'super_admin'::public.platform_role
      )
  );
$$;

grant execute on function private.has_platform_role(text[]) to authenticated;
