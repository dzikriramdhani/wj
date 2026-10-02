# Backup restore exercise

Run this exercise in STAGING every quarter and before the first production launch.

1. Record the target time and the expected schema migration version.
2. Restore a separate STAGING database from the selected backup or point in time.
3. Run `supabase db push --dry-run` against the restored database and confirm it has the expected migration history.
4. Confirm RLS still blocks cross-user orders, RFQs, documents, and notifications.
5. Run a Sandbox checkout, expiry release, and payment-webhook replay against the restored environment.
6. Record duration, data gap, issues, and the operator who performed the test.

The target is RPO ≤15 minutes and RTO ≤2 hours. Escalate when either target is missed.
