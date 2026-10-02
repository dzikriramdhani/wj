# Wina Jaya web app

Next.js application for the Wina Jaya storefront. The existing page components and CSS remain the presentation layer; Supabase is the planned source of truth for identity and catalog data.

Use Node.js 22 or newer, as required by the current Supabase JavaScript SDK.

## Local development

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.
2. From the workspace root, apply the versioned migrations to a local Supabase instance with the Supabase CLI. Do not run migrations against production while setting up a developer machine:

   ```bash
   npx supabase start
   npx supabase db reset
   ```
3. Start the application from this directory:

   ```bash
   npm run dev
   ```

Without Supabase configuration, the storefront pages remain available for visual work. Login, registration, account, admin, and catalog API requests report that the service is not configured; no mock credential is accepted.

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

Public catalog reads use the anonymous Data API under RLS. Private business and RFQ files use member-scoped Storage policies, though the upload UI is not implemented yet. Exact inventory, orders, checkout, and payment operations remain unavailable to browser clients until their transactional server-side flows are implemented.

## Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL` are client-visible. `SUPABASE_SECRET_KEY`, payment keys, RajaOngkir keys, SMTP credentials, and email provider keys are server-only. Never use a `NEXT_PUBLIC_` prefix for a secret.
