import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin-auth';

const createSchema = z.object({ rfqId: z.string().uuid(), paymentTerms: z.string().max(2000), validUntil: z.string().datetime(), items: z.array(z.object({ rfqItemId: z.string().uuid().optional(), description: z.string().trim().min(1).max(1000), quantity: z.number().positive(), unitPrice: z.number().min(0) })).min(1).max(50) });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
  const { data, error } = await supabase.from('quotations').select('id,rfq_id,revision,status,payment_terms,valid_until,created_at,quotation_items(id,description,quantity,unit_price,line_total),quotation_messages(id,body,created_at,author_user_id),bulk_orders(id,bulk_order_number,status,total_amount)').order('created_at', { ascending: false }).limit(100);
  return error ? NextResponse.json({ error: 'Quotation belum dapat dimuat.' }, { status: 400 }) : NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  if (!await requireAdminUser()) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Data quotation tidak valid.' }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await (await createClient()).rpc('create_b2b_quotation', { p_rfq_id: input.rfqId, p_payment_terms: input.paymentTerms, p_valid_until: input.validUntil, p_items: input.items });
  return error ? NextResponse.json({ error: 'Quotation belum dapat dibuat.' }, { status: 400 }) : NextResponse.json({ id: data }, { status: 201 });
}
