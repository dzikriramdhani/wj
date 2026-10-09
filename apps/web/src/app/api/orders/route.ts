import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { attachGuestSession, getCommerceOwner } from '@/lib/commerce-owner';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/rate-limit';
import { reportServerError } from '@/lib/observability';

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.email().max(254),
  customerPhone: z.string().trim().max(32).optional().nullable(),
  shippingQuoteId: z.uuid(),
  shippingAddress: z.object({
    recipientName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(32),
    addressLine: z.string().trim().min(10).max(500),
    provinceId: z.string().min(1).max(40),
    provinceName: z.string().min(1).max(120),
    destinationId: z.string().min(1).max(40),
    cityName: z.string().min(1).max(120),
    districtName: z.string().max(120).optional().nullable(),
    postalCode: z.string().regex(/^\d{5}$/),
  }),
  items: z.array(z.object({
    productId: z.uuid(),
    variantId: z.uuid().optional().nullable(),
    qtyMeters: z.number().positive().max(100000),
  })).min(1).max(30),
}).strict();

export async function POST(request: Request) {
  const rate = checkRateLimit(request, 'checkout', 10, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak percobaan checkout. Coba kembali beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  try {
    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data checkout tidak valid.', details: parsed.error.flatten() }, { status: 400 });
    }
    const idempotencyKey = request.headers.get('idempotency-key') ?? '';
    if (idempotencyKey.length < 16 || idempotencyKey.length > 119) {
      return NextResponse.json({ error: 'Header Idempotency-Key wajib berisi 16–119 karakter.' }, { status: 400 });
    }

    const owner = await getCommerceOwner();

    const input = parsed.data;
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const service = createServiceClient();
    const { data, error } = await service.rpc('create_checkout_order', {
      p_user_id: owner.userId,
      p_guest_session_id: owner.guestSessionId,
      p_customer_name: input.customerName,
      p_customer_email: input.customerEmail,
      p_customer_phone: input.customerPhone ?? input.shippingAddress.phone,
      p_shipping_quote_id: input.shippingQuoteId,
      p_shipping_address_snapshot: input.shippingAddress,
      p_items: input.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        qtyMeters: item.qtyMeters,
      })),
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) {
      console.error('Checkout order RPC failed', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      const clientError = /required|unavailable|inventory|minimum|quote|address|quantity|price/i.test(error.message);
      return NextResponse.json({ error: clientError ? error.message : 'Pesanan gagal disimpan.' }, { status: clientError ? 422 : 500 });
    }
    return attachGuestSession(
      NextResponse.json({ success: true, data }, { status: data?.idempotentReplay ? 200 : 201 }),
      owner,
    );
  } catch (error) {
    console.error('Checkout order creation failed', error);
    await reportServerError(error, 'orders.create');
    return NextResponse.json({ error: 'Checkout gagal diproses. Silakan coba kembali.' }, { status: 500 });
  }
}
