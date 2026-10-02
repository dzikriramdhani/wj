-- Synthetic storefront data for DEV only. Never run this seed in STAGING or PROD.
-- Re-running it resets the listed DEV inventory figures; use Admin → Produk
-- for normal catalog, price, and stock updates after this initial seed.
insert into public.categories (id, name, slug, position) values
  ('00000000-0000-4000-8000-000000000101', 'Katun', 'katun', 1),
  ('00000000-0000-4000-8000-000000000102', 'Polyester', 'polyester', 2),
  ('00000000-0000-4000-8000-000000000103', 'Rayon', 'rayon', 3),
  ('00000000-0000-4000-8000-000000000104', 'Denim', 'denim', 4),
  ('00000000-0000-4000-8000-000000000105', 'Linen', 'linen', 5),
  ('00000000-0000-4000-8000-000000000106', 'Spandex', 'spandex', 6)
on conflict (slug) do update set name = excluded.name, position = excluded.position, is_active = true;

insert into public.products (
  id, category_id, name, slug, sku, composition, gsm, width_cm, description,
  certifications, moq_retail, is_custom_only, is_active, published_at
) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Katun Combed 30s Premium', 'katun-combed-30s-premium', 'KC-30S-PRM', '100% Cotton Combed', 180, 160, 'Kain katun combed premium yang halus dan nyaman untuk kaos serta pakaian kasual.', array['OEKO-TEX Standard 100'], 100, false, true, now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', 'Polyester Mikro Interlock', 'polyester-mikro-interlock', 'PL-MKR-INT', '100% Polyester Micro', 220, 150, 'Kain polyester mikro interlock untuk jersey olahraga, seragam, dan pakaian aktif.', '{}', 150, false, true, now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000103', 'Rayon Viscose Premium', 'rayon-viscose-premium', 'RY-VSC-PRM', '100% Rayon Viscose', 130, 150, 'Rayon viscose premium dengan drape lembut untuk busana harian.', array['OEKO-TEX Standard 100', 'GOTS'], 50, false, true, now()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000104', 'Denim Selvedge 12oz', 'denim-selvedge-12oz', 'DN-SLV-12', '100% Cotton Denim', 400, 80, 'Denim selvedge padat untuk jeans, jaket, dan produk premium.', array['OEKO-TEX Standard 100'], 30, false, true, now()),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000105', 'Linen Blend French Terry', 'linen-blend-french-terry', 'LN-FRT-BL', '55% Linen, 45% Cotton', 280, 160, 'French terry blend linen dan katun untuk hoodie, sweater, dan loungewear.', array['GOTS'], 20, false, true, now()),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000101', 'Jersey CVC 60/40', 'jersey-cvc-60-40', 'JR-CVC-60', '60% Cotton, 40% Polyester', 190, 160, 'Kain jersey CVC untuk produksi kaos dan merchandise.', '{}', 80, false, true, now()),
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000101', 'Twill Stretch Cotton', 'twill-stretch-cotton', 'TW-STR-CT', '97% Cotton, 3% Spandex', 260, 150, 'Kain twill cotton stretch dengan warna pilihan untuk seragam dan pakaian kerja.', '{}', 40, false, true, now()),
  ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000106', 'Spandex Lycra Performance', 'spandex-lycra-performance', 'SP-LYC-PF', '80% Nylon, 20% Spandex', 200, 150, 'Kain elastis untuk pakaian olahraga dan performa.', '{}', 50, false, true, now()),
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000102', 'Custom Print Sublimation Base', 'custom-print-sublimation-base', 'CP-SUB-BS', '100% Polyester', 160, 160, 'Basis kain sublimasi custom; harga dan spesifikasi ditetapkan melalui RFQ.', '{}', 500, true, true, now())
on conflict (slug) do update set
  category_id = excluded.category_id, name = excluded.name, sku = excluded.sku,
  composition = excluded.composition, gsm = excluded.gsm, width_cm = excluded.width_cm,
  description = excluded.description, certifications = excluded.certifications,
  moq_retail = excluded.moq_retail, is_custom_only = excluded.is_custom_only,
  is_active = excluded.is_active, published_at = excluded.published_at;

insert into public.product_variants (product_id, color_name, color_hex) values
  ('00000000-0000-4000-8000-000000000001', 'Putih', '#FFFFFF'),
  ('00000000-0000-4000-8000-000000000001', 'Hitam', '#1A1A1A'),
  ('00000000-0000-4000-8000-000000000001', 'Navy', '#0A1628'),
  ('00000000-0000-4000-8000-000000000002', 'Putih', '#FFFFFF'),
  ('00000000-0000-4000-8000-000000000002', 'Merah', '#DC2626'),
  ('00000000-0000-4000-8000-000000000002', 'Biru Royal', '#1D4ED8'),
  ('00000000-0000-4000-8000-000000000003', 'Dusty Pink', '#D4A0A0'),
  ('00000000-0000-4000-8000-000000000003', 'Sage Green', '#8FA387'),
  ('00000000-0000-4000-8000-000000000004', 'Indigo', '#2E4057'),
  ('00000000-0000-4000-8000-000000000004', 'Raw Indigo', '#1B2838'),
  ('00000000-0000-4000-8000-000000000005', 'Natural', '#D4C5A9'),
  ('00000000-0000-4000-8000-000000000005', 'Oat', '#C8B896'),
  ('00000000-0000-4000-8000-000000000006', 'Putih', '#FFFFFF'),
  ('00000000-0000-4000-8000-000000000006', 'Hitam', '#1A1A1A'),
  ('00000000-0000-4000-8000-000000000007', 'Khaki', '#C3B091'),
  ('00000000-0000-4000-8000-000000000007', 'Navy', '#0A1628'),
  ('00000000-0000-4000-8000-000000000008', 'Hitam', '#1A1A1A'),
  ('00000000-0000-4000-8000-000000000008', 'Putih', '#FFFFFF'),
  ('00000000-0000-4000-8000-000000000009', 'Custom', '#8A8A8A')
on conflict (product_id, color_name) do update set color_hex = excluded.color_hex, is_active = true;

insert into public.product_prices (product_id, price_tier, currency, price_per_meter, min_quantity)
select seed.product_id, 'retail', 'IDR', seed.price, 0
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 65000::numeric),
  ('00000000-0000-4000-8000-000000000002'::uuid, 48000::numeric),
  ('00000000-0000-4000-8000-000000000003'::uuid, 55000::numeric),
  ('00000000-0000-4000-8000-000000000004'::uuid, 120000::numeric),
  ('00000000-0000-4000-8000-000000000005'::uuid, 95000::numeric),
  ('00000000-0000-4000-8000-000000000006'::uuid, 52000::numeric),
  ('00000000-0000-4000-8000-000000000007'::uuid, 78000::numeric),
  ('00000000-0000-4000-8000-000000000008'::uuid, 85000::numeric)
) as seed(product_id, price)
where not exists (
  select 1 from public.product_prices current_price
  where current_price.product_id = seed.product_id and current_price.price_tier = 'retail'
    and current_price.organization_id is null and current_price.min_quantity = 0
    and current_price.valid_until is null
);

insert into public.inventory (product_id, on_hand, reserved) values
  ('00000000-0000-4000-8000-000000000001', 2500, 0),
  ('00000000-0000-4000-8000-000000000002', 3200, 0),
  ('00000000-0000-4000-8000-000000000003', 1800, 0),
  ('00000000-0000-4000-8000-000000000004', 800, 0),
  ('00000000-0000-4000-8000-000000000005', 600, 0),
  ('00000000-0000-4000-8000-000000000006', 4500, 0),
  ('00000000-0000-4000-8000-000000000007', 1200, 0),
  ('00000000-0000-4000-8000-000000000008', 900, 0),
  ('00000000-0000-4000-8000-000000000009', 0, 0)
on conflict (product_id) do update set on_hand = excluded.on_hand, reserved = excluded.reserved;
