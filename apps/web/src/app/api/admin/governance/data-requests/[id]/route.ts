import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
const schema = z.object({ status: z.enum(['in_review', 'completed', 'rejected']), resolutionNote: z.string().max(2000).optional() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: 'Akses Admin dengan MFA diperlukan.' }, { status: 403 });
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'ID permintaan tidak valid.' }, { status: 400 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
  const { error } = await (await createClient()).rpc('review_data_subject_request', { p_request_id: id, p_status: parsed.data.status, p_resolution_note: parsed.data.resolutionNote ?? '' });
  return error ? NextResponse.json({ error: 'Permintaan belum dapat diperbarui.' }, { status: error.code === '42501' ? 403 : 400 }) : NextResponse.json({ success: true });
}
