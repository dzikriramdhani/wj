# Staging activation

**Supabase project:** `winajaya_staging` (`aqfllncygivcvsacbfpi`)

## Completed

- The workspace is linked to `winajaya_staging`.
- Migration `202609290001` through `202609300025` are applied.
- The database is empty and has not received DEV account, order, or catalog data.
- Supabase, Midtrans Sandbox, RajaOngkir API, and SMTP configuration have been supplied; connection to Supabase STAGING has been verified.
- `npm run lint` and `npm run build` pass after adding the STAGING preflight.

## Configure the application

1. Copy `apps/web/.env.staging.example` to the ignored `apps/web/.env.staging`, or configure the same values in the STAGING host secret store. Keep secrets out of `.env.staging.example`; it is a tracked template.
2. Obtain the STAGING publishable and secret keys from the Supabase project. Do not use keys from DEV or PRODUCTION.
3. Configure a public HTTPS STAGING domain and use it for `NEXT_PUBLIC_APP_URL`.
4. Add the STAGING Site URL and redirect URLs for `/auth/callback` and `/reset-password` in STAGING Supabase Auth.
5. Configure Midtrans Sandbox notification URL as `https://staging.YOUR-DOMAIN/api/payments/midtrans/webhook`.
6. Configure SMTP, `CRON_SECRET`, RajaOngkir origin/couriers, and measured test product weights.
7. Enable TOTP MFA and create separate STAGING test accounts for `user`, `admin`, and `super_admin`.
8. Run `npm run preflight:staging -- .env.staging` before deploying.

## Required staging evidence

- Cross-user and cross-organization RLS checks.
- Register, login, product, cart, checkout, Midtrans Sandbox webhook, invoice, fulfillment, and reservation expiry.
- B2B organization, RFQ, quotation revision, approval, and bulk order.
- Email worker and operations worker schedule.
- Restore test, security test, E2E test, and load test recorded in the release evidence.

Do not point the production domain or Midtrans production webhook at this environment.

## Status konfigurasi saat ini

- RajaOngkir Search Domestic Destination memverifikasi origin ID `5190` untuk Cijagra, Paseh, Kabupaten Bandung, Jawa Barat 40383. ID ini sudah digunakan pada konfigurasi STAGING dan bukan kode pos.
- Preflight STAGING lulus dengan konfigurasi yang telah diisi, termasuk bobot, `CRON_SECRET`, Supabase, Midtrans Sandbox, RajaOngkir, dan SMTP.
- Sebelum deployment, pindahkan seluruh secret dari `.env.staging.example` ke `.env.staging` yang diabaikan Git atau ke secret store hosting. Kembalikan `.env.staging.example` menjadi template tanpa nilai rahasia.
- Deployment, Auth redirect URL, notification URL Midtrans, scheduler, MFA akun uji, serta bukti pengujian STAGING masih harus dilakukan pada domain STAGING yang benar.
