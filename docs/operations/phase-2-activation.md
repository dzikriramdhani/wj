# Phase 2 activation runbook

The Phase 2 application and database workflow are implemented in DEV. Complete these deployment settings before accepting real orders.

## Provider variables

Set these values in the ignored `apps/web/.env` for DEV or the deployment secret store. Restart the Next.js process after changing values.

```env
# Use the supplied matched Sandbox pair in DEV. Key formats can vary by merchant account.
MIDTRANS_SERVER_KEY=REPLACE_WITH_YOUR_SANDBOX_SERVER_KEY
MIDTRANS_CLIENT_KEY=REPLACE_WITH_YOUR_SANDBOX_CLIENT_KEY
MIDTRANS_IS_PRODUCTION=false

# The configured RajaOngkir key is verified for destination search in DEV.
RAJAONGKIR_API_KEY=REPLACE_ME

# Prefer the exact RajaOngkir destination ID for the warehouse. The search
# fallback remains available while this value is empty.
RAJAONGKIR_ORIGIN_ID=
RAJAONGKIR_ORIGIN_SEARCH=Bandung
RAJAONGKIR_COURIERS=jne:pos:tiki
```

DEV and STAGING use `MIDTRANS_IS_PRODUCTION=false` with Sandbox keys. PRODUCTION uses `true` only with the matched live key pair, after the STAGING checkout and webhook evidence is approved.

## Midtrans webhook

In Midtrans, configure the payment notification URL:

```text
https://YOUR-DOMAIN/api/payments/midtrans/webhook
```

The endpoint verifies Midtrans `signature_key`, stores every event in `payment_events`, rejects repeated event fingerprints, and changes order/inventory state only after validation succeeds.

## Reservation expiry scheduler

Call the following endpoint every five minutes from a trusted scheduler. It expires unpaid orders, marks their payments expired, and releases reserved inventory.

```text
POST https://YOUR-DOMAIN/api/internal/commerce/expire-reservations
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` is generated in the local DEV `.env`. Use a different random value for every environment and keep it in the deployment secret store.

## Transactional email scheduler

After SMTP is configured, call this endpoint every two minutes from the same trusted scheduler:

```text
POST https://YOUR-DOMAIN/api/internal/email/process
Authorization: Bearer <CRON_SECRET>
```

The worker claims jobs from `email_outbox`, sends them outside the checkout request, and retries failed jobs with backoff.

## Operational flow

```text
Customer checkout → RajaOngkir quote → atomic order + stock reservation
                 → Midtrans Snap session → verified Midtrans webhook
                 → payment settled → stock committed + invoice + shipment record
                 → admin fulfillment → processing → packed → shipped → delivered
```

The admin order page provides payment reconciliation and the allowed fulfillment transitions. Do not update order, payment, shipment, or inventory tables manually.
