import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { registerSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const rate = checkRateLimit(request, 'register', 5, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba kembali beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json(
      { error: 'Layanan akun belum dikonfigurasi. Hubungi administrator.' },
      { status: 503 },
    );
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json(
      { error: 'URL aplikasi belum dikonfigurasi untuk verifikasi email.' },
      { status: 503 },
    );
  }

  try {
    const input = registerSchema.parse(await request.json());
    const supabase = await createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/+$/, '');
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.name, phone: input.phone ?? null },
        emailRedirectTo: `${appUrl}/auth/callback?next=/account`,
      },
    });

    if (error) {
      const duplicate = /already registered|already exists/i.test(error.message);
      return NextResponse.json(
        { error: duplicate ? 'Email sudah terdaftar.' : 'Pendaftaran belum dapat diproses. Periksa data lalu coba kembali.' },
        { status: duplicate ? 409 : 400 },
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Akun belum dapat dibuat. Silakan coba kembali.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: data.session
          ? 'Pendaftaran berhasil. Akun Anda sudah dapat digunakan.'
          : 'Pendaftaran berhasil. Periksa email Anda untuk verifikasi akun.',
        data: { id: data.user.id, email: data.user.email },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Data pendaftaran tidak valid.' },
        { status: 400 },
      );
    }

    console.error('Supabase registration failed:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendaftarkan akun.' },
      { status: 500 },
    );
  }
}
