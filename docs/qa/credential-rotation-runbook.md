# Credential Incident Rotation Runbook

Status: **BLOCKED pending provider operators**. This document contains names, scopes, and actions only. Never place credential values, tokens, connection strings, screenshots, or environment dumps here.

## Common sequence

1. Record the exposure interval and provider key identifier/fingerprint in the approved incident system.
2. Confirm a rollback owner and a non-mutating verification for every consumer.
3. Create the replacement in the provider, update the runtime secret store, and deploy the consumer.
4. Verify the replacement without processing customer data, payments, email, or worker queues.
5. Revoke the old credential only after the replacement and provider audit logs are confirmed.
6. Retain provider audit logs outside this repository. Sanitizing source or scanning Git history is not revocation evidence.

## Known consumers and actions

| Category | Known consumer | Required official access | Replacement and safe verification | Recovery |
| --- | --- | --- | --- | --- |
| GitHub staging scheduler credentials | `STAGING_APP_URL`, `STAGING_CRON_SECRET` in `staging-workers.yml` | Repository Actions-secret write, staging runtime secret update, Actions logs | Replace both values in their official stores; verify a POST-only staging health or purpose-built dry-run that cannot process records. | Restore prior secret-store version if the staging smoke fails. |
| GitHub Production scheduler credential | `SCHEDULER_CRON_SECRET` in production worker and email-outbox workflows | Production-environment secret write, Vercel/runtime secret write, deployment rollback, logs | Stage replacement in Vercel/runtime and GitHub Production; verify a dedicated non-mutating authorization probe before the next approved scheduler window. Existing workers must not be used as a smoke test. | Roll back secret-store version before revoking old credential. |
| Supabase service credential | `SUPABASE_SECRET_KEY` server client | Supabase project admin, Vercel secret update, audit logs | Generate least-privilege replacement through Supabase; deploy updated runtime; use a read-only health check with no customer data; revoke old key and inspect audit logs. Service access is not RLS proof. | Restore verified prior runtime secret only if new key fails before revocation. |
| Supabase publishable credential | Browser Supabase client | Supabase project admin and Vercel deployment access | Rotate only if incident inventory confirms the key was in scope; deploy and verify anonymous public health/catalog behavior. | Restore prior published configuration if deployment smoke fails. |
| Midtrans server credential | Payment initiation, QR, webhook verification, reconciliation | Merchant admin, sandbox, Vercel update, payment audit logs | Rotate in sandbox; verify synthetic signature and idempotency only; cut over runtime; revoke old credential after logs confirm. | Restore prior runtime version; never use a real payment/refund to smoke-test. |
| SMTP credential | Email outbox worker | Mail-provider admin, Vercel update, mail audit logs, sink/test inbox | Use scoped replacement and a controlled sink/test inbox; do not call production outbox. | Restore prior runtime secret if controlled delivery fails. |
| Shipping/ERP credentials | Quote, webhook, ERP flows | Provider admin, sandbox, Vercel update, audit logs | Rotate in sandbox first, validate synthetic signature/quote, then cut over. | Use provider rollback/version facility. |
| Password-reset HMAC secret | Reset rate-limit hashes | Vercel secret update and versioned rollout plan | Implement/version dual-read behavior before rotation if active windows must survive; verify only in isolated QA. | Retain old version only for the maximum documented reset window. |

## Current evidence and blockers

- Official GitHub metadata lists two staging repository secret entries and one Production-environment scheduler entry. Values were not read.
- Supabase project visibility is confirmed through the official CLI, but secret-list was deliberately not executed because its documentation does not guarantee redacted values.
- Vercel authentication is available, but environment listing may expose readable values and was deliberately not run. A Vercel operator must identify the linked project/team, update replacements, and preserve a rollback deployment.
- Provider audit-log access, replacement creation, and consumer cutover are not verified. Therefore F-SEC-005 remains **OPEN**.
