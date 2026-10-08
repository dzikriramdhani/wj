import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const presented = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return Boolean(secret && presented.length === secret.length
    && timingSafeEqual(Buffer.from(presented), Buffer.from(secret)));
}

/** Scheduler-only credential for the reservation and operations workers.
 * Production must provide this dedicated secret. DEV/STAGING can keep using
 * CRON_SECRET until their scheduler credentials are migrated independently.
 */
export function isSchedulerAuthorized(request: Request) {
  const secret = process.env.SCHEDULER_CRON_SECRET
    ?? (process.env.VERCEL_ENV === 'production' ? undefined : process.env.CRON_SECRET);
  const presented = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return Boolean(secret && presented.length === secret.length
    && timingSafeEqual(Buffer.from(presented), Buffer.from(secret)));
}
