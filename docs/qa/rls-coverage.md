# RLS dan Storage Coverage

## Bukti source

Follow-up production-authorized 24 Oktober 2026: hostname target Supabase tidak dapat di-resolve dari runner (`ENOTFOUND`; domain pembanding juga gagal DNS). Runner berhenti sebelum HTTP dan tidak memiliki DB/QA credential. Karena itu seluruh tabel, policy, grant, function, migration history, bucket, serta Auth live settings di bawah tetap status source-only/BLOCKED; tidak ada perubahan remote.

Pemeriksaan migration statis menemukan 53 tabel `public` dan 53 deklarasi `ENABLE ROW LEVEL SECURITY`. Sebanyak 32 deklarasi policy `public` ditemukan dalam migration, selain policy pada `storage.objects`. Ini bukti migration source saja; bukan bukti bahwa migration berhasil diterapkan atau bahwa hasil kebijakan benar di PostgreSQL.

## Table-by-table status

Semua tabel di bawah tercatat RLS-enabled pada migration source. Tidak ada satu pun yang diuji dengan role `anon`/`authenticated` dan JWT claims ke database lokal, sehingga hasil akses read/write semuanya **BLOCKED**. “Policy declaration” menunjukkan ada pernyataan policy yang terdeteksi di source; ketiadaan policy biasanya berarti default deny bagi API client, namun maksud dan perilaku tersebut belum diuji. RPC/service-role dapat mempunyai jalur berbeda.

Production API GET tanpa cookie memberi 401/403 pada beberapa private routes, dan local built-app smoke mengonfirmasi response gates. Ini hanya pengujian HTTP/API tanpa JWT claims; tidak dihitung sebagai bukti RLS, Storage policy, RPC grant, atau PostgreSQL role simulation.

| Tabel | Policy declaration source | RLS runtime read/write |
|---|---|---|
| `public.addresses` | Ada | BLOCKED |
| `public.analytics_daily_metrics` | Tidak terdeteksi | BLOCKED |
| `public.audit_logs` | Tidak terdeteksi | BLOCKED |
| `public.bulk_order_items` | Ada | BLOCKED |
| `public.bulk_order_payment_events` | Tidak terdeteksi | BLOCKED |
| `public.bulk_order_payments` | Tidak terdeteksi | BLOCKED |
| `public.bulk_orders` | Ada | BLOCKED |
| `public.business_profiles` | Ada | BLOCKED |
| `public.cart_items` | Ada | BLOCKED |
| `public.carts` | Ada | BLOCKED |
| `public.categories` | Ada | BLOCKED |
| `public.cms_home_pages` | Tidak terdeteksi | BLOCKED |
| `public.cms_home_revisions` | Tidak terdeteksi | BLOCKED |
| `public.contact_messages` | Tidak terdeteksi | BLOCKED |
| `public.customer_segment_memberships` | Tidak terdeteksi | BLOCKED |
| `public.data_subject_requests` | Ada | BLOCKED |
| `public.email_outbox` | Tidak terdeteksi | BLOCKED |
| `public.erp_sync_jobs` | Tidak terdeteksi | BLOCKED |
| `public.idempotency_keys` | Tidak terdeteksi | BLOCKED |
| `public.inventory` | Tidak terdeteksi | BLOCKED |
| `public.inventory_reservations` | Tidak terdeteksi | BLOCKED |
| `public.invoices` | Ada | BLOCKED |
| `public.notifications` | Ada | BLOCKED |
| `public.order_items` | Ada | BLOCKED |
| `public.orders` | Ada | BLOCKED |
| `public.organization_members` | Ada | BLOCKED |
| `public.organization_sso_domains` | Tidak terdeteksi | BLOCKED |
| `public.organization_verification_requests` | Ada | BLOCKED |
| `public.organizations` | Ada | BLOCKED |
| `public.outbox_events` | Tidak terdeteksi | BLOCKED |
| `public.password_reset_rate_limits` | Tidak terdeteksi | BLOCKED |
| `public.payment_events` | Tidak terdeteksi | BLOCKED |
| `public.payments` | Ada | BLOCKED |
| `public.permissions` | Ada | BLOCKED |
| `public.product_images` | Ada | BLOCKED |
| `public.product_prices` | Ada | BLOCKED |
| `public.product_variants` | Ada | BLOCKED |
| `public.products` | Ada | BLOCKED |
| `public.profiles` | Ada | BLOCKED |
| `public.quotation_approvals` | Tidak terdeteksi | BLOCKED |
| `public.quotation_items` | Ada | BLOCKED |
| `public.quotation_messages` | Tidak terdeteksi | BLOCKED |
| `public.quotation_revisions` | Ada | BLOCKED |
| `public.quotations` | Ada | BLOCKED |
| `public.rfq_items` | Ada | BLOCKED |
| `public.rfqs` | Ada | BLOCKED |
| `public.role_permissions` | Ada | BLOCKED |
| `public.roles` | Ada | BLOCKED |
| `public.security_events` | Tidak terdeteksi | BLOCKED |
| `public.shipments` | Ada | BLOCKED |
| `public.shipping_quotes` | Ada | BLOCKED |
| `public.user_roles` | Ada | BLOCKED |
| `public.variant_inventory` | Tidak terdeteksi | BLOCKED |

## Storage buckets dari migration `202609290004_storage.sql`

| Bucket | Public source setting | Kebijakan source yang tampak | Hasil runtime |
|---|---|---|---|
| `product-images` | Public | Select publik melalui `storage.objects` | BLOCKED |
| `lookbook-images` | Public | Select publik melalui `storage.objects` | BLOCKED |
| `brand-assets` | Public | Select publik melalui `storage.objects` | BLOCKED |
| `business-documents` | Private | Member read, owner/admin upload | BLOCKED |
| `rfq-files` | Private | Participant read/upload dengan owner check | BLOCKED |
| `order-documents` | Private | Belum ada client policy pada migration storage | BLOCKED |

## Coverage RPC/grants

RPC yang terlihat mencakup `create_rfq`, `update_rfq_status`, business verification, quotation, checkout idempotency, Midtrans/payment notifications, fulfillment, CMS publish/role management, serta worker/outbox. Semua grants, invoker/definer behavior, `auth.uid()` actor checks, cross-tenant denial, concurrency, dan service-role bypass masih **BLOCKED**. Pengujian nanti harus memakai JWT claims yang benar pada local Supabase dan tidak memakai service role sebagai bukti RLS user.

## Follow-up runtime — 24 Oktober 2026

Production preflight diulang dengan target ref dan HTTPS hostname yang dikonfirmasi, tetapi resolver gagal sebelum HTTP. Website dan `example.com` juga tidak resolve. `npm run qa:db:guard` serta `npm run test:integration` berhenti pada linked-project metadata production sebelum DB connection. Tidak ada live catalog, migration history, policy/grant/function, Auth, bucket, atau RLS assertion yang dijalankan. Seluruh status runtime RLS tetap **BLOCKED**; migration-source declarations sebelumnya bukan bukti policy live.

## QA database readiness — 27 Oktober 2026

`npm run qa:db:guard` was run again and exited 1 with the expected fail-closed result: linked Supabase CLI metadata identifies the forbidden production project. The guard stopped before reading `.env.test.local`, opening PostgreSQL, starting a migration, or running a fixture. Docker is unavailable; local Supabase API/database ports 54321/54322 are not listening. Supabase CLI is discoverable, but this runner cannot complete the CLI version command because its telemetry write to the user profile is denied; no CLI stack command was run.

Fixture scope remains ready only as a plan: a disposable local stack must provide synthetic User A/User B/Admin/Super Admin, Organizations A/B, memberships, products/variants/inventory, RFQ/quotation/order, and namespaced Storage objects. Every created object must carry a unique QA run namespace and ledger entry, so teardown can address only recorded synthetic IDs. RLS, RPC, Storage, and transaction tests remain **BLOCKED** until the local target passes the existing identity guard.

## Runtime test plan after guard PASS

| Test ID | Prasyarat & fixture | Assertion utama | Cleanup | Status |
|---|---|---|---|---|
| RLS-USER-001 | Local guard PASS; User A/B; one order, RFQ, profile, and private object per user | JWT User A cannot SELECT/UPDATE User B IDs through route and database API; denied operation leaves no mutation | Delete only ledger IDs with run namespace | BLOCKED |
| RLS-ORG-001 | Organization A/B; distinct memberships and RFQ/quotation per organization | Member A cannot read/write Organization B resource or Storage path | Delete only A/B synthetic IDs and namespaced objects | BLOCKED |
| RBAC-ADMIN-001 | User, Admin, Super Admin sessions; synthetic admin-only resource | User denied Admin operation; Admin denied Super Admin CMS/role operation | Restore/remove only synthetic records | BLOCKED |
| RBAC-MFA-001 | Super Admin AAL1 and AAL2 synthetic sessions when local Auth supports MFA | Privileged role/CMS change requires documented AAL policy; role payload cannot elevate caller | Revoke local test sessions and delete fixture user | BLOCKED |
| RFQ-001 | Verified/unverified organizations, memberships, RFQ/item fixtures | Creation and state transition require owner/member/verification; cross-org and invalid transition denied | Delete RFQ chain by recorded IDs | BLOCKED |
| COMMERCE-001 | One product variant with synthetic stock, server pricing, idempotency ledger | Client price rejected/recalculated; same key same payload creates one order; different payload is denied | Remove synthetic orders/reservations/product by ledger | BLOCKED |
| PAYMENT-001 | Synthetic signed webhook fixture and local event ledger | Invalid signature denied; duplicate/replay does not settle twice; invalid transition denied | Remove only synthetic event/order IDs | BLOCKED |
| STORAGE-001 | Namespaced benign valid/invalid files in private/public buckets | Signature spoof denied; User/Org B cannot download/overwrite A object | Delete exact namespaced object keys after metadata cleanup test | BLOCKED |
| CMS-001 | Synthetic home draft/revision and User/Admin/Super Admin sessions | Only authorized Super Admin can draft/publish; public read excludes unpublished draft | Restore baseline synthetic draft/revision from ledger | BLOCKED |

No row above is runtime evidence. The common first step is `npm run qa:db:guard`; tests must abort if it does not exit 0.
