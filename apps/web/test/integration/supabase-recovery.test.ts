import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const testUrl = process.env.TEST_SUPABASE_URL;
const testSecret = process.env.TEST_SUPABASE_SECRET_KEY;
const enabled = process.env.TEST_SUPABASE_ALLOW_INTEGRATION === 'true' && Boolean(testUrl && testSecret);

function assertIsolatedTestConfiguration() {
  if (!testUrl || !testSecret) throw new Error('Environment TEST_SUPABASE_URL dan TEST_SUPABASE_SECRET_KEY wajib diisi.');
  if (testUrl === process.env.NEXT_PUBLIC_SUPABASE_URL || testSecret === process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Integration test menolak kredensial Supabase aplikasi. Gunakan project test terpisah.');
  }
}

test('Supabase rate-limit RPC is atomic in an isolated TEST_ project', { skip: !enabled }, async () => {
  assertIsolatedTestConfiguration();
  const supabase = createClient(testUrl!, testSecret!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const keyHash = createHash('sha256').update(`password-reset-rate-limit-test:${randomUUID()}`).digest('hex');
  const input = {
    p_scope: 'forgot_password_email',
    p_key_hash: keyHash,
    p_limit: 1,
    p_window_seconds: 60,
  };

  const [first, second] = await Promise.all([
    supabase.rpc('consume_password_reset_rate_limit', input),
    supabase.rpc('consume_password_reset_rate_limit', input),
  ]);
  assert.equal(first.error, null);
  assert.equal(second.error, null);

  const outcomes = [first.data?.[0]?.allowed, second.data?.[0]?.allowed].sort();
  assert.deepEqual(outcomes, [false, true]);
});
