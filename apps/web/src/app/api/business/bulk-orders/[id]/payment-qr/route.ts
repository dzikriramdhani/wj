import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, 'b2b-payment-qr', 30, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak permintaan QR pembayaran.' }, { status: 429 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Masuk ke akun perusahaan untuk melihat pembayaran.' }, { status: 401 });

  const service = createServiceClient();
  const { data: order } = await service.from('bulk_orders').select('id,organization_id').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
  const { data: membership } = await service
    .from('organization_members')
    .select('role')
    .eq('organization_id', order.organization_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership?.role !== 'owner' && membership?.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya Pemilik atau Admin perusahaan yang dapat melihat instruksi pembayaran.' }, { status: 403 });
  }

  const { data: payment } = await service
    .from('bulk_order_payments')
    .select('status,expires_at,provider_data')
    .eq('bulk_order_id', order.id)
    .eq('provider', 'midtrans')
    .order('attempt_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment || !['pending', 'capture'].includes(payment.status) || Date.parse(payment.expires_at) <= Date.now()) {
    return NextResponse.json({ error: 'Pembayaran QR sudah tidak aktif.' }, { status: 404 });
  }
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
