import assert from 'node:assert/strict';
import test from 'node:test';
import { hmacPasswordResetRateLimitKey, parsePasswordResetRateLimitResult } from '../src/lib/password-reset-rate-limit-core';

test('rate-limit identifiers are scope-bound HMAC digests', () => {
  const secret = '01234567890123456789012345678901';
  const emailDigest = hmacPasswordResetRateLimitKey(secret, 'forgot_password_email', 'customer@example.com');
  const ipDigest = hmacPasswordResetRateLimitKey(secret, 'forgot_password_ip', '203.0.113.42');

  assert.match(emailDigest, /^[a-f0-9]{64}$/);
  assert.notEqual(emailDigest, ipDigest);
  assert.throws(() => hmacPasswordResetRateLimitKey('too-short', 'forgot_password_email', 'customer@example.com'));
});

test('accepts only valid RPC rate-limit responses', () => {
  assert.deepEqual(parsePasswordResetRateLimitResult([{ allowed: false, retry_after_seconds: 42.2 }]), {
    allowed: false,
    retryAfterSeconds: 43,
  });
  assert.equal(parsePasswordResetRateLimitResult([{ allowed: 'false', retry_after_seconds: 10 }]), null);
  assert.equal(parsePasswordResetRateLimitResult([]), null);
});
