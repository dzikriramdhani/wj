import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
const schema = z.object({ requestType: z.enum(['access', 'export', 'erasure']), note: z.string().max(2000).optional() });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Permintaan privasi tidak valid.' }, { status: 400 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
  const { data, error } = await supabase.rpc('create_data_subject_request', { p_request_type: parsed.data.requestType, p_note: parsed.data.note ?? '' });
  return error ? NextResponse.json({ error: error.code === '23505' ? 'Permintaan sejenis masih diproses.' : 'Permintaan belum dapat dikirim.' }, { status: 400 }) : NextResponse.json({ id: data }, { status: 201 });
}
