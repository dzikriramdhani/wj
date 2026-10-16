import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { consumeForgotPasswordRateLimit } from '@/lib/password-reset-rate-limit';

const emailSchema = z.object({ email: z.email().max(254) }).strict();

export async function POST(request: NextRequest) {
  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Alamat email tidak valid.' }, { status: 400 });

  // The guard intentionally has no user lookup. That keeps its response equal for
  // registered and unregistered email addresses. Storage failure is fail-open here
  // so an outage cannot prevent an account-recovery email from being requested.
  const rate = await consumeForgotPasswordRateLimit(request, parsed.data.email);
  if (!rate.allowed) return NextResponse.json(
    { error: 'Terlalu banyak permintaan. Coba kembali beberapa menit lagi.' },
    { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
  );

  // Supabase resetPasswordForEmail must run in the browser so its PKCE
  // verifier is stored in the same browser that later exchanges the email code.
  return NextResponse.json({ success: true });
}
