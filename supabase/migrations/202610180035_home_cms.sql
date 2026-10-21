begin;

insert into public.permissions (name, description)
values ('content.home.manage', 'Edit, preview, and publish homepage content')
on conflict (name) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name = 'content.home.manage'
where r.name in ('admin', 'super_admin')
on conflict do nothing;

create table public.cms_home_pages (
  page_key text primary key check (page_key = 'home'),
  draft_content jsonb not null check (jsonb_typeof(draft_content) = 'object'),
  published_content jsonb check (published_content is null or jsonb_typeof(published_content) = 'object'),
  draft_revision integer not null default 0 check (draft_revision >= 0),
  published_revision integer check (published_revision is null or published_revision >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz
);

create table public.cms_home_revisions (
  page_key text not null references public.cms_home_pages(page_key) on delete cascade,
  revision integer not null check (revision >= 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  saved_by uuid references auth.users(id) on delete set null,
  saved_at timestamptz not null default now(),
  primary key (page_key, revision)
);

create or replace function public.actor_can_manage_home_cms(p_actor_user_id uuid)
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
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = p_actor_user_id
      and r.name in ('admin'::public.platform_role, 'super_admin'::public.platform_role)
      and p.name = 'content.home.manage'
  );
$$;

alter table public.cms_home_pages enable row level security;
alter table public.cms_home_revisions enable row level security;
revoke all on public.cms_home_pages, public.cms_home_revisions from public, anon, authenticated;
grant select on public.cms_home_pages, public.cms_home_revisions to service_role;

insert into public.cms_home_pages (
  page_key, draft_content, published_content, draft_revision, published_revision
)
values (
  'home',
  '{
    "schemaVersion": 1,
    "hero": {"title": "Tekstil presisi tinggi\nUntuk industri &\nkreasi", "imagePath": ""},
    "tagline": "Produksi kain premium terintegrasi sejak 1994.\nMelayani kebutuhan garmen ekspor berskala besar\nhingga pesanan fleksibel konveksi dan tailor lokal",
    "catalog": {"title": "Katalog\nUnggulan", "linkLabel": "Semua Katalog", "productSlugs": []},
    "trusted": {"title": "Dipercaya oleh\nBrand", "cards": [
      {"name": "Jack", "username": "@jack", "body": "I\u0027ve never seen anything like this before. It\u0027s amazing. I love it."},
      {"name": "Jill", "username": "@jill", "body": "I\u0027ve never seen anything like this before. It\u0027s amazing. I love it."},
      {"name": "John", "username": "@john", "body": "I\u0027m at a loss for words. This is amazing. I love it."},
      {"name": "Jane", "username": "@jane", "body": "This completely changed the way I work. Absolutely incredible."},
      {"name": "Jenny", "username": "@jenny", "body": "The quality is unmatched. I highly recommend this to everyone."},
      {"name": "James", "username": "@james", "body": "Superb experience from start to finish. Exceeded expectations."}
    ]},
    "about": {
      "title": "Pabrik tekstil\nterintegrasi\nsejak 1995",
      "body": "PT. Wina Jaya Textile memulai perjalanannya dari sebuah pabrik tenun skala menengah di Bandung. Kini, dengan luas fasilitas 500.000 meter/bulan lebih dari 15.000 m², kami bangga menjadi salah satu produsen kain tekstil terdepan di Indonesia yang dipercaya oleh lebih dari 350 klien aktif dari berbagai skala bisnis.",
      "imagePath": ""
    },
    "certifications": {"title": "Sertifikasi Standar", "items": [
      {"name": "ISO 9001:2015", "description": "Sistem Manajemen Mutu berstandar internasional, menjamin konsistensi produksi."},
      {"name": "OEKO-TEX®", "description": "Sertifikasi keamanan tekstil bebas zat berbahaya, aman untuk kulit sensitif."},
      {"name": "GOTS", "description": "Global Organic Textile Standard untuk tanggung jawab lingkungan & sosial."}
    ]},
    "cta": {
      "title": "Siap untuk produksi\nSkala masal atau\nCustom dyeing\nPantone?",
      "description": "Kirimkan lembar spesifikasi (tech-pack) Anda. Tim engineer lab tekstil kami memproses kalkulasi yield, formulasi lab-dip dalam 72 jam kerja, serta estimasi kapasitas slot mesin tanpa biaya konsultasi.",
      "buttonLabel": "Pesan swatch sample",
      "buttonHref": "/rfq/new"
    },
    "seo": {"title": "Wina Jaya — Produsen Kain Tekstil Presisi Tinggi", "description": "Produksi kain premium terintegrasi sejak 1994. Melayani kebutuhan garmen ekspor berskala besar hingga pesanan fleksibel konveksi dan tailor lokal."}
  }'::jsonb,
  '{
    "schemaVersion": 1,
    "hero": {"title": "Tekstil presisi tinggi\nUntuk industri &\nkreasi", "imagePath": ""},
    "tagline": "Produksi kain premium terintegrasi sejak 1994.\nMelayani kebutuhan garmen ekspor berskala besar\nhingga pesanan fleksibel konveksi dan tailor lokal",
    "catalog": {"title": "Katalog\nUnggulan", "linkLabel": "Semua Katalog", "productSlugs": []},
    "trusted": {"title": "Dipercaya oleh\nBrand", "cards": [
      {"name": "Jack", "username": "@jack", "body": "I\u0027ve never seen anything like this before. It\u0027s amazing. I love it."},
      {"name": "Jill", "username": "@jill", "body": "I\u0027ve never seen anything like this before. It\u0027s amazing. I love it."},
      {"name": "John", "username": "@john", "body": "I\u0027m at a loss for words. This is amazing. I love it."},
      {"name": "Jane", "username": "@jane", "body": "This completely changed the way I work. Absolutely incredible."},
      {"name": "Jenny", "username": "@jenny", "body": "The quality is unmatched. I highly recommend this to everyone."},
      {"name": "James", "username": "@james", "body": "Superb experience from start to finish. Exceeded expectations."}
    ]},
    "about": {
      "title": "Pabrik tekstil\nterintegrasi\nsejak 1995",
      "body": "PT. Wina Jaya Textile memulai perjalanannya dari sebuah pabrik tenun skala menengah di Bandung. Kini, dengan luas fasilitas 500.000 meter/bulan lebih dari 15.000 m², kami bangga menjadi salah satu produsen kain tekstil terdepan di Indonesia yang dipercaya oleh lebih dari 350 klien aktif dari berbagai skala bisnis.",
      "imagePath": ""
    },
    "certifications": {"title": "Sertifikasi Standar", "items": [
      {"name": "ISO 9001:2015", "description": "Sistem Manajemen Mutu berstandar internasional, menjamin konsistensi produksi."},
      {"name": "OEKO-TEX®", "description": "Sertifikasi keamanan tekstil bebas zat berbahaya, aman untuk kulit sensitif."},
      {"name": "GOTS", "description": "Global Organic Textile Standard untuk tanggung jawab lingkungan & sosial."}
    ]},
    "cta": {
      "title": "Siap untuk produksi\nSkala masal atau\nCustom dyeing\nPantone?",
      "description": "Kirimkan lembar spesifikasi (tech-pack) Anda. Tim engineer lab tekstil kami memproses kalkulasi yield, formulasi lab-dip dalam 72 jam kerja, serta estimasi kapasitas slot mesin tanpa biaya konsultasi.",
      "buttonLabel": "Pesan swatch sample",
      "buttonHref": "/rfq/new"
    },
    "seo": {"title": "Wina Jaya — Produsen Kain Tekstil Presisi Tinggi", "description": "Produksi kain premium terintegrasi sejak 1994. Melayani kebutuhan garmen ekspor berskala besar hingga pesanan fleksibel konveksi dan tailor lokal."}
  }'::jsonb,
  0,
  0
)
on conflict (page_key) do nothing;

insert into public.cms_home_revisions (page_key, revision, content)
select page_key, 0, draft_content from public.cms_home_pages where page_key = 'home'
on conflict (page_key, revision) do nothing;

create or replace function public.save_home_cms_draft(p_actor_user_id uuid, p_content jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_revision integer;
  next_revision integer;
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = p_actor_user_id
      and r.name in ('admin'::public.platform_role, 'super_admin'::public.platform_role)
      and p.name = 'content.home.manage'
  ) then
    raise exception 'homepage content permission required' using errcode = '42501';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object'
    or coalesce(p_content ->> 'schemaVersion', '') <> '1' then
    raise exception 'invalid homepage content' using errcode = '22023';
  end if;

  select draft_revision into previous_revision
  from public.cms_home_pages where page_key = 'home' for update;
  if previous_revision is null then
    raise exception 'homepage content not initialized' using errcode = 'P0002';
  end if;
  next_revision := previous_revision + 1;

  update public.cms_home_pages
  set draft_content = p_content,
      draft_revision = next_revision,
      updated_by = p_actor_user_id,
      updated_at = now()
  where page_key = 'home';

  insert into public.cms_home_revisions (page_key, revision, content, saved_by)
  values ('home', next_revision, p_content, p_actor_user_id);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_user_id,
    'content.home.draft_saved',
    'cms_page',
    'home',
    jsonb_build_object('revision', previous_revision),
    jsonb_build_object('revision', next_revision)
  );
  return next_revision;
end;
$$;

create or replace function public.publish_home_cms_draft(p_actor_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision integer;
  previous_published_revision integer;
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = p_actor_user_id
      and r.name in ('admin'::public.platform_role, 'super_admin'::public.platform_role)
      and p.name = 'content.home.manage'
  ) then
    raise exception 'homepage content permission required' using errcode = '42501';
  end if;

  select draft_revision, published_revision into current_revision, previous_published_revision
  from public.cms_home_pages where page_key = 'home' for update;
  if current_revision is null then
    raise exception 'homepage content not initialized' using errcode = 'P0002';
  end if;

  update public.cms_home_pages
  set published_content = draft_content,
      published_revision = current_revision,
      published_by = p_actor_user_id,
      published_at = now()
  where page_key = 'home';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_user_id,
    'content.home.published',
    'cms_page',
    'home',
    jsonb_build_object('revision', previous_published_revision),
    jsonb_build_object('revision', current_revision)
  );
  return current_revision;
end;
$$;

revoke all on function public.save_home_cms_draft(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.publish_home_cms_draft(uuid) from public, anon, authenticated;
revoke all on function public.actor_can_manage_home_cms(uuid) from public, anon, authenticated;
grant execute on function public.save_home_cms_draft(uuid, jsonb) to service_role;
grant execute on function public.publish_home_cms_draft(uuid) to service_role;
grant execute on function public.actor_can_manage_home_cms(uuid) to service_role;

comment on table public.cms_home_pages is 'Draft and published homepage content managed through the authenticated Admin API.';
comment on table public.cms_home_revisions is 'Immutable homepage draft snapshots for audit and restore.';

commit;

-- Rollback (manual, only if CMS is being removed):
-- drop function public.publish_home_cms_draft(uuid);
-- drop function public.save_home_cms_draft(uuid, jsonb);
-- drop function public.actor_can_manage_home_cms(uuid);
-- drop table public.cms_home_revisions;
-- drop table public.cms_home_pages;
-- delete from public.role_permissions where permission_id = (select id from public.permissions where name = 'content.home.manage');
-- delete from public.permissions where name = 'content.home.manage';
