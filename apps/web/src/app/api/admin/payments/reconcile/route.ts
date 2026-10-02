import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/admin-auth';
import { reconcileMidtransPayment } from '@/lib/midtrans-reconciliation';

export const runtime = 'nodejs';

const reconcileSchema = z.object({ orderId: z.uuid() }).strict();

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const parsed = reconcileSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });
  const result = await reconcileMidtransPayment(parsed.data.orderId);
  return result.ok
    ? NextResponse.json({ success: true, data: result.data })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
