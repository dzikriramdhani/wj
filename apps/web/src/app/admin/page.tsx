import AnalyticsDashboard from './AnalyticsDashboard';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const supabase = createServiceClient();
  const detailStart = new Date();
  detailStart.setUTCDate(detailStart.getUTCDate() - 90);
  const detailSince = detailStart.toISOString();
  const [{ data: rfqRows }, { count: productCount }, { data: orderRows }] = await Promise.all([
    supabase
      .from('rfqs')
      .select('id,status,created_at,rfq_items(requested_quantity,products(name))')
      .gte('created_at', detailSince)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('published_at', 'is', null),
    supabase
      .from('orders')
      .select('id,order_number,grand_total,created_at,payments(status),order_items(product_id,product_name,quantity_meters,line_total)')
      .gte('created_at', detailSince)
      .order('created_at', { ascending: false }),
  ]);

  const rfqs = (rfqRows ?? []).map((rfq) => {
    const item = Array.isArray(rfq.rfq_items) ? rfq.rfq_items[0] : rfq.rfq_items;
    const relation = item?.products;
    const product = Array.isArray(relation) ? relation[0] : relation;
    return {
      id: rfq.id,
      status: rfq.status.toUpperCase(),
      createdAt: rfq.created_at,
      qtyRequested: Number(item?.requested_quantity ?? 0),
      productName: product?.name ?? 'Permintaan kain custom',
    };
  });

  const orders = (orderRows ?? []).map((order) => {
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const isPaid = payments.some((payment) => ['capture', 'settlement'].includes(payment.status));
    return {
      id: order.order_number ?? order.id,
      status: isPaid ? 'PAID' : 'PENDING_PAYMENT',
      paymentStatus: isPaid ? 'paid' : 'pending',
      totalAmount: Number(order.grand_total),
      createdAt: order.created_at,
      items: (order.order_items ?? []).map((item) => ({
        productId: item.product_id ?? item.product_name,
        productName: item.product_name,
        qtyMeters: Number(item.quantity_meters),
        lineTotal: Number(item.line_total),
      })),
    };
  });

  return <AnalyticsDashboard orders={orders} rfqs={rfqs} productCount={productCount ?? 0} />;
}
