-- Storage boundary: public product imagery, private B2B/RFQ documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('lookbook-images', 'lookbook-images', true, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('brand-assets', 'brand-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']),
  ('business-documents', 'business-documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png']),
  ('rfq-files', 'rfq-files', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('order-documents', 'order-documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can read public brand and product assets" on storage.objects
  for select to anon, authenticated using (
    bucket_id in ('product-images', 'lookbook-images', 'brand-assets')
  );

create policy "organization members can read business verification files" on storage.objects
  for select to authenticated using (
    bucket_id = 'business-documents'
    and exists (
      select 1 from public.organizations o
      where o.id::text = (storage.foldername(name))[1]
        and (private.is_organization_member(o.id) or private.is_platform_admin())
    )
  );

create policy "organization owners and admins can upload business files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'business-documents'
    and owner_id = (select auth.uid())::text
    and exists (
      select 1 from public.organization_members om
      where om.organization_id::text = (storage.foldername(name))[1]
        and om.user_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
  );

create policy "RFQ participants can read RFQ files" on storage.objects
  for select to authenticated using (
    bucket_id = 'rfq-files'
    and exists (
      select 1 from public.rfqs r
      where r.id::text = (storage.foldername(name))[1]
        and (
          r.user_id = (select auth.uid())
          or (r.organization_id is not null and private.is_organization_member(r.organization_id))
          or private.has_platform_role(array['sales', 'admin'])
        )
    )
  );

create policy "RFQ participants can upload RFQ files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'rfq-files'
    and owner_id = (select auth.uid())::text
    and exists (
      select 1 from public.rfqs r
      where r.id::text = (storage.foldername(name))[1]
        and (
          r.user_id = (select auth.uid())
          or (r.organization_id is not null and private.is_organization_member(r.organization_id))
        )
    )
  );

-- order-documents intentionally has no client policy until the order ownership
-- model and delivery state machine are installed in the commerce migration.
