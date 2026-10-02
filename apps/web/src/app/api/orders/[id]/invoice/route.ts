import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const formatRupiah = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character] ?? character);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response('ID pesanan tidak valid.', { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const guestSessionId = (await cookies()).get('wj_guest_session')?.value;
  if (!user && !z.uuid().safeParse(guestSessionId).success) {
    return new Response('Pesanan tidak ditemukan.', { status: 404 });
  }

  const service = createServiceClient();
  let query = service.from('orders').select('id,order_number,customer_name,customer_email,shipping_address_snapshot,subtotal,shipping_cost,grand_total,currency,status,created_at,order_items(product_name,product_sku,variant_name,quantity_meters,unit_price,line_total),invoices(invoice_number,status,issued_at)').eq('id', id);
  if (user) query = query.eq('user_id', user.id);
  else if (z.uuid().safeParse(guestSessionId).success) query = query.eq('guest_session_id', guestSessionId!);
  const { data: order } = await query.maybeSingle();
  const invoice = order && (Array.isArray(order.invoices) ? order.invoices[0] : order.invoices);
  if (!order || !invoice || invoice.status !== 'issued') return new Response('Invoice belum tersedia.', { status: 404 });

  const address = order.shipping_address_snapshot as { addressLine?: string; cityName?: string; provinceName?: string; postalCode?: string };
  const rows = (order.order_items ?? []).map((item) => `<tr><td>${escapeHtml(item.product_name)}${item.variant_name ? ` · ${escapeHtml(item.variant_name)}` : ''}</td><td>${Number(item.quantity_meters).toLocaleString('id-ID')} m</td><td>${formatRupiah(Number(item.line_total))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_number)}</title><style>body{font-family:Arial,sans-serif;margin:48px;color:#1d1d1b}main{max-width:760px;margin:auto}header,footer{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #ddd;padding-bottom:24px}footer{border-top:1px solid #ddd;border-bottom:0;padding-top:18px;margin-top:22px}h1{margin:0;font-size:30px}p{line-height:1.5;color:#555}table{width:100%;border-collapse:collapse;margin-top:32px}th,td{padding:12px 0;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child{text-align:right}.total{font-size:18px;font-weight:bold}@media print{body{margin:0}}</style></head><body><main><header><div><h1>INVOICE</h1><p>${escapeHtml(invoice.invoice_number)}<br>Pesanan ${escapeHtml(order.order_number)}</p></div><div><strong>WINA JAYA</strong><p>Diterbitkan ${new Date(invoice.issued_at).toLocaleDateString('id-ID')}</p></div></header><section><h2>Tagihan kepada</h2><p><strong>${escapeHtml(order.customer_name)}</strong><br>${escapeHtml(order.customer_email)}<br>${escapeHtml([address.addressLine, address.cityName, address.provinceName, address.postalCode].filter(Boolean).join(', '))}</p></section><table><thead><tr><th>Produk</th><th>Jumlah</th><th>Nilai</th></tr></thead><tbody>${rows}</tbody></table><footer><span>Subtotal<br>Pengiriman<br><strong>Total</strong></span><span style="text-align:right">${formatRupiah(Number(order.subtotal))}<br>${formatRupiah(Number(order.shipping_cost))}<br><strong class="total">${formatRupiah(Number(order.grand_total))}</strong></span></footer></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } });
}
