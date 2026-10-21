import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID pesanan tidak valid.' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Masuk ke akun perusahaan untuk melihat pembayaran.' }, { status: 401 });

  const service = createServiceClient();
  const { data: order, error: orderError } = await service
    .from('bulk_orders')
    .select('id,organization_id,bulk_order_number,status,payment_status,payment_expires_at,paid_at,total_amount,payment_terms,bulk_order_items(description,quantity,line_total)')
    .eq('id', id)
    .maybeSingle();
  if (orderError) {
    console.error('B2B payment order lookup failed', orderError);
    return NextResponse.json({ error: 'Ringkasan pesanan belum dapat dimuat.' }, { status: 503 });
  }
  if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });

  const { data: membership } = await service
    .from('organization_members')
    .select('role')
    .eq('organization_id', order.organization_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership?.role !== 'owner' && membership?.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya Pemilik atau Admin perusahaan yang dapat mengelola pembayaran.' }, { status: 403 });
  }

  const { data: payment, error: paymentError } = await service
    .from('bulk_order_payments')
    .select('status,payment_type,provider_data,expires_at,paid_at')
    .eq('bulk_order_id', order.id)
    .eq('provider', 'midtrans')
    .order('attempt_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paymentError) {
    console.error('B2B payment instruction lookup failed', paymentError);
    return NextResponse.json({ error: 'Status pembayaran belum dapat dimuat.' }, { status: 503 });
  }

  const paymentExpired = payment?.status === 'pending' && Boolean(payment.expires_at && Date.parse(payment.expires_at) <= Date.now());
  const paymentActionable = Boolean(payment && ['pending', 'capture'].includes(payment.status) && !paymentExpired);

  return NextResponse.json({
    success: true,
    data: {
      id: order.id,
      orderNumber: order.bulk_order_number,
      status: order.status,
      paymentStatus: paymentExpired ? 'expired' : order.payment_status,
      paymentType: payment?.payment_type ?? null,
      paymentInstruction: paymentActionable ? payment?.provider_data ?? null : null,
      paymentExpiresAt: paymentActionable ? payment?.expires_at ?? null : null,
      paidAt: payment?.paid_at ?? order.paid_at,
      totalAmount: Number(order.total_amount),
      paymentTerms: order.payment_terms,
      items: (order.bulk_order_items ?? []).map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        lineTotal: Number(item.line_total),
      })),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
