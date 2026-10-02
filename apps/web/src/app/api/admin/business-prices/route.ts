import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

const schema = z.object({ organizationId: z.string().uuid(), productId: z.string().uuid(), pricePerMeter: z.number().min(0), minQuantity: z.number().min(0).default(0), validUntil: z.string().datetime().optional() });
export async function POST(request: Request) {
  const admin = await requireAdminUser(); if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Harga perusahaan tidak valid.' }, { status: 400 });
  const input = parsed.data; const service = createServiceClient();
  const { data: organization } = await service.from('organizations').select('id,status').eq('id', input.organizationId).maybeSingle();
  if (!organization || organization.status !== 'verified') return NextResponse.json({ error: 'Harga khusus hanya dapat diberikan ke perusahaan terverifikasi.' }, { status: 400 });
  const { error } = await service.from('product_prices').insert({ organization_id: input.organizationId, product_id: input.productId, price_tier: 'business', price_per_meter: input.pricePerMeter, min_quantity: input.minQuantity, valid_until: input.validUntil ?? null });
  if (error) return NextResponse.json({ error: 'Harga perusahaan belum dapat disimpan.' }, { status: 400 });
  await service.from('audit_logs').insert({ actor_user_id: admin.id, organization_id: input.organizationId, action: 'business_price.created', entity_type: 'product_price', entity_id: input.productId, metadata: { min_quantity: input.minQuantity } });
  return NextResponse.json({ success: true }, { status: 201 });
}
