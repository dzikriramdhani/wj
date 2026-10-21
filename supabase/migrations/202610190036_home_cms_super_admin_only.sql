begin;

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.name = 'admin'::public.platform_role
  and p.name = 'content.home.manage';

commit;

-- Rollback: re-grant the CMS permission to Admin if this ownership change is reverted.
-- insert into public.role_permissions (role_id, permission_id)
-- select r.id, p.id
-- from public.roles r
-- join public.permissions p on p.name = 'content.home.manage'
-- where r.name = 'admin'::public.platform_role
-- on conflict do nothing;
