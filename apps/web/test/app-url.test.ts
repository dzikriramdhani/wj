import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConfiguredAppUrl, getConfiguredAppUrl } from '../src/lib/app-url';

test('builds a reset callback from NEXT_PUBLIC_APP_URL only', () => {
  assert.equal(
    buildConfiguredAppUrl('/auth/callback?next=/reset-password', {
      appUrl: 'https://wj-wine.vercel.app',
      nodeEnv: 'production',
    }),
    'https://wj-wine.vercel.app/auth/callback?next=/reset-password',
  );
});

test('rejects an invalid or non-HTTPS production app URL', () => {
  assert.throws(() => getConfiguredAppUrl({ appUrl: 'http://wj-wine.vercel.app', nodeEnv: 'production' }));
  assert.throws(() => getConfiguredAppUrl({ appUrl: 'https://wj-wine.vercel.app/reset-password', nodeEnv: 'production' }));
  assert.throws(() => buildConfiguredAppUrl('//attacker.example', { appUrl: 'https://wj-wine.vercel.app', nodeEnv: 'production' }));
});
