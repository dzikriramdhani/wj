import { NextRequest } from 'next/server';
import { privateJsonResponse as NextResponse } from '@/lib/api-response';
import { z } from 'zod';
import { consumeResetPasswordRateLimit } from '@/lib/password-reset-rate-limit';
import { validateResetPassword } from '@/lib/reset-password';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

const inputSchema = z.object({
  password: z.string().max(128),
  confirmation: z.string().max(128),
}).strict();

function recoveryFailure() {
  return NextResponse.json(
    { error: 'Sesi pemulihan tidak valid atau telah berakhir. Minta tautan reset baru.' },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Data password tidak valid.' }, { status: 400 });

  const passwordError = validateResetPassword(input.data.password, input.data.confirmation);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return recoveryFailure();

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')) {
    return NextResponse.json(
      { error: 'Verifikasi MFA diperlukan sebelum password dapat diubah.', code: 'mfa_required' },
      { status: 403 },
    );
  }

  // Unlike the request-email guard, an unavailable rate-limit store blocks password
  // changes. This keeps the sensitive completion endpoint fail-closed.
  const rate = await consumeResetPasswordRateLimit(request, user.id);
  if (!rate.allowed) {
    const status = rate.unavailable ? 503 : 429;
    return NextResponse.json(
      { error: rate.unavailable ? 'Layanan keamanan belum tersedia. Coba kembali.' : 'Terlalu banyak percobaan. Coba kembali beberapa menit lagi.' },
      { status, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: input.data.password });
  if (updateError) {
    const code = 'code' in updateError && typeof updateError.code === 'string' ? updateError.code : '';
    if (code === 'same_password' || updateError.message.toLowerCase().includes('different from the old password')) {
      return NextResponse.json({ error: 'Password baru harus berbeda dari password yang sedang digunakan.' }, { status: 400 });
    }
    return recoveryFailure();
  }

  // Supabase global sign-out revokes refresh/remember-me sessions for this user. The
  // browser also clears its local session after receiving this response.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  if (signOutError) {
    return NextResponse.json({ error: 'Password diperbarui, tetapi sesi belum dapat dicabut. Hubungi administrator.' }, { status: 503 });
  }

  try {
    const service = createServiceClient();
    await service.from('email_outbox').insert({
      dedupe_key: `password.changed:${user.id}:${crypto.randomUUID()}`,
      recipient_email: user.email ?? '',
      template_key: 'account.password_changed',
      payload: {},
    });
  } catch {
    // Notification delivery never carries password data and does not reverse a completed reset.
  }

  return NextResponse.json({ success: true });
}
