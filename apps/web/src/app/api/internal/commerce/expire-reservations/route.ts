import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { reportServerError } from '@/lib/observability';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc('expire_pending_checkout_orders');
    if (error) throw error;
    return NextResponse.json({ success: true, expiredOrders: data ?? 0 });
  } catch (error) {
    reportServerError(error, 'commerce.expire_reservations');
    return NextResponse.json({ error: 'Pelepasan reservasi belum dapat diproses.' }, { status: 500 });
  }
}

export { POST as GET };
