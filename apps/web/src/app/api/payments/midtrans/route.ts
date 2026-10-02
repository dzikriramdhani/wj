import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attachGuestSession, getCommerceOwner } from '@/lib/commerce-owner';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const paymentSchema = z.object({ orderId: z.uuid() }).strict();

function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) throw new Error('Midtrans belum dikonfigurasi.');
  const production = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  return {
    serverKey,
    snapUrl: production
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
  };
}

function getFinishUrl(orderId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return undefined;
  try {
    const url = new URL(appUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    url.pathname = `/orders/${orderId}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, 'payment-session', 10, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak percobaan pembayaran. Coba kembali beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  try {
    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });

    const owner = await getCommerceOwner();
    const service = createServiceClient();
    const { data: payment, error: paymentError } = await service.rpc('prepare_midtrans_payment', {
      p_order_id: parsed.data.orderId,
      p_user_id: owner.userId,
      p_guest_session_id: owner.guestSessionId,
    });
    if (paymentError) {
      const missing = paymentError.code === 'P0002';
      return NextResponse.json({ error: missing ? 'Pesanan tidak ditemukan.' : paymentError.message }, { status: missing ? 404 : 422 });
    }
    if (!payment) return NextResponse.json({ error: 'Sesi pembayaran belum dapat dibuat.' }, { status: 500 });
    if (payment.paymentUrl) {
      return attachGuestSession(NextResponse.json({ success: true, data: { paymentUrl: payment.paymentUrl, reused: true } }), owner);
    }

    const config = midtransConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let providerResponse: Response;
    try {
      providerResponse = await fetch(config.snapUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: payment.providerOrderId,
            gross_amount: Math.round(Number(payment.amount)),
          },
          customer_details: {
            first_name: payment.customerName,
            email: payment.customerEmail,
            phone: payment.customerPhone || undefined,
          },
          expiry: { unit: 'minute', duration: Math.max(1, Math.floor((new Date(payment.expiresAt).getTime() - Date.now()) / 60_000)) },
          callbacks: getFinishUrl(parsed.data.orderId) ? { finish: getFinishUrl(parsed.data.orderId) } : undefined,
        }),
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const providerBody = await providerResponse.json().catch(() => ({})) as { redirect_url?: string; status_code?: string };
    if (!providerResponse.ok || !providerBody.redirect_url) {
      console.error('Midtrans Snap session rejected', providerResponse.status);
      return NextResponse.json({ error: 'Sesi pembayaran belum tersedia. Coba kembali sebentar lagi.' }, { status: 503 });
    }
    const { data: completed, error: completionError } = await service.rpc('complete_midtrans_payment_session', {
      p_provider_order_id: payment.providerOrderId,
      p_payment_url: providerBody.redirect_url,
      p_provider_response_code: providerBody.status_code ?? String(providerResponse.status),
    });
    if (completionError || !completed?.paymentUrl) {
      console.error('Midtrans payment session persistence failed', completionError);
      return NextResponse.json({ error: 'Sesi pembayaran dibuat, tetapi belum tersimpan. Coba kembali dari halaman pesanan.' }, { status: 503 });
    }
    return attachGuestSession(NextResponse.json({ success: true, data: { paymentUrl: completed.paymentUrl, reused: false } }), owner);
  } catch (error) {
    console.error('Midtrans payment creation failed', error);
    return NextResponse.json({ error: 'Sesi pembayaran belum dapat dibuat.' }, { status: 503 });
  }
}
