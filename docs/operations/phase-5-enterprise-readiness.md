# Phase 5 enterprise readiness

The PRD treats Phase 5 as capability to enable when real scale or customer requirements justify it. The DEV application now includes governance foundations; it does not create external identity, analytics, search, or multi-region infrastructure automatically.

## Admin MFA

Enable MFA in Supabase Auth and enroll every Admin before setting this production-only deployment variable:

```env
ADMIN_MFA_REQUIRED=true
```

When enabled, Admin pages and Admin API routes require AAL2. Keep it `false` in DEV until each internal Admin has tested MFA enrollment and sign-in.

## Enterprise SSO

Use your Supabase plan's SAML/OIDC SSO configuration for the actual identity-provider connection. Store IdP client secrets and certificates only in Supabase or the identity provider, never in `organization_sso_domains` or application environment templates.

The application table only maps a verified company domain to `saml` or `oidc` policy metadata. Add a domain after the IdP connection, domain ownership verification, break-glass Admin account, and sign-in test are complete.

## Privacy and audit

Customers can create access, export, or erasure requests at `/privacy`. Admin reviews them in **Admin → Governance**. A completed request records workflow completion; it does not automatically purge transaction data. Apply legal retention rules before fulfilling erasure requests.

Audit records include before/after data support, source IP and user-agent fields for new sensitive operations. Retain audit data according to the approved retention policy and restrict exports to permitted staff.

## Dedicated services

Introduce a dedicated search service, analytics warehouse, separate worker fleet, advanced cache, read replicas, service decomposition, or multi-region architecture only after metrics show the relevant bottleneck. Document the measured trigger, data residency implications, rollback plan, owner, and recovery test before each adoption.
