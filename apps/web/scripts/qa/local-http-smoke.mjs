import assert from 'node:assert/strict';

const target = process.env.QA_LOCAL_APP_URL;
if (process.env.QA_LOCAL_APP_MARKER !== 'local') {
  throw new Error('Set QA_LOCAL_APP_MARKER=local to confirm a local-only smoke run.');
}
if (!target) throw new Error('Set QA_LOCAL_APP_URL to the local standalone app URL.');

const base = new URL(target);
if (
  base.protocol !== 'http:' ||
  base.hostname !== '127.0.0.1' ||
  base.port !== '3100' ||
  base.username ||
  base.password ||
  base.pathname !== '/' ||
  base.search ||
  base.hash
) {
  throw new Error('Local smoke accepts only http://127.0.0.1:3100/.');
}

const checks = [
  { path: '/api/account/profile', status: 401, private: true },
  { path: '/api/admin/search?q=qa-cache-check', status: 403, private: true },
  { path: '/api/super-admin/content/home', status: 403, private: true },
  { path: '/api/orders/00000000-0000-4000-8000-000000000000', status: 401, private: true },
  { path: '/admin', status: 307, redirect: '/login?' },
  { path: '/super-admin', status: 307, redirect: '/login?' },
];

for (const check of checks) {
  const response = await fetch(new URL(check.path, base), {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });
  assert.equal(response.status, check.status, `${check.path} status`);

  if (check.private) {
    assert.equal(response.headers.get('cache-control'), 'private, no-store', `${check.path} cache policy`);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['error'], `${check.path} response fields`);
  }

  if (check.redirect) {
    assert.ok(response.headers.get('location')?.startsWith(check.redirect), `${check.path} redirect`);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/, `${check.path} cache policy`);
  }

  console.log(`PASS GET ${check.path} → ${response.status}`);
}

console.log(`PASS ${checks.length} local unauthenticated route checks`);
