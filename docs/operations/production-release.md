# Production release runbook

This runbook releases the public site only after the PRD production gate is complete. It uses a **dedicated production Supabase project** and **Midtrans production credentials**. DEV and STAGING keep their own databases and sandbox credentials.

## 1. Hosting and Auth

Deploy `apps/web` behind a public HTTPS domain. In the production Supabase project Auth settings, add the production Site URL and redirect URLs for `/auth/callback` and `/reset-password`. Keep DEV and STAGING URLs only in their own projects. Enable email confirmation, custom SMTP, CAPTCHA, suitable Auth rate limits, database SSL enforcement, and database network restrictions.

Bootstrap Super Admin with [first-admin.md](first-admin.md) if not already done. Super Admin must enroll TOTP before using `/super-admin`.

## 2. Environment

Create an ignored `apps/web/.env.production` from `apps/web/.env.example`, or set the same keys in the hosting secret store. Use only production project credentials, a production Midtrans pair, and production shipping configuration:

```env
NEXT_PUBLIC_APP_URL=https://YOUR-DOMAIN
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PRODUCTION-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=true

RAJAONGKIR_API_KEY=
RAJAONGKIR_ORIGIN_ID=
RAJAONGKIR_COURIERS=jne:pos:tiki
SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER=
SHIPPING_PACKAGING_WEIGHT_GRAMS=

CRON_SECRET=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=
EMAIL_ADMIN=

ERP_WEBHOOK_URL=
ERP_WEBHOOK_SECRET=
ADMIN_MFA_REQUIRED=true
```

Leave ERP variables empty until a receiver exists. Set `MIDTRANS_IS_PRODUCTION=true` only with the matched Midtrans production key pair.

## 3. Database

Confirm the dedicated project is selected, then apply the versioned migrations. Do not seed DEV data into production. Import approved catalog records through **Admin → Produk** after the migration is complete.

```powershell
supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF
supabase db push
```

## 4. Validate and deploy

From `apps/web`:

```powershell
npm run preflight:production -- .env.production
npm run build
docker build -t winajaya-web:production .
```

Inject the same secrets at runtime. Point DNS/Cloudflare at the service after HTTPS health checks pass.

## 5. External operations

Set the Midtrans **production** notification URL to `https://YOUR-DOMAIN/api/payments/midtrans/webhook`. The endpoint must be public HTTPS, use the standard port, and return directly without a redirect. Schedule:

| Endpoint | Frequency |
| --- | --- |
| `/api/internal/commerce/expire-reservations` | 5 minutes |
| `/api/internal/email/process` | 2 minutes |
| `/api/internal/operations/process` | 5 minutes |
| `/api/internal/erp/sync` | 5 minutes |

Skip ERP sync until `ERP_WEBHOOK_URL` is set. Configure SMTP, SPF/DKIM/DMARC, and Cloudflare TLS Full (strict) for the public domain.

Run the security, E2E, load, and restore tests in STAGING before releasing. Record the deployment version, migration result, and rollback owner.
