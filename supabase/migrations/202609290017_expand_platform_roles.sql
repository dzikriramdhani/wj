-- Add the platform roles declared in the PRD. PostgreSQL makes new enum values
-- visible only after this migration commits, so role rows are seeded separately.
alter type public.platform_role add value if not exists 'finance';
alter type public.platform_role add value if not exists 'content_admin';
alter type public.platform_role add value if not exists 'super_admin';

insert into public.permissions(name,description) values
  ('finance.payment.read','Read payment and invoice status'),
  ('finance.payment.reconcile','Reconcile a Midtrans payment'),
  ('finance.payment.refund','Initiate an approved payment refund'),
  ('warehouse.fulfillment.read','Read paid orders awaiting fulfillment'),
  ('warehouse.fulfillment.update','Advance packing and shipment status'),
  ('content.catalog.read','Read catalog administration data'),
  ('content.catalog.write','Create and update catalog data'),
  ('content.media.manage','Manage product media'),
  ('content.lookbook.manage','Manage lookbook media')
on conflict(name) do nothing;
