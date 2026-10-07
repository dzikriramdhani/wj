import 'server-only';
import * as Sentry from '@sentry/nextjs';
import '../sentry.server.config';

type Operation =
  | 'commerce.expire_reservations'
  | 'operations.process'
  | 'email.process'
  | 'erp.sync'
  | 'payments.midtrans.webhook'
  | 'shipping.quote'
  | 'orders.create';

/** Reports a failure without attaching request bodies or customer data. */
export async function reportServerError(error: unknown, operation: Operation) {
  console.error(`${operation} failed`, error);
  Sentry.withScope((scope) => {
    scope.setTag('operation', operation);
    scope.setLevel('error');
    Sentry.captureException(error);
  });
  // Serverless runtimes can freeze as soon as a route returns. Wait briefly so
  // the error transport can submit the event before the response is sent.
  await Sentry.flush(2_000);
}
