-- Activate the enterprise warehouse role declared in migration 015.
insert into public.roles(name,description)
values ('warehouse','Warehouse operator for inventory and fulfillment workflows')
on conflict(name) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.name in ('warehouse.inventory.read','warehouse.inventory.update') where r.name='warehouse'
on conflict do nothing;
