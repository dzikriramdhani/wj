# Editable shipping defaults

These values are development assumptions, not verified Wina Jaya shipping data.

## Current DEV assumptions

- RajaOngkir origin search: `Bandung`, inferred from the existing checkout example address.
- Fabric weight: `500` grams per linear meter for every existing and new product until measured SKU values are entered.
- Packaging weight: `500` grams per parcel.
- Midtrans DEV mode: `MIDTRANS_IS_PRODUCTION=false`; use sandbox-formatted Midtrans credentials.

Do not use the origin or weight defaults to quote or fulfill production orders.

## Change the origin and packaging estimate

Edit `apps/web/.env` (or `.env.local` for local development):

```env
RAJAONGKIR_ORIGIN_SEARCH=Bandung
SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER=500
SHIPPING_PACKAGING_WEIGHT_GRAMS=500
```

Replace `Bandung` with the actual warehouse area accepted by RajaOngkir. Its destination search returns the location ID needed by the shipping-cost endpoint; choose the exact warehouse district/subdistrict rather than relying on a broad city match. See the [RajaOngkir destination search guide](https://www.rajaongkir.com/docs/shipping-cost/endpoint-rajaongkir-for-search-base/search-destination). Restart the Next.js dev server after changing environment variables.

## Change an individual product weight

The `products.shipping_weight_grams_per_meter` column stores the measured weight in grams per meter. In the Supabase Dashboard, select the DEV project, open **Table Editor → products**, and edit the field for each SKU. New rows default to `500` grams per meter; replace that default with measured values before using shipping quotes.

For scripted DEV data updates, replace the example SKU and measured weight, then run this statement against DEV:

```sql
update public.products
set shipping_weight_grams_per_meter = 420
where sku = 'REPLACE-WITH-SKU';
```

Measure SKU and packaging weights before quoting paid shipping. Keep Midtrans Sandbox (`MIDTRANS_IS_PRODUCTION=false`) only in DEV/STAGING; production requires the approved live key pair and measured shipping configuration.
