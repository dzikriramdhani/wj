-- Editable DEV-safe shipping estimates. 500 g per fabric meter is an explicit
-- placeholder until warehouse scales/product weights are confirmed.
alter table public.products
  add column shipping_weight_grams_per_meter integer not null default 500
    check (shipping_weight_grams_per_meter > 0);

comment on column public.products.shipping_weight_grams_per_meter is
  'Provisional shipping weight per linear meter in grams; replace with measured SKU-specific weight before production.';
