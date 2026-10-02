import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  if (!await requireAdminUser()) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 });
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return NextResponse.json({ data: [] });
  const service = createServiceClient(); const pattern = `%${query.replace(/[%_,]/g, '')}%`;
  const [{ data: products }, { data: organizations }, { data: rfqs }] = await Promise.all([
    service.from('products').select('id,name,sku').or(`name.ilike.${pattern},sku.ilike.${pattern}`).limit(8),
    service.from('organizations').select('id,name,status').ilike('name', pattern).limit(8),
    service.from('rfqs').select('id,status').eq('id', query).limit(1),
  ]);
  return NextResponse.json({ data: [...(products ?? []).map((item) => ({ type: 'product', id: item.id, label: `${item.name} · ${item.sku}`, href: '/admin/products' })), ...(organizations ?? []).map((item) => ({ type: 'organization', id: item.id, label: `${item.name} · ${item.status}`, href: '/admin/operations' })), ...(rfqs ?? []).map((item) => ({ type: 'rfq', id: item.id, label: `RFQ ${item.id} · ${item.status}`, href: '/admin/rfq' }))] });
}
