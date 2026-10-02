import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const productSchema = z.object({
  productId: z.uuid().nullable().optional(),
  categoryId: z.uuid(),
  name: z.string().trim().min(2).max(200),
  sku: z.string().trim().min(2).max(120),
  composition: z.string().trim().min(2).max(200),
  gsm: z.number().int().positive(),
  widthCm: z.number().int().positive(),
  description: z.string().trim().min(10).max(4_000),
  pricePerMeter: z.number().nonnegative().max(999_999_999),
  stockMeters: z.number().nonnegative().max(999_999_999),
  moqRetail: z.number().nonnegative().max(999_999_999),
  shippingWeightGramsPerMeter: z.number().int().positive().max(1_000_000),
  isCustomOnly: z.boolean(),
  isActive: z.boolean(),
}).strict();

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: Request) {
  const editor = await requireAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Data produk tidak valid.' }, { status: 400 });

  const input = parsed.data;
  const slug = slugify(`${input.name}-${input.sku}`);
  if (slug.length < 3) return NextResponse.json({ error: 'Nama atau SKU tidak dapat digunakan.' }, { status: 400 });

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc('admin_save_catalog_product', {
      p_actor_user_id: editor.id,
      p_product_id: input.productId ?? null,
      p_category_id: input.categoryId,
      p_name: input.name,
      p_slug: slug,
      p_sku: input.sku,
      p_composition: input.composition,
      p_gsm: input.gsm,
      p_width_cm: input.widthCm,
      p_description: input.description,
      p_price_per_meter: input.pricePerMeter,
      p_stock_meters: input.stockMeters,
      p_moq_retail: input.moqRetail,
      p_shipping_weight_grams_per_meter: input.shippingWeightGramsPerMeter,
      p_is_custom_only: input.isCustomOnly,
      p_is_active: input.isActive,
    });
    if (error) {
      const status = error.code === '23505' ? 409 : error.code === 'P0002' ? 404 : 422;
      const message = error.code === '23505'
        ? 'SKU atau nama produk sudah digunakan.'
        : error.message === 'stock cannot be lower than reserved quantity'
          ? 'Stok tidak boleh lebih kecil dari jumlah yang sedang dipesan.'
          : 'Produk belum dapat disimpan.';
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ productId: data }, { status: input.productId ? 200 : 201 });
  } catch (error) {
    console.error('admin catalog save failed', error);
    return NextResponse.json({ error: 'Produk belum dapat disimpan.' }, { status: 500 });
  }
}
