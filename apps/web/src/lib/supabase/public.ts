import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from './env';

// Anonymous catalog reads use the publishable key and database RLS. Keeping
// this client cookie-free makes public catalog responses safe to cache.
export function createPublicClient() {
  const { url, key } = getSupabasePublicEnv();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
