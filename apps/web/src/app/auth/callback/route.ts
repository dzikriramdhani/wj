import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { getSupabasePublicEnv } from '@/lib/supabase/env';
import { defaultPortalForRoles, roleNamesFromAssignments } from '@/lib/role-access';
import { buildConfiguredAppUrl, getAllowedAuthCallbackPath } from '@/lib/app-url';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedPath = request.nextUrl.searchParams.get('next');

  let response: NextResponse;
  try {
    response = NextResponse.redirect(buildConfiguredAppUrl('/login?error=verification'));
  } catch {
    return new NextResponse(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!hasSupabasePublicEnv() || !code) return response;

  const { url, key } = getSupabasePublicEnv();
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return response;

  // Recovery must land on the form with the exchanged auth cookies attached
  // to this exact redirect response. Avoid extra role/session lookups here.
  let nextPath = getAllowedAuthCallbackPath(requestedPath);

  if (nextPath !== '/reset-password') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: assignments } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id);
      nextPath = defaultPortalForRoles(roleNamesFromAssignments(assignments));
    }
  }

  response.headers.set('Location', buildConfiguredAppUrl(nextPath));
  return response;
}
