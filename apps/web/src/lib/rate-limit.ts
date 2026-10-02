import 'server-only';

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

function requestIdentity(request: Request) {
  const forwarded = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  return forwarded.slice(0, 120);
}

export function checkRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${requestIdentity(request)}`;
  const previous = windows.get(key);
  const current = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : previous;
  current.count += 1;
  windows.set(key, current);
  return {
    allowed: current.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}
