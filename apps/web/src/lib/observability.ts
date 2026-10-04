import 'server-only';
import * as Sentry from '@sentry/nextjs';

type Operation =
  | 'commerce.expire_reservations'
  | 'operations.process'
  | 'email.process'
  | 'erp.sync'
  | 'payments.midtrans.webhook'
  | 'shipping.quote'
  | 'orders.create';

/** Reports a failure without attaching request bodies or customer data. */
export function reportServerError(error: unknown, operation: Operation) {
  console.error(`${operation} failed`, error);
  Sentry.withScope((scope) => {
    scope.setTag('operation', operation);
    scope.setLevel('error');
    Sentry.captureException(error);
  });
}
