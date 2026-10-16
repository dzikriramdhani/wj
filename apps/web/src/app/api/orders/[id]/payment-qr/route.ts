import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCommerceOwner } from '@/lib/commerce-owner';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, 'payment-qr', 30, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak permintaan QR pembayaran.' }, { status: 429 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });

  const owner = await getCommerceOwner();
  const service = createServiceClient();
  let orderQuery = service.from('orders').select('id').eq('id', id);
  orderQuery = owner.userId
    ? orderQuery.eq('user_id', owner.userId)
    : orderQuery.eq('guest_session_id', owner.guestSessionId);
  const { data: order } = await orderQuery.maybeSingle();
  if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });

  const { data: payment } = await service
    .from('payments')
    .select('provider_data')
    .eq('order_id', order.id)
    .eq('provider', 'midtrans')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const instruction = payment?.provider_data as { paymentType?: string; actions?: Array<{ name?: string; url?: string }> } | null;
  const qrAction = instruction?.actions?.find((action) => action.name === 'generate-qr-code');
  if (instruction?.paymentType !== 'qris' || !qrAction?.url) {
    return NextResponse.json({ error: 'QR pembayaran tidak tersedia.' }, { status: 404 });
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) return NextResponse.json({ error: 'Midtrans belum dikonfigurasi.' }, { status: 503 });
  let qrUrl: URL;
  try {
    qrUrl = new URL(qrAction.url);
  } catch {
    return NextResponse.json({ error: 'Alamat QR pembayaran tidak valid.' }, { status: 502 });
  }
  const allowedHosts = ['api.midtrans.com', 'api.sandbox.midtrans.com'];
  if (qrUrl.protocol !== 'https:' || !allowedHosts.includes(qrUrl.hostname) || !qrUrl.pathname.startsWith('/v2/qris/')) {
    return NextResponse.json({ error: 'Alamat QR pembayaran tidak valid.' }, { status: 502 });
  }
  const qrResponse = await fetch(qrUrl, {
    headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}` },
    cache: 'no-store',
  }).catch(() => null);
  if (!qrResponse?.ok) return NextResponse.json({ error: 'QR pembayaran belum dapat dimuat.' }, { status: 503 });

  const contentType = qrResponse.headers.get('content-type') ?? 'image/png';
  if (!contentType.startsWith('image/')) return NextResponse.json({ error: 'Format QR pembayaran tidak valid.' }, { status: 502 });
  return new NextResponse(await qrResponse.arrayBuffer(), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
