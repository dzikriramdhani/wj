import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const fulfillmentSchema = z.object({
  status: z.enum(['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']),
  trackingNumber: z.string().trim().max(120).optional(),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });
  const parsed = fulfillmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Data pemenuhan pesanan tidak valid.' }, { status: 400 });
  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc('update_order_fulfillment', {
      p_order_id: id,
      p_order_status: parsed.data.status,
      p_tracking_number: parsed.data.trackingNumber ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'P0002' ? 404 : 422 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('order fulfillment update failed', error);
    return NextResponse.json({ error: 'Status pengiriman belum dapat diperbarui.' }, { status: 500 });
  }
}
