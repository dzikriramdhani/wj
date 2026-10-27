import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabasePublicEnv, hasSupabasePublicEnv } from '@/lib/supabase/env';

/**
 * Consumes the one-time recovery token embedded in the Supabase email.
 *
 * This intentionally uses token_hash rather than PKCE. Email clients often
 * open a link outside the browser that requested it, where the PKCE verifier
 * does not exist. Supabase writes the recovered session into HTTP-only
 * cookies, then redirects to the ordinary reset form.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const resetUrl = new URL('/reset-password', request.url);
  const invalidUrl = new URL('/forgot-password?error=invalid-recovery-link', request.url);

  if (!hasSupabasePublicEnv() || !tokenHash || type !== 'recovery') {
    return NextResponse.redirect(invalidUrl);
  }

  const response = NextResponse.redirect(resetUrl);
  const { url, key } = getSupabasePublicEnv();
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  });

  return error ? NextResponse.redirect(invalidUrl) : response;
}
