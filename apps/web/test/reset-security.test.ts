import assert from 'node:assert/strict';
import test from 'node:test';
import { resetSecurityHeaders, resetSecurityPaths } from '../src/lib/reset-security';

test('uses no-referrer and no-store only for reset routes', () => {
  assert.deepEqual(resetSecurityPaths, ['/forgot-password', '/reset-password', '/auth/callback']);
  assert.deepEqual(resetSecurityHeaders, [
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'Cache-Control', value: 'no-store' },
  ]);
});
