import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { getCurrentPlatformAccess } from '@/lib/role-access';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const requestedPath = request.nextUrl.searchParams.get('next');

  if (!hasSupabasePublicEnv() || !appUrl || !code) {
    return NextResponse.redirect(new URL('/login?error=verification', appUrl ?? request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=verification', appUrl));
  }

  const access = await getCurrentPlatformAccess();
  const nextPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : access.defaultPortal;

  return NextResponse.redirect(new URL(nextPath, appUrl));
}
