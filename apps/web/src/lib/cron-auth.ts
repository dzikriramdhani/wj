import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const presented = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return Boolean(secret && presented.length === secret.length
    && timingSafeEqual(Buffer.from(presented), Buffer.from(secret)));
}
