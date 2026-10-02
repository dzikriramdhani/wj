import { createClient } from '@/lib/supabase/server';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('orders')
    .select('id,order_number,status,customer_name,customer_email,grand_total,currency,created_at,payments(status,payment_url),shipments(status,tracking_number,courier_name,service_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return <OrdersClient orders={(rows ?? []).map((order) => {
    const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
    const shipment = Array.isArray(order.shipments) ? order.shipments[0] : order.shipments;
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      total: Number(order.grand_total),
      createdAt: order.created_at,
      paymentStatus: payment?.status ?? 'pending',
      shipmentStatus: shipment?.status ?? null,
      trackingNumber: shipment?.tracking_number ?? '',
      courier: shipment ? `${shipment.courier_name} · ${shipment.service_name}` : null,
    };
  })} />;
}
