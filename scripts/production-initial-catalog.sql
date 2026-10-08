-- Initial editable catalog for Production. Product descriptions, prices, stock,
-- and shipping weights are placeholders and must be reviewed against warehouse data.

insert into public.categories (name, slug, description, position)
values
  ('Katun', 'katun', 'Koleksi kain berbahan dasar katun.', 1),
  ('Polyester', 'polyester', 'Koleksi kain berbahan dasar polyester.', 2),
  ('Rayon', 'rayon', 'Koleksi kain rayon untuk kebutuhan busana.', 3),
  ('Denim', 'denim', 'Koleksi kain denim.', 4),
  ('Linen', 'linen', 'Koleksi kain campuran linen.', 5)
on conflict (slug) do nothing;

insert into public.products (
  category_id, name, slug, sku, composition, gsm, width_cm, description,
  certifications, moq_retail, shipping_weight_grams_per_meter,
  is_custom_only, is_active, published_at
)
select c.id, seed.name, seed.slug, seed.sku, seed.composition, seed.gsm,
  seed.width_cm, seed.description, '{}'::text[], seed.moq_retail,
  seed.shipping_weight_grams_per_meter, false, true, now()
from (
  values
    ('katun', 'Katun Combed 30s', 'katun-combed-30s', 'KAT-C30S', '100% Katun Combed', 180, 160, 'Kain katun halus untuk kaos dan pakaian kasual.', 10::numeric, 288),
    ('polyester', 'Polyester Micro Interlock', 'polyester-micro-interlock', 'POL-MINT', '100% Polyester', 220, 150, 'Kain polyester interlock untuk jersey dan seragam.', 10::numeric, 330),
    ('rayon', 'Rayon Viscose', 'rayon-viscose', 'RAY-VISC', '100% Rayon Viscose', 130, 150, 'Kain rayon dengan jatuh kain lembut untuk busana.', 10::numeric, 195),
    ('denim', 'Denim 12 oz', 'denim-12oz', 'DEN-12OZ', '100% Katun Denim', 400, 80, 'Kain denim untuk jeans, jaket, dan aksesori.', 5::numeric, 320),
    ('linen', 'Linen Cotton Blend', 'linen-cotton-blend', 'LIN-CTBL', '55% Linen, 45% Katun', 280, 160, 'Kain campuran linen dan katun untuk pakaian santai.', 5::numeric, 448),
    ('katun', 'Jersey CVC 60/40', 'jersey-cvc-60-40', 'JER-CVC64', '60% Katun, 40% Polyester', 190, 160, 'Kain jersey CVC untuk kaos dan merchandise.', 10::numeric, 304)
) as seed(category_slug, name, slug, sku, composition, gsm, width_cm, description, moq_retail, shipping_weight_grams_per_meter)
join public.categories c on c.slug = seed.category_slug
on conflict (slug) do nothing;

insert into public.product_variants (product_id, color_name, color_hex)
select p.id, seed.color_name, seed.color_hex
from (
  values
    ('KAT-C30S', 'Putih', '#FFFFFF'), ('KAT-C30S', 'Hitam', '#1A1A1A'), ('KAT-C30S', 'Navy', '#0A1628'),
    ('POL-MINT', 'Putih', '#FFFFFF'), ('POL-MINT', 'Merah', '#DC2626'), ('POL-MINT', 'Biru Royal', '#1D4ED8'),
    ('RAY-VISC', 'Dusty Pink', '#D4A0A0'), ('RAY-VISC', 'Sage Green', '#8FA387'),
    ('DEN-12OZ', 'Indigo', '#2E4057'), ('DEN-12OZ', 'Raw Indigo', '#1B2838'),
    ('LIN-CTBL', 'Natural', '#D4C5A9'), ('LIN-CTBL', 'Oat', '#C8B896'),
    ('JER-CVC64', 'Putih', '#FFFFFF'), ('JER-CVC64', 'Hitam', '#1A1A1A')
) as seed(product_sku, color_name, color_hex)
join public.products p on p.sku = seed.product_sku
on conflict (product_id, color_name) do nothing;

insert into public.product_prices (product_id, price_tier, currency, price_per_meter, min_quantity)
select p.id, 'retail', 'IDR', seed.price_per_meter, 0
from (
  values
    ('KAT-C30S', 65000::numeric), ('POL-MINT', 48000::numeric),
    ('RAY-VISC', 55000::numeric), ('DEN-12OZ', 120000::numeric),
    ('LIN-CTBL', 95000::numeric), ('JER-CVC64', 52000::numeric)
) as seed(product_sku, price_per_meter)
join public.products p on p.sku = seed.product_sku
where not exists (
  select 1 from public.product_prices current_price
  where current_price.product_id = p.id
    and current_price.price_tier = 'retail'
    and current_price.organization_id is null
    and current_price.min_quantity = 0
    and current_price.valid_until is null
);

insert into public.inventory (product_id, on_hand, reserved)
select p.id, seed.on_hand, 0
from (
  values
    ('KAT-C30S', 250::numeric), ('POL-MINT', 300::numeric), ('RAY-VISC', 180::numeric),
    ('DEN-12OZ', 80::numeric), ('LIN-CTBL', 60::numeric), ('JER-CVC64', 450::numeric)
) as seed(product_sku, on_hand)
join public.products p on p.sku = seed.product_sku
on conflict (product_id) do nothing;
