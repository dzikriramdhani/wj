import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const guestSessionId = (await cookies()).get('wj_guest_session')?.value;
  if (!user && !z.uuid().safeParse(guestSessionId).success) {
    return NextResponse.json({ error: 'Masuk ke akun Anda atau gunakan perangkat checkout untuk melihat pesanan.' }, { status: 401 });
  }

  const service = createServiceClient();
  let query = service.from('orders').select('id, order_number, status, currency, subtotal, shipping_cost, grand_total, payment_expires_at, created_at, order_items(product_name, product_sku, variant_name, quantity_meters, unit_price, line_total), payments(status, payment_url, expires_at), shipments(courier_name, service_name, tracking_number, status), invoices(invoice_number,status,issued_at)').eq('id', id);
  if (user) query = query.eq('user_id', user.id);
  else if (z.uuid().safeParse(guestSessionId).success) query = query.eq('guest_session_id', guestSessionId!);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('order lookup failed', error);
    return NextResponse.json({ error: 'Status pesanan belum dapat dimuat.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
  const payment = Array.isArray(data.payments) ? data.payments[0] : data.payments;
  const shipment = Array.isArray(data.shipments) ? data.shipments[0] : data.shipments;
  const invoice = Array.isArray(data.invoices) ? data.invoices[0] : data.invoices;
  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      orderNumber: data.order_number,
      status: data.status,
      currency: data.currency,
      subtotal: Number(data.subtotal),
      shippingCost: Number(data.shipping_cost),
      totalAmount: Number(data.grand_total),
      paymentExpiresAt: data.payment_expires_at,
      createdAt: data.created_at,
      paymentStatus: payment?.status ?? 'pending',
      paymentUrl: payment?.payment_url ?? null,
      paymentExpiresAtProvider: payment?.expires_at ?? data.payment_expires_at,
      trackingNumber: shipment?.tracking_number ?? null,
      shipmentStatus: shipment?.status ?? null,
      courierName: shipment?.courier_name ?? null,
      serviceName: shipment?.service_name ?? null,
      invoiceNumber: invoice?.invoice_number ?? null,
      invoiceStatus: invoice?.status ?? null,
      items: (data.order_items ?? []).map((item) => ({
        productName: item.product_name,
        productSku: item.product_sku,
        variantName: item.variant_name,
        qtyMeters: Number(item.quantity_meters),
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      })),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
