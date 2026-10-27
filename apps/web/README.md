# Wina Jaya web app

Next.js application for the Wina Jaya storefront. The existing page components and CSS remain the presentation layer; Supabase is the planned source of truth for identity and catalog data.

Use Node.js 22 or newer, as required by the current Supabase JavaScript SDK.

## Local development

For isolated QA, follow [`docs/qa/local-test-environment.md`](../../docs/qa/local-test-environment.md). Never copy production Supabase credentials into local environment files. Do not overwrite an existing `.env.local` without first verifying its target.

1. Use a dedicated local checkout whose Supabase CLI metadata is not linked to a remote project.
2. Verify Docker, ports, and any existing local volumes before starting the stack. Run this from the workspace root only after those checks:

   ```bash
   supabase start
   ```

   `supabase start` applies the local migrations (and configured seed). It can change existing local database state. Do not run `supabase db reset`; it deletes local database state. QA integration tests require `npm run qa:db:guard` to pass before the runner starts.
3. Start the application from this directory only after verifying every loaded Supabase URL and key is local:

   ```bash
   npm run dev
   ```

Without Supabase configuration, the storefront pages remain available for visual work. Login, registration, account, admin, and catalog API requests report that the service is not configured; no mock credential is accepted.

Production-authorized QA uses a separate fail-closed runner and never reads `.env.local`. Review [`docs/qa/production-qa.md`](../../docs/qa/production-qa.md) before running `npm run qa:production:preflight`. The mutation command has no fixture adapter and currently stops without making a request or write.

## Supabase layout

Database configuration and migrations live in the workspace-level `../../supabase` directory. The application clients live in `src/lib/supabase`:

- `client.ts` — browser client using the publishable key.
- `server.ts` — request-scoped server client using the signed-in user's cookies and RLS.
- `public.ts` — cookie-free anonymous client for cacheable public catalog reads.
- `proxy.ts` — refreshes verified Auth claims for protected routes using the Next.js 16 `src/proxy.ts` entry point.
- `catalog.ts` — maps public catalog rows to the existing storefront data shape.

Apply migrations through Supabase CLI from the workspace root, after linking the intended DEV or STAGING project. Review each migration before applying it to production. The initial migrations establish Auth profiles, roles, tenant membership, catalog tables, and RLS. They do not provision production projects or create an administrator account.

`../../supabase/seed/00_catalog_dev.sql` contains synthetic catalog data for local visual development only. It is not automatically run and must never be applied to STAGING or PROD.

## Auth and access

Supabase Auth owns credentials and sessions. A database trigger creates the profile and default customer role after signup. The browser never receives the Supabase secret key. The account route requires a verified Supabase user; the admin route additionally checks the user's role assignment in the database. Grant the first administrator role through a controlled operator process after the account has been created; never expose role assignment to the public registration form.

Set the Supabase Auth Site URL and allowed Redirect URLs for every environment, including `<NEXT_PUBLIC_APP_URL>/auth/callback`. Email verification uses the PKCE callback route and then returns the user to `/account`.

Public catalog reads use the anonymous Data API under RLS. Private business and RFQ files use member-scoped Storage policies, and upload controls are available for business verification documents and RFQ attachments. Browser clients cannot write inventory, order, checkout, or payment tables directly; transactional changes go through server-side flows and database functions.

## Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL` are client-visible. `SUPABASE_SECRET_KEY`, payment keys, RajaOngkir keys, SMTP credentials, and email provider keys are server-only. Never use a `NEXT_PUBLIC_` prefix for a secret.

Error tracking uses Sentry when `SENTRY_DSN` is set. Set the same DSN as `NEXT_PUBLIC_SENTRY_DSN` when browser error capture is required, then set `SENTRY_ENVIRONMENT` and `NEXT_PUBLIC_SENTRY_ENVIRONMENT` to `staging` or `production`. The integration captures errors only; request bodies, payment payloads, credentials, and customer identifiers are not attached by application code.
