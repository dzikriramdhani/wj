import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/account/:path*', '/admin/:path*', '/sales/:path*', '/finance/:path*', '/warehouse/:path*', '/content/:path*', '/super-admin/:path*', '/business/:path*', '/orders/:path*'],
};
