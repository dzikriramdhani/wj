# Phase 4 operations activation

Phase 4 is implemented in DEV with database aggregate tables and durable worker contracts. Configure the following before relying on operational dashboards or ERP data.

## Operational scheduler

Call the operations worker every five minutes. It refreshes daily analytics and customer segments, claims the transactional outbox, and creates ERP sync jobs for supported business events.

```text
POST https://YOUR-DOMAIN/api/internal/operations/process
Authorization: Bearer <CRON_SECRET>
```

Call it once after deployment to populate the current day. Schedule a second run shortly after midnight in the business timezone so the previous day's aggregate is finalized.

## ERP receiver

Set these deployment-only values after the ERP receiver is available:

```env
ERP_WEBHOOK_URL=https://erp.example.com/integrations/winajaya/events
ERP_WEBHOOK_SECRET=a-long-random-shared-secret
```

Then call the ERP worker every five minutes:

```text
POST https://YOUR-DOMAIN/api/internal/erp/sync
Authorization: Bearer <CRON_SECRET>
```

The receiver must verify the signature as HMAC-SHA256 of `<timestamp>.<raw request body>` using `ERP_WEBHOOK_SECRET`. The timestamp is sent in `X-WinaJaya-Timestamp`; the signature is sent as `X-WinaJaya-Signature: sha256=<hex>`. Return any 2xx response only after the receiver has accepted the event idempotently.

Failed deliveries retry with exponential backoff and appear in **Admin → Operasi**. Investigate jobs whose status reaches `failed`; do not manually edit `erp_sync_jobs`.

## Monitoring and capacity

Create uptime checks for checkout, the Midtrans webhook, all three scheduler endpoints, and the ERP receiver. Alert on any non-2xx response, non-zero failed ERP jobs, outbox backlog that keeps growing, payment/webhook errors, and email worker failures.

Use the Supabase Performance Advisor and staging load tests before choosing stronger compute, pooling, a read replica, or a separate analytics store. These are capacity decisions based on observed load; the current dashboard reads bounded daily aggregates.
