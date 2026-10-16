import { createHmac } from 'node:crypto';

export type PasswordResetRateLimitScope =
  | 'forgot_password_ip'
  | 'forgot_password_email'
  | 'reset_password_ip'
  | 'reset_password_user';

export type PasswordResetRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function hmacPasswordResetRateLimitKey(
  secret: string,
  scope: PasswordResetRateLimitScope,
  identifier: string,
) {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('PASSWORD_RESET_RATE_LIMIT_HMAC_SECRET tidak valid.');
  }

  return createHmac('sha256', secret)
    .update(`${scope}\u0000${identifier}`, 'utf8')
    .digest('hex');
}

export function parsePasswordResetRateLimitResult(value: unknown): PasswordResetRateLimitResult | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;

  const candidate = row as Record<string, unknown>;
  if (typeof candidate.allowed !== 'boolean' || typeof candidate.retry_after_seconds !== 'number') {
    return null;
  }

  return {
    allowed: candidate.allowed,
    retryAfterSeconds: Math.max(1, Math.ceil(candidate.retry_after_seconds)),
  };
}
