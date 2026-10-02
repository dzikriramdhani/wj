import { createServiceClient } from '@/lib/supabase/service';
import ProductsClient from './ProductsClient';

export default async function AdminProductsPage() {
  const service = createServiceClient();
  const [{ data, error }, { data: categoryData, error: categoryError }] = await Promise.all([
    service
      .from('products')
      .select(`
        id,category_id,name,sku,composition,gsm,width_cm,description,moq_retail,
        shipping_weight_grams_per_meter,is_custom_only,is_active,
        categories(name),inventory(on_hand,reserved),product_images(id,storage_path,alt_text,position),
        product_variants(id,color_name,color_hex,variant_inventory(on_hand,reserved)),
        product_prices(price_per_meter,price_tier,organization_id,min_quantity,valid_from,valid_until)
      `)
      .order('name'),
    service.from('categories').select('id,name').eq('is_active', true).order('position').order('name'),
  ]);

  type ProductRow = {
    id: string; category_id: string; name: string; sku: string; composition: string;
    gsm: number; width_cm: number; description: string; moq_retail: number | string;
    shipping_weight_grams_per_meter: number; is_custom_only: boolean; is_active: boolean;
    categories: { name: string } | { name: string }[] | null;
    inventory: { on_hand: number | string; reserved: number | string } | { on_hand: number | string; reserved: number | string }[] | null;
    product_prices: Array<{ price_per_meter: number | string; price_tier: string; organization_id: string | null; min_quantity: number | string; valid_from: string; valid_until: string | null }>;
    product_images: Array<{ id: string; storage_path: string; alt_text: string; position: number }>;
    product_variants: Array<{ id: string; color_name: string; color_hex: string | null; variant_inventory: { on_hand: number | string; reserved: number | string } | Array<{ on_hand: number | string; reserved: number | string }> | null }>;
  };
  const now = new Date().getTime();
  const products = ((data ?? []) as ProductRow[]).map((row) => {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const inventory = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
    const price = row.product_prices
      .filter((item) => item.price_tier === 'retail' && item.organization_id === null
        && Number(item.min_quantity) === 0 && Date.parse(item.valid_from) <= now
        && (!item.valid_until || Date.parse(item.valid_until) > now))
      .sort((a, b) => Date.parse(b.valid_from) - Date.parse(a.valid_from))[0];
    return {
      id: row.id,
      categoryId: row.category_id,
      sku: row.sku,
      name: row.name,
      category: category?.name ?? 'Tanpa kategori',
      composition: row.composition,
      gsm: row.gsm,
      widthCm: row.width_cm,
      description: row.description,
      pricePerMeter: Number(price?.price_per_meter ?? 0),
      stockMeters: Number(inventory?.on_hand ?? 0),
      moqRetail: Number(row.moq_retail),
      shippingWeightGramsPerMeter: row.shipping_weight_grams_per_meter,
      images: (row.product_images ?? []).sort((a, b) => a.position - b.position).map((image) => ({
        id: image.id,
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/product-images/${image.storage_path.split('/').map(encodeURIComponent).join('/')}`,
        altText: image.alt_text,
      })),
      variants: (row.product_variants ?? []).map((variant) => {
        const variantInventory = Array.isArray(variant.variant_inventory) ? variant.variant_inventory[0] : variant.variant_inventory;
        return { id: variant.id, colorName: variant.color_name, colorHex: variant.color_hex, stockMeters: Number(variantInventory?.on_hand ?? 0) };
      }),
      isCustomOnly: row.is_custom_only,
      isActive: row.is_active,
    };
  });

  return (
    <ProductsClient
      products={products}
      categories={(categoryData ?? []).map((category) => ({ id: category.id, name: category.name }))}
      loadError={error || categoryError ? 'Data produk belum dapat dimuat.' : undefined}
    />
  );
}
