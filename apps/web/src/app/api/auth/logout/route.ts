import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';

export async function POST() {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: 'Layanan akun belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: 'Gagal mengakhiri sesi.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
