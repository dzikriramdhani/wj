import { getSupabasePublicEnv } from './env';

type Relation<T> = T | T[] | null;

type CatalogRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  composition: string;
  gsm: number;
  width_cm: number;
  description: string;
  certifications: string[];
  moq_retail: number | string;
  is_custom_only: boolean;
  categories: Relation<{ name: string }>;
  product_variants: Relation<{ id: string; color_name: string; color_hex: string | null }>;
  product_images: Relation<{ storage_path: string; position: number }>;
  product_prices: Relation<{ price_per_meter: number | string; min_quantity: number | string }>;
};

function asArray<T>(value: Relation<T>): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value as T] : [];
}

export function toPublicProduct(row: CatalogRow, isAvailable = false) {
  const prices = asArray(row.product_prices)
    .filter((price) => Number(price.min_quantity) === 0)
    .sort((a, b) => Number(a.price_per_meter) - Number(b.price_per_meter));
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  const { url } = getSupabasePublicEnv();

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    category: category?.name ?? '',
    composition: row.composition,
    gsm: row.gsm,
    widthCm: row.width_cm,
    pricePerMeter: prices[0] ? Number(prices[0].price_per_meter) : 0,
    isAvailable,
    moqRetail: Number(row.moq_retail),
    isCustomOnly: row.is_custom_only,
    images: asArray(row.product_images)
      .sort((a, b) => a.position - b.position)
      .map(({ storage_path }) =>
        storage_path.startsWith('http')
          ? storage_path
          : `${url}/storage/v1/object/public/product-images/${storage_path}`,
      ),
    description: row.description,
    certifications: row.certifications,
    variants: asArray(row.product_variants).map((variant) => ({
      id: variant.id,
      productId: row.id,
      colorName: variant.color_name,
      colorHex: variant.color_hex ?? undefined,
    })),
  };
}
