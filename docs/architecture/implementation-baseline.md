# Wina Jaya implementation baseline

The production baseline is the latest root `PRD.md`.

## Current workspace mapping

- `apps/web/` contains the existing Next.js storefront and its original page/CSS layout.
- `apps/web/src/lib/supabase/` contains browser, server, session-refresh, and catalog integration code.
- `supabase/` at the workspace root contains the Supabase CLI configuration and ordered SQL migrations.
- `apps/web/.env.example` lists the application variables; local secrets belong in an ignored `.env.local` file.

The existing Next.js application is organized at `apps/web/`, matching the PRD's web application boundary, while preserving its original page components and styles. Database migrations are at the workspace root, matching the PRD's top-level `supabase/` boundary. Production must use a dedicated Supabase project, a dedicated secret store, and Midtrans production credentials. Apply migrations 001–025 to STAGING first, then to the dedicated production project through the versioned migration workflow. Provider webhook URL, custom SMTP, Cloudflare policies, monitoring, and scheduled workers must be configured before public deployment.

## Security boundaries

- The browser receives only the Supabase URL and publishable key.
- Supabase Auth sessions are cookie-based and verified before protected account/admin pages render.
- Database grants and RLS both restrict access. Browser clients cannot assign roles, mutate catalog records, read inventory, or write audit events.
- Admin access comes from a database role assignment, never user-editable metadata.
- Public product APIs read active/published catalog rows through RLS and return availability only; an authenticated admin-only RPC returns stock for the existing admin inventory view.
- Payment, shipping, SMTP, and Supabase secret keys stay server-side and are not configured in the browser.
