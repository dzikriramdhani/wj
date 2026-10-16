import * as Sentry from '@sentry/nextjs';
import { sanitizeSentryBreadcrumb, sanitizeSentryErrorEvent, sanitizeSentryTransactionEvent } from './lib/sentry-sanitize';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? 'development',
  tracesSampleRate: 0,
  beforeSend: sanitizeSentryErrorEvent,
  beforeSendTransaction: sanitizeSentryTransactionEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
});
