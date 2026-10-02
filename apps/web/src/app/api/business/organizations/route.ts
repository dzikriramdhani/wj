import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
const schema = z.object({ name: z.string().trim().min(2).max(200), legalName: z.string().trim().max(200).optional(), taxId: z.string().trim().max(80).optional(), industry: z.string().trim().max(120).optional(), website: z.string().trim().url().max(300).optional().or(z.literal('')) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Data perusahaan tidak valid.' }, { status: 400 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
  const input = parsed.data; const { data, error } = await supabase.rpc('create_business_organization', { p_name: input.name, p_legal_name: input.legalName ?? '', p_tax_id: input.taxId ?? '', p_industry: input.industry ?? '', p_website: input.website ?? '' });
  return error ? NextResponse.json({ error: error.code === '23505' ? 'NPWP perusahaan sudah terdaftar.' : 'Perusahaan belum dapat dibuat.' }, { status: 400 }) : NextResponse.json({ id: data }, { status: 201 });
}
