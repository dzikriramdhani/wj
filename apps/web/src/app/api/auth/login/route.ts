import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { loginSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { defaultPortalForRoles, roleNamesFromAssignments } from '@/lib/role-access';

export async function POST(request: Request) {
  const rate = checkRateLimit(request, 'login', 10, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba kembali beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json(
      { error: 'Layanan akun belum dikonfigurasi. Hubungi administrator.' },
      { status: 503 },
    );
  }

  try {
    const input = loginSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(input);

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Email atau password salah.' },
        { status: 401 },
      );
    }

    const { data: assignments } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', data.user.id);
    const roles = roleNamesFromAssignments(assignments);

    return NextResponse.json({
      success: true,
      data: {
        id: data.user.id,
        email: data.user.email,
        roles,
        defaultPortal: defaultPortalForRoles(roles),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Data login tidak valid.' },
        { status: 400 },
      );
    }

    console.error('Supabase login failed:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat login.' },
      { status: 500 },
    );
  }
}
