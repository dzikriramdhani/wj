import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

const variantSchema = z.object({
  colorName: z.string().trim().min(2).max(120),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  stockMeters: z.number().nonnegative().max(999_999_999),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { id: productId } = await params;
  if (!z.uuid().safeParse(productId).success) return NextResponse.json({ error: 'ID produk tidak valid.' }, { status: 400 });
  const parsed = variantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data varian tidak valid.' }, { status: 400 });
  try {
    const service = createServiceClient();
    const { data: variant, error } = await service.from('product_variants').insert({
      product_id: productId,
      color_name: parsed.data.colorName,
      color_hex: parsed.data.colorHex ?? null,
    }).select('id').single();
    if (error || !variant) {
      if (error?.code === '23505') return NextResponse.json({ error: 'Nama varian sudah digunakan pada produk ini.' }, { status: 409 });
      throw error ?? new Error('variant insert failed');
    }
    const { error: inventoryError } = await service.from('variant_inventory').insert({ variant_id: variant.id, on_hand: parsed.data.stockMeters, reserved: 0 });
    if (inventoryError) throw inventoryError;
    await service.from('audit_logs').insert({ actor_user_id: admin.id, action: 'catalog.variant_created', entity_type: 'product_variant', entity_id: variant.id, metadata: { product_id: productId } });
    return NextResponse.json({ success: true, variantId: variant.id }, { status: 201 });
  } catch (error) {
    console.error('product variant create failed', error);
    return NextResponse.json({ error: 'Varian belum dapat disimpan.' }, { status: 503 });
  }
}
