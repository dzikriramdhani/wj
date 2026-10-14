'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicEnv } from './env';

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  const { url, key } = getSupabasePublicEnv();
  browserClient = createBrowserClient(url, key, {
    auth: {
      flowType: 'pkce',
      // The server callback exchanges the recovery code. Pages must never
      // consume a recovery code before that callback has written auth cookies.
      detectSessionInUrl: false,
    },
  });
  return browserClient;
}
