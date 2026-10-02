import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin-auth';
const actionSchema = z.discriminatedUnion('action', [z.object({ action: z.literal('send') }), z.object({ action: z.literal('respond'), decision: z.enum(['accepted', 'rejected']), note: z.string().max(2000).optional() }), z.object({ action: z.literal('message'), body: z.string().trim().min(1).max(4000) })]);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'ID quotation tidak valid.' }, { status: 400 });
  const parsed = actionSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Aksi quotation tidak valid.' }, { status: 400 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
  let error: { code?: string } | null = null; let data: unknown = null;
  if (parsed.data.action === 'send') { if (!await requireAdminUser()) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 }); ({ error } = await supabase.rpc('send_b2b_quotation', { p_quotation_id: id })); }
  if (parsed.data.action === 'respond') ({ data, error } = await supabase.rpc('respond_to_b2b_quotation', { p_quotation_id: id, p_decision: parsed.data.decision, p_note: parsed.data.note ?? '' }));
  if (parsed.data.action === 'message') ({ error } = await supabase.rpc('add_b2b_quotation_message', { p_quotation_id: id, p_body: parsed.data.body }));
  return error ? NextResponse.json({ error: 'Aksi quotation belum dapat diproses.' }, { status: error.code === '42501' ? 403 : 400 }) : NextResponse.json({ success: true, bulkOrderId: data });
}
