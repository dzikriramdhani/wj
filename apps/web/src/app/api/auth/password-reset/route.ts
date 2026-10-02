import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';

const emailSchema = z.object({ email: z.email().max(254) }).strict();

export async function POST(request: Request) {
  const rate = checkRateLimit(request, 'password-reset', 3, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json(
    { error: 'Terlalu banyak permintaan. Coba kembali beberapa menit lagi.' },
    { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
  );
  if (!hasSupabasePublicEnv() || !process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'Layanan pemulihan akun belum dikonfigurasi.' }, { status: 503 });
  }
  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Alamat email tidak valid.' }, { status: 400 });

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    });
    return NextResponse.json({ success: true, message: 'Jika alamat email terdaftar, tautan pemulihan telah dikirim.' });
  } catch (error) {
    console.error('password reset request failed', error);
    return NextResponse.json({ error: 'Permintaan belum dapat diproses.' }, { status: 503 });
  }
}
