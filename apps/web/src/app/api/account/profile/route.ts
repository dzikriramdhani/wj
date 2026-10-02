import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(32).nullable().optional(),
}).strict();

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Silakan masuk untuk memakai data akun.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name,phone')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    data: {
      fullName: profile?.full_name ?? String(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? ''),
      email: user.email ?? '',
      phone: profile?.phone ?? String(user.user_metadata?.phone ?? ''),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(request: Request) {
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data profil tidak valid.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Masuk ke akun terlebih dahulu.' }, { status: 401 });
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq('id', user.id);
  if (error) {
    console.error('profile update failed', error);
    return NextResponse.json({ error: 'Profil belum dapat diperbarui.' }, { status: 503 });
  }
  return NextResponse.json({ success: true });
}
