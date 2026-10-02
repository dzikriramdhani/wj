import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin-auth';
const submitSchema = z.object({ organizationId: z.string().uuid(), documents: z.array(z.object({ name: z.string().min(1).max(200), path: z.string().min(1).max(500) })).min(1).max(10), industry: z.string().max(120).optional(), website: z.string().url().max(300).optional().or(z.literal('')) });
const reviewSchema = z.object({ organizationId: z.string().uuid(), decision: z.enum(['verified', 'rejected']), notes: z.string().max(2000).optional() });
export async function POST(request: Request) {
  const parsed = submitSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Dokumen verifikasi tidak valid.' }, { status: 400 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
  const input = parsed.data; const { error } = await supabase.rpc('submit_business_verification', { p_organization_id: input.organizationId, p_documents: input.documents, p_industry: input.industry ?? '', p_website: input.website ?? '' });
  return error ? NextResponse.json({ error: 'Permohonan verifikasi belum dapat dikirim.' }, { status: error.code === '42501' ? 403 : 400 }) : NextResponse.json({ success: true });
}
export async function PATCH(request: Request) {
  if (!await requireAdminUser()) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 });
  const parsed = reviewSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Keputusan verifikasi tidak valid.' }, { status: 400 });
  const { error } = await (await createClient()).rpc('review_business_verification', { p_organization_id: parsed.data.organizationId, p_decision: parsed.data.decision, p_notes: parsed.data.notes ?? '' });
  return error ? NextResponse.json({ error: 'Verifikasi belum dapat diperbarui.' }, { status: error.code === 'P0002' ? 404 : 400 }) : NextResponse.json({ success: true });
}
