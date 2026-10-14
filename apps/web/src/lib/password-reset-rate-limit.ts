import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import {
  hmacPasswordResetRateLimitKey,
  parsePasswordResetRateLimitResult,
  type PasswordResetRateLimitResult,
  type PasswordResetRateLimitScope,
} from './password-reset-rate-limit-core';

type FailureMode = 'open' | 'closed';

type RateLimitRule = {
  scope: PasswordResetRateLimitScope;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

type PasswordResetRateLimitDecision = PasswordResetRateLimitResult & {
  unavailable: boolean;
};

function requestIp(request: Request) {
  const forwarded = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  return forwarded.slice(0, 120);
}

function configuredSecret() {
  const secret = process.env.PASSWORD_RESET_RATE_LIMIT_HMAC_SECRET;
  if (!secret) throw new Error('PASSWORD_RESET_RATE_LIMIT_HMAC_SECRET belum dikonfigurasi.');
  return secret;
}

async function consume(rules: RateLimitRule[], failureMode: FailureMode): Promise<PasswordResetRateLimitDecision> {
  try {
    const secret = configuredSecret();
    const service = createServiceClient();
    let retryAfterSeconds = 1;

    for (const rule of rules) {
      const { data, error } = await service.rpc('consume_password_reset_rate_limit', {
        p_scope: rule.scope,
        p_key_hash: hmacPasswordResetRateLimitKey(secret, rule.scope, rule.identifier),
        p_limit: rule.limit,
        p_window_seconds: rule.windowSeconds,
      });
      const result = error ? null : parsePasswordResetRateLimitResult(data);
      if (!result) throw new Error('Password reset rate limit tidak tersedia.');
      retryAfterSeconds = Math.max(retryAfterSeconds, result.retryAfterSeconds);
      if (!result.allowed) return { ...result, unavailable: false };
    }

    return { allowed: true, retryAfterSeconds, unavailable: false };
  } catch {
    return {
      allowed: failureMode === 'open',
      retryAfterSeconds: 60,
      unavailable: true,
    };
  }
}

export function consumeForgotPasswordRateLimit(request: Request, email: string) {
  return consume([
    { scope: 'forgot_password_ip', identifier: requestIp(request), limit: 5, windowSeconds: 15 * 60 },
    { scope: 'forgot_password_email', identifier: email.trim().toLowerCase(), limit: 3, windowSeconds: 15 * 60 },
  ], 'open');
}

export function consumeResetPasswordRateLimit(request: Request, userId: string) {
  return consume([
    { scope: 'reset_password_ip', identifier: requestIp(request), limit: 5, windowSeconds: 15 * 60 },
    { scope: 'reset_password_user', identifier: userId, limit: 3, windowSeconds: 15 * 60 },
  ], 'closed');
}
