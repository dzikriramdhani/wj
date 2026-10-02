# Production cutover

This cutover serves the public domain from the **dedicated production Supabase project** with **Midtrans production** and approved RajaOngkir configuration. Follow `production-release.md` only after STAGING evidence is recorded.

## 1. Secrets and Auth

Keep a production-only secret store for this deployment. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS origin. In the production Supabase Auth settings, add that origin as Site URL and redirect target for `/auth/callback` and password recovery. Do not use a DEV or STAGING database.

## 2. Cloudflare

Proxy the application hostname with TLS **Full (strict)**. Cache public assets only. Suggested rate limits:

| Path | Suggested policy |
| --- | --- |
| `/api/auth/login` | 10 requests / 15 minutes / IP |
| `/api/auth/register` | 5 requests / 15 minutes / IP |
| `/api/auth/password-reset` | 3 requests / 15 minutes / IP |
| `/api/orders`, `/api/payments/midtrans` | 10 requests / 15 minutes / IP |
| `/api/rfq`, `/api/contact` | 5–10 requests / hour / IP |
| `/admin/*` | Managed challenge; do not cache |

## 3. Email

Configure custom SMTP in Supabase Auth and application `SMTP_*` / `EMAIL_FROM` / `EMAIL_ADMIN`. Publish SPF, DKIM, and DMARC before relying on outbound mail.

## 4. Scheduled operations

Call these endpoints with `Authorization: Bearer <CRON_SECRET>`:

| Endpoint | Frequency |
| --- | --- |
| `/api/internal/commerce/expire-reservations` | every 5 minutes |
| `/api/internal/email/process` | every 2 minutes |
| `/api/internal/operations/process` | every 5 minutes |
| `/api/internal/erp/sync` | every 5 minutes |

Point Midtrans production notifications at `https://YOUR-DOMAIN/api/payments/midtrans/webhook`.

## 5. Release gate

`npm run preflight:production -- .env.production` must pass without failures. Complete the approved STAGING checkout, webhook, fulfillment, recovery, security, E2E, and load test evidence before DNS cutover. Run one controlled production payment and shipment after cutover, then monitor the defined alerts.
