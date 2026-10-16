import { Buffer } from 'node:buffer';
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

type PdfLine = { text: string; size?: number; bold?: boolean };

function pdfText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ' ')
    .replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function wrapPdfText(value: string, maxLength = 86): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function makeInvoicePdf(lines: PdfLine[]) {
  const pageLines: PdfLine[][] = [];
  for (let index = 0; index < lines.length; index += 40) pageLines.push(lines.slice(index, index + 40));
  const objects: string[] = [];
  const pageIds = pageLines.map((_, index) => 5 + index * 2);
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((pageId) => `${pageId} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  pageLines.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = page.map((line, lineIndex) => {
      const y = 790 - lineIndex * 17;
      const font = line.bold ? 'F2' : 'F1';
      const size = line.size ?? 10;
      return `BT /${font} ${size} Tf 50 ${y} Td (${pdfText(line.text)}) Tj ET`;
    }).join('\n');
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const invoiceFileName = `${invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;
  const download = new URL(request.url).searchParams.get('download') === '1';
  if (download) {
    const addressText = [address.addressLine, address.cityName, address.provinceName, address.postalCode].filter(Boolean).join(', ');
    const pdfLines: PdfLine[] = [
      { text: 'WINA JAYA', size: 20, bold: true },
      { text: 'INVOICE', size: 16, bold: true },
      { text: `Nomor invoice: ${invoice.invoice_number}`, bold: true },
      { text: `Nomor pesanan: ${order.order_number}` },
      { text: `Tanggal terbit: ${new Date(invoice.issued_at).toLocaleDateString('id-ID')}` },
      { text: '' },
      { text: 'TAGIHAN KEPADA', bold: true },
      ...wrapPdfText(order.customer_name).map((text) => ({ text })),
      ...wrapPdfText(order.customer_email).map((text) => ({ text })),
      ...wrapPdfText(addressText).map((text) => ({ text })),
      { text: '' },
      { text: 'RINCIAN PRODUK', bold: true },
      ...order.order_items.flatMap((item) => [
        ...wrapPdfText(`${item.product_name}${item.variant_name ? ` - ${item.variant_name}` : ''}`).map((text) => ({ text })),
        { text: `  ${Number(item.quantity_meters).toLocaleString('id-ID')} meter   ${formatRupiah(Number(item.line_total))}` },
      ]),
      { text: '' },
      { text: `Subtotal: ${formatRupiah(Number(order.subtotal))}` },
      { text: `Pengiriman: ${formatRupiah(Number(order.shipping_cost))}` },
      { text: `TOTAL: ${formatRupiah(Number(order.grand_total))}`, size: 13, bold: true },
    ];
    const pdf = makeInvoicePdf(pdfLines);
    return new Response(new Uint8Array(pdf), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceFileName}"`,
      'Cache-Control': 'private, no-store',
    } });
  }

  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(invoice.invoice_number)}</title><style>body{font-family:Arial,sans-serif;margin:48px;color:#1d1d1b}main{max-width:760px;margin:auto}.actions{display:flex;gap:10px;margin:0 0 28px}.actions button,.actions a{display:inline-flex;min-height:40px;align-items:center;justify-content:center;padding:0 16px;border:1px solid #202020;border-radius:8px;background:#fff;color:#202020;font:600 13px Arial,sans-serif;text-decoration:none;cursor:pointer}.actions button:hover,.actions a:hover{background:#f6f6f6}header,footer{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #ddd;padding-bottom:24px}footer{border-top:1px solid #ddd;border-bottom:0;padding-top:18px;margin-top:22px}h1{margin:0;font-size:30px}p{line-height:1.5;color:#555}table{width:100%;border-collapse:collapse;margin-top:32px}th,td{padding:12px 0;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child{text-align:right}.total{font-size:18px;font-weight:bold}@media print{body{margin:0}.actions{display:none}}@media(max-width:600px){body{margin:20px}.actions{flex-wrap:wrap}header,footer{gap:14px}}</style></head><body><main><nav class="actions" aria-label="Aksi invoice"><button type="button" onclick="window.print()">Cetak / Simpan PDF</button><a href="?download=1">Unduh invoice PDF</a></nav><header><div><h1>INVOICE</h1><p>${escapeHtml(invoice.invoice_number)}<br>Pesanan ${escapeHtml(order.order_number)}</p></div><div><strong>WINA JAYA</strong><p>Diterbitkan ${new Date(invoice.issued_at).toLocaleDateString('id-ID')}</p></div></header><section><h2>Tagihan kepada</h2><p><strong>${escapeHtml(order.customer_name)}</strong><br>${escapeHtml(order.customer_email)}<br>${escapeHtml([address.addressLine, address.cityName, address.provinceName, address.postalCode].filter(Boolean).join(', '))}</p></section><table><thead><tr><th>Produk</th><th>Jumlah</th><th>Nilai</th></tr></thead><tbody>${rows}</tbody></table><footer><span>Subtotal<br>Pengiriman<br><strong>Total</strong></span><span style="text-align:right">${formatRupiah(Number(order.subtotal))}<br>${formatRupiah(Number(order.shipping_cost))}<br><strong class="total">${formatRupiah(Number(order.grand_total))}</strong></span></footer></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } });
}
