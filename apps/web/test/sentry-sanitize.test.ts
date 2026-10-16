import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSentryBreadcrumb, sanitizeSentryEvent, sanitizeSentryUrl } from '../src/lib/sentry-sanitize';

test('removes every query parameter from reset and callback URLs', () => {
  assert.equal(
    sanitizeSentryUrl('https://wj-wine.vercel.app/auth/callback?code=secret&next=/reset-password'),
    'https://wj-wine.vercel.app/auth/callback',
  );
});

test('filters reset secrets from a standalone Sentry breadcrumb', () => {
  const breadcrumb = sanitizeSentryBreadcrumb({
    category: 'fetch',
    data: { url: 'https://wj-wine.vercel.app/auth/callback?code=secret', token: 'secret' },
  });

  assert.deepEqual(breadcrumb.data, {
    url: 'https://wj-wine.vercel.app/auth/callback',
    token: '[Filtered]',
  });
});

test('filters secrets from Sentry events and breadcrumbs', () => {
  const event = sanitizeSentryEvent({
    request: {
      url: 'https://wj-wine.vercel.app/reset-password?token_hash=secret',
      headers: { Authorization: 'Bearer secret', Cookie: 'session=secret' },
      data: { password: 'secret' },
    },
    breadcrumbs: [{ message: 'https://wj-wine.vercel.app/auth/callback?code=secret', data: { refresh_token: 'secret' } }],
  });

  assert.deepEqual(event.request, {
    url: 'https://wj-wine.vercel.app/reset-password',
    headers: { Authorization: '[Filtered]', Cookie: '[Filtered]' },
    data: { password: '[Filtered]' },
  });
  assert.deepEqual(event.breadcrumbs, [{
    message: 'https://wj-wine.vercel.app/auth/callback',
    data: { refresh_token: '[Filtered]' },
  }]);
});
