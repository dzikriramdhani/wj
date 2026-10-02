# PRODUCT REQUIREMENTS DOCUMENT

## WINAJAYA COMMERCE PLATFORM

**Dokumen:** Product Requirements Document
**Versi:** 1.0
**Status:** Master Baseline / Production-Oriented
**Tanggal:** 29 September 2026
**Produk:** WINAJAYA
**Target:** E-Commerce + B2B Commerce Platform
**Arsitektur Database:** Supabase PostgreSQL
**Authentication:** Supabase Auth
**Object Storage:** Supabase Storage
**Application:** Next.js + TypeScript
**Edge/API Logic:** Next.js Server + Supabase Edge Functions
**Edge Security:** Cloudflare
**Payment:** Midtrans
**Shipping:** RajaOngkir
**Email:** Custom SMTP + Transactional Email Provider
**ORM:** Tidak menggunakan Prisma pada baseline arsitektur ini

---

# 1. EXECUTIVE SUMMARY

WINAJAYA adalah platform commerce yang menggabungkan:

1. Company profile.
2. Product catalog.
3. E-commerce transaksi langsung.
4. B2B purchasing.
5. Request for Quotation (RFQ).
6. Quotation dan negosiasi.
7. Customer account.
8. Business verification.
9. Payment.
10. Shipping.
11. Administration.
12. Inventory.
13. Notification dan transactional email.
14. Analytics.
15. Integrasi ERP pada tahap lanjutan.

Platform dirancang sejak awal untuk menghadapi pertumbuhan dari penggunaan kecil menuju:

* ribuan pengguna aktif;
* trafik publik tinggi;
* banyak gambar dan file;
* volume transaksi yang meningkat;
* banyak Edge Function invocation;
* banyak request simultan;
* data bisnis dan customer yang sensitif;
* kebutuhan audit;
* kebutuhan backup dan recovery.

Prinsip utama:

> **Build simple enough to operate now, but architected so critical components can scale independently later.**

WINAJAYA tidak akan menggunakan Edge Function sebagai backend untuk seluruh request. Public read yang murah dan cacheable harus tetap murah. Edge Functions digunakan terutama untuk operasi yang memerlukan validasi, secret, webhook, integrasi eksternal, atau business logic sensitif.

---

# 2. PRODUCT VISION

Membangun platform commerce WINAJAYA yang:

* cepat;
* aman;
* dapat dipercaya;
* dapat digunakan customer retail maupun bisnis;
* mampu menangani transaksi;
* mampu menangani RFQ/B2B;
* memiliki kontrol internal yang kuat;
* mampu berkembang tanpa melakukan rewrite arsitektur utama.

Produk harus dirancang sebagai **commerce platform**, bukan hanya website company profile yang ditambahkan shopping cart.

---

# 3. BUSINESS OBJECTIVES

## 3.1 Tujuan bisnis

WINAJAYA harus mampu:

* menampilkan produk secara profesional;
* menghasilkan sales melalui direct commerce;
* menerima order online;
* menerima RFQ perusahaan;
* mengelola customer B2B;
* mengelola quotation;
* mengelola pembayaran;
* mengelola pengiriman;
* menyediakan admin operation;
* menjadi fondasi integrasi ERP pada fase berikutnya.

## 3.2 Tujuan teknis

Sistem harus:

* memiliki single source of truth untuk data commerce;
* memiliki authorization di database;
* meminimalkan trust terhadap client;
* memiliki transaction integrity;
* memiliki idempotent transaction processing;
* memiliki auditability;
* memisahkan data publik dan privat;
* memisahkan development, staging, dan production;
* dapat diuji dengan load testing;
* dapat dimonitor;
* mempunyai disaster recovery strategy.

---

# 4. NON-GOALS

Versi awal tidak bertujuan membuat:

* marketplace multi-vendor;
* microservice architecture penuh;
* Kubernetes cluster;
* dedicated distributed cache;
* dedicated search cluster;
* multi-region active-active database;
* data warehouse skala enterprise;
* native mobile app;
* ERP penuh di dalam WINAJAYA.

Komponen tersebut boleh menjadi extension apabila kebutuhan bisnis dan trafik benar-benar mengharuskannya.

---

# 5. TARGET USER

## 5.1 Guest

Pengguna yang belum login.

Dapat:

* melihat homepage;
* melihat catalog;
* melihat product;
* melihat category;
* melihat lookbook;
* melihat company information;
* melihat store information;
* melakukan pencarian;
* mendaftar akun.

Tidak dapat:

* melihat order;
* melihat dokumen privat;
* membuat transaksi tanpa memenuhi requirement checkout;
* melihat data B2B milik pihak lain;
* menggunakan endpoint privat.

---

# 6. USER TYPES AND ROLES

## 6.1 User

Role platform bawaan untuk setiap akun yang mendaftar.

Capabilities:

* register;
* login;
* manage profile;
* manage address;
* add product to cart;
* checkout;
* pay;
* view orders;
* track shipment;
* receive notifications.

## 6.2 B2B Buyer

Customer yang berada dalam organisasi/perusahaan.

Capabilities:

* company profile;
* purchasing;
* create RFQ;
* review quotation;
* approve quotation sesuai permission;
* manage business addresses;
* view company orders.

## 6.3 B2B Manager

Pengguna perusahaan dengan hak lebih tinggi.

Capabilities:

* manage organization members;
* manage purchasing permissions;
* manage RFQ;
* approve quotations;
* view organization transactions.

## 6.4 Admin

Internal operational administrator. Sales, Finance, Warehouse, dan Content Admin adalah area kerja Admin, bukan role platform terpisah.

Capabilities:

* catalog, category, media, lookbook, dan SEO metadata;
* customer relationship, RFQ, quotation, dan verifikasi B2B;
* payment review dan reconciliation;
* inventory, fulfillment, dan shipment status;
* operational reporting, customer data, serta governance operasional.

Admin tidak dapat mengubah role platform atau konfigurasi sistem sensitif.

## 6.5 Super Admin

System-level administrator.

Capabilities terbatas pada personnel tertentu:

* role management;
* permission;
* system configuration;
* security configuration;
* critical operations.

Super Admin harus menggunakan MFA.

---

# 7. AUTHENTICATION REQUIREMENTS

Authentication menggunakan Supabase Auth.

Supported baseline:

* email/password;
* email confirmation;
* password reset;
* session management;
* MFA untuk role privileged.

Supabase Auth menggunakan JWT dan terintegrasi dengan RLS untuk authorization pada database.

## 7.1 Registration

Flow:

```text
Register
→ validate input
→ create Auth user
→ email verification
→ create profile
→ onboarding
```

Email:

```text
registration
→ email verification
→ verified
→ account active
```

## 7.2 Login

Flow:

```text
Email
+
Password
+
MFA if required
→ authenticated session
```

## 7.3 Password reset

Flow:

```text
Forgot password
→ email
→ secure recovery link
→ new password
→ session security check
```

## 7.4 Session security

Sistem harus:

* tidak menyimpan credential mentah;
* tidak menyimpan password;
* menggunakan secure cookie/session mechanism;
* memiliki session expiration policy;
* memungkinkan invalidation;
* menyediakan logout;
* mendukung step-up authentication untuk tindakan kritis.

---

# 8. EMAIL AND SMTP

## 8.1 Authentication Email

Digunakan untuk:

* confirmation;
* password reset;
* invite;
* security email;
* email change.

Production harus menggunakan custom SMTP, bukan default SMTP Supabase. Supabase menyatakan default SMTP ditujukan untuk non-production dan memiliki pembatasan rate/delivery; custom SMTP mendukung provider seperti Resend, AWS SES, Postmark, SendGrid, ZeptoMail, dan Brevo.

## 8.2 Transactional Email

Digunakan untuk:

* order confirmation;
* payment confirmation;
* payment failure;
* quotation;
* RFQ update;
* shipment notification;
* invoice;
* B2B verification;
* account notification.

Flow:

```text
Application
→ event/outbox
→ queue
→ email worker
→ email provider
```

Email tidak boleh menjadi synchronous dependency checkout.

## 8.3 Email security

Domain harus memiliki:

* SPF;
* DKIM;
* DMARC.

Authentication email dan marketing email harus dipisahkan agar reputasi pengiriman tidak saling mempengaruhi. Supabase juga merekomendasikan pemisahan tersebut pada production setup.

---

# 9. RBAC AND AUTHORIZATION

Sistem harus menggunakan RBAC.

Konsep:

```text
User
  ↓
Organization Membership
  ↓
Role
  ↓
Permission
```

Contoh:

```text
admin.rfq.read
admin.rfq.quote

admin.payment.read
admin.payment.reconcile

admin.inventory.read
admin.inventory.update

admin.catalog.create
admin.catalog.update
```

Authorization tidak boleh hanya diterapkan pada frontend.

Frontend:

```text
hide button
```

bukan security mechanism.

Security enforcement:

```text
RLS
+
database permission
+
server validation
+
Edge authorization
```

Supabase menyediakan pola custom claims/RBAC yang dapat dipadukan dengan RLS.

---

# 10. MULTI-TENANT B2B

WINAJAYA harus siap menangani banyak perusahaan.

Model:

```text
Organization
   │
   ├── Members
   ├── Addresses
   ├── RFQ
   ├── Quotations
   ├── Orders
   └── Documents
```

Contoh:

```text
PT A
 ├── Buyer A
 ├── Finance A
 └── Manager A

PT B
 ├── Buyer B
 └── Manager B
```

Data PT A tidak boleh dapat diakses PT B.

Setiap tabel B2B yang relevan harus memiliki:

```text
organization_id
```

dan authorization harus memperhitungkan membership pengguna.

---

# 11. DATABASE REQUIREMENTS

Supabase PostgreSQL menjadi source of truth.

## 11.1 Auth

```text
profiles
roles
permissions
user_roles
role_permissions
organizations
organization_members
business_profiles
```

## 11.2 Catalog

```text
categories
products
product_variants
product_images
prices
inventory
```

## 11.3 Commerce

```text
carts
cart_items
addresses
orders
order_items
inventory_reservations
payments
payment_events
shipments
```

## 11.4 B2B

```text
rfqs
rfq_items
quotations
quotation_items
quotation_revisions
```

## 11.5 System

```text
notifications
email_outbox
outbox_events
idempotency_keys
audit_logs
system_settings
```

---

# 12. PRODUCT MODEL

Product minimal:

```text
id
sku
slug
name
description
category_id
brand
status
visibility
created_at
updated_at
```

Variant:

```text
id
product_id
sku
size
color
attributes
price
compare_at_price
status
```

Image:

```text
id
product_id
variant_id
storage_path
alt_text
sort_order
width
height
mime_type
```

Product tidak boleh bergantung pada nama file untuk identity.

SKU adalah business identifier.

UUID/database ID adalah internal identifier.

---

# 13. PRODUCT STATUS

Product memiliki state:

```text
DRAFT
ACTIVE
INACTIVE
ARCHIVED
```

Frontend hanya menampilkan product yang:

```text
status = ACTIVE
visibility = PUBLIC
```

---

# 14. INVENTORY

Inventory tidak boleh hanya berupa angka sederhana yang dimodifikasi frontend.

Model:

```text
ON_HAND
RESERVED
AVAILABLE
```

Formula:

```text
AVAILABLE = ON_HAND - RESERVED
```

Flow checkout:

```text
Cart
 ↓
Validate stock
 ↓
Reserve inventory
 ↓
Create order
 ↓
Payment
 ↓
PAID
 ↓
Commit inventory
```

Apabila payment expired:

```text
Reservation
 ↓
Expired
 ↓
Release stock
```

## 14.1 Concurrency

Sistem harus mencegah:

```text
Stock = 1

User A → checkout
User B → checkout
```

keduanya mendapatkan item yang sama.

Database transaction/locking/atomic operation harus digunakan.

---

# 15. CART

Cart dapat:

* dibuat otomatis;
* memiliki owner user;
* memiliki guest session bila diperlukan;
* memiliki item;
* mengubah quantity;
* menghapus item;
* validasi availability.

Cart tidak menjadi source of truth harga.

Harga saat checkout harus dihitung ulang dari sumber authoritative.

---

# 16. CHECKOUT

Checkout adalah operasi sensitif.

Frontend hanya mengirim:

```text
product/variant ID
quantity
address ID
shipping method
voucher/code jika ada
```

Frontend tidak dipercaya untuk:

* harga;
* subtotal;
* tax;
* shipping cost;
* discount;
* grand total;
* inventory state.

Server mengambil ulang data authoritative.

Flow:

```text
Checkout Request
 ↓
Authenticate
 ↓
Authorize
 ↓
Validate Input
 ↓
Load Product
 ↓
Load Price
 ↓
Load Inventory
 ↓
Calculate Pricing
 ↓
Calculate Shipping
 ↓
Reserve Inventory
 ↓
Create Order
 ↓
Create Payment
 ↓
Return Payment Session
```

---

# 17. ORDER STATE MACHINE

Order:

```text
PENDING_PAYMENT
PAID
PROCESSING
PACKED
SHIPPED
DELIVERED
CANCELLED
EXPIRED
REFUND_PENDING
REFUNDED
```

Perubahan status harus melalui business rules.

Frontend tidak boleh:

```text
PATCH /orders/123
status = PAID
```

---

# 18. PAYMENT

Payment provider:

**Midtrans**

Architecture:

```text
WINAJAYA
   ↓
Payment Edge Function
   ↓
Midtrans
```

Server menyimpan:

```text
provider
provider_transaction_id
order_id
amount
currency
status
payment_type
created_at
updated_at
```

## 18.1 Payment Webhook

Flow:

```text
Midtrans
 ↓
HTTPS Webhook
 ↓
Verify Signature
 ↓
Identify Order
 ↓
Check Idempotency
 ↓
Validate Status
 ↓
Update Payment
 ↓
Update Order
 ↓
Publish Event
```

Midtrans mendokumentasikan verifikasi `signature_key`, penggunaan HTTPS, validasi status transaksi, dan kebutuhan idempotent handling karena notification dapat diterima lebih dari sekali.

## 18.2 Payment event storage

Setiap webhook harus disimpan sehingga sistem memiliki histori:

```text
payment_events
```

Payload sensitif tidak boleh ditampilkan sembarangan kepada customer.

---

# 19. IDEMPOTENCY

Operation berikut wajib idempotent:

* checkout;
* payment creation;
* payment webhook;
* order fulfillment;
* refund;
* email event processing;
* queue consumer.

Contoh:

```text
idempotency_key
```

harus unique untuk operation tertentu.

Tujuan:

```text
request × 2
```

tidak menjadi:

```text
order × 2
payment × 2
stock deduction × 2
```

---

# 20. SHIPPING

Provider:

**RajaOngkir**

Shipping flow:

```text
Address
 ↓
Validate destination
 ↓
Get shipping options
 ↓
User chooses courier/service
 ↓
Server calculates/validates shipping
 ↓
Order created
```

Server tidak boleh mempercayai ongkir yang dikirim frontend.

Shipping data yang stabil dapat dicache agar tidak memanggil provider terus-menerus.

---

# 21. RFQ / B2B

RFQ adalah core feature WINAJAYA.

Customer dapat:

```text
Create RFQ
 ↓
Add products
 ↓
Quantity
 ↓
Target date
 ↓
Notes
 ↓
Upload supporting document
 ↓
Submit
```

RFQ states:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
QUOTED
NEGOTIATING
ACCEPTED
REJECTED
EXPIRED
CANCELLED
```

---

# 22. QUOTATION

Sales membuat quotation dari RFQ.

Quotation:

```text
Quotation
 ├── items
 ├── pricing
 ├── discount
 ├── shipping
 ├── validity
 ├── terms
 └── revision
```

Quotation tidak boleh diedit tanpa revision history setelah dikirim ke customer.

Contoh:

```text
REVISION 1
REVISION 2
REVISION 3
```

Setiap perubahan penting harus dapat ditelusuri.

---

# 23. FILE STORAGE

Supabase Storage digunakan sebagai object storage.

Buckets:

```text
product-images
lookbook-images
brand-assets

business-documents
rfq-files
order-documents
```

## Public

```text
product-images
lookbook-images
brand-assets
```

## Private

```text
business-documents
rfq-files
order-documents
```

Private files hanya boleh diakses melalui authorization + signed access mechanism.

---

# 24. IMAGE PIPELINE

Original upload:

```text
Original
 ↓
Validation
 ↓
Optimize
 ↓
Derivative images
 ├── thumbnail
 ├── card
 ├── medium
 └── large
```

Requirement:

* validate MIME;
* validate size;
* validate file extension;
* generate safe filename/path;
* store metadata;
* generate responsive variants;
* strip unwanted metadata where appropriate;
* prevent arbitrary path traversal;
* do not expose internal filesystem semantics.

Untuk file besar, upload harus langsung ke Storage, bukan melalui application server.

Supabase Storage mendukung direct/resumable upload dan CDN-based asset delivery.

---

# 25. EDGE FUNCTION POLICY

Edge Functions tidak boleh menjadi default backend untuk setiap request.

## Use Edge Function

Digunakan untuk:

```text
payment-create
payment-webhook
checkout
refund
shipping-provider
send-email
b2b-verification
admin-sensitive-operation
ERP-integration
```

## Jangan gunakan Edge Function

Untuk:

```text
GET /products
GET /categories
GET /public-content
GET /lookbook
```

apabila operation tersebut dapat disajikan melalui cache/public API/RLS dengan aman.

Supabase sendiri menjelaskan Edge Functions sebagai server-side TypeScript untuk endpoint, webhook, dan integrasi pihak ketiga; function sebaiknya short-lived dan idempotent, sementara pekerjaan berat dipindahkan ke background worker.

---

# 26. QUEUE / ASYNCHRONOUS PROCESSING

Setelah event penting terjadi:

```text
Order Paid
```

jangan melakukan semua pekerjaan dalam satu synchronous request.

Gunakan:

```text
Event
 ↓
Queue
 ↓
Workers
```

Contoh:

```text
ORDER_PAID
 ├── Send Email
 ├── Generate Invoice
 ├── Notify Warehouse
 ├── Analytics
 └── ERP Sync
```

Queue harus mendukung retry dan failure handling.

Supabase Queues dapat digunakan untuk durable message processing dan Edge Functions dapat menjadi consumer.

---

# 27. OUTBOX PATTERN

Untuk event yang sangat penting:

```text
Database Transaction
      │
      ├── update order
      └── write outbox event
```

Keduanya harus berada dalam satu transaksi database.

Contoh:

```text
orders
outbox_events
```

Sehingga:

```text
ORDER PAID
```

tidak terjadi tanpa event yang akan diproses downstream.

---

# 28. DATABASE SECURITY

Semua tabel user-facing dan sensitive harus dievaluasi untuk RLS.

Minimal:

```text
profiles
organizations
organization_members
orders
order_items
payments
rfqs
quotations
documents
notifications
```

harus memiliki authorization yang eksplisit.

Supabase production guidance secara eksplisit merekomendasikan RLS pada tabel yang terekspos dan penggunaan index yang sesuai dengan pola query.

---

# 29. RLS RULES

## Customer

Boleh:

```text
own profile
own address
own cart
own orders
own payment information
own RFQ
own quotations
```

Tidak boleh:

```text
customer lain
organization lain
internal admin data
```

## B2B

Boleh mengakses:

```text
records belonging to own organization
```

## Sales

Boleh mengakses:

```text
assigned organizations
assigned RFQs
```

## Finance

Boleh mengakses:

```text
authorized payment records
```

## Warehouse

Boleh mengakses:

```text
authorized inventory/order fulfillment data
```

---

# 30. SECRET MANAGEMENT

Secret tidak boleh berada pada client.

Sensitive environment values:

```text
SUPABASE_SECRET_KEY
MIDTRANS_SERVER_KEY
RAJAONGKIR_API_KEY
SMTP_PASSWORD
EMAIL_PROVIDER_API_KEY
```

Tidak boleh menggunakan:

```text
NEXT_PUBLIC_
```

untuk secret.

Secrets disimpan pada server-side environment/secret storage.

Supabase menyediakan project secrets untuk Edge Functions.

---

# 31. CLOUDFLARE EDGE SECURITY

Cloudflare berada di depan public application.

Responsibilities:

```text
DNS
CDN
TLS
WAF
DDoS protection
Rate limiting
bot mitigation
caching
```

Rate limit harus berbeda berdasarkan endpoint.

Contoh requirement:

```text
/login
/register
/password-reset
/checkout
/rfq
/admin
```

mempunyai policy berbeda.

Public catalog mempunyai policy berbeda dari authentication endpoint.

---

# 32. API SECURITY

Semua endpoint harus memiliki:

### Authentication

Siapa user?

### Authorization

Apa yang boleh dilakukan user?

### Validation

Apakah input valid?

### Resource ownership

Apakah resource milik user/organization tersebut?

### Rate limiting

Apakah request terlalu banyak?

### Idempotency

Apakah request merupakan retry?

### Auditability

Apakah operation perlu dicatat?

---

# 33. INPUT VALIDATION

Semua input dari client harus divalidasi.

Validasi:

* type;
* required fields;
* min/max length;
* enum;
* numeric range;
* UUID;
* email;
* quantity;
* file MIME;
* file size;
* URL;
* pagination.

Jangan menganggap TypeScript frontend validation sebagai security boundary.

Server harus melakukan validation ulang.

---

# 34. ADMIN SECURITY

Admin harus memiliki security level lebih tinggi.

Minimum:

```text
MFA
RBAC
Rate Limiting
Audit Log
Session Control
Re-authentication for sensitive actions
```

Sensitive actions:

```text
Change role
Delete user
Refund
Change payment configuration
Change business verification
Delete critical product
Change banking/payment information
```

harus memiliki additional authorization.

---

# 35. AUDIT LOG

Audit log wajib untuk critical operations.

Schema:

```text
audit_logs

id
actor_id
organization_id
action
resource_type
resource_id
before_data
after_data
ip_address
user_agent
created_at
```

Contoh:

```text
ADMIN
CHANGE_PRODUCT_PRICE
SKU-001
150000 → 135000
```

atau:

```text
FINANCE
REFUND_ORDER
ORD-10001
```

Audit log tidak boleh mudah dihapus oleh admin biasa.

---

# 36. SECURITY EVENTS

Sistem harus dapat mencatat:

* failed login;
* repeated login;
* password reset;
* MFA events;
* role changes;
* permission changes;
* suspicious checkout;
* webhook failure;
* payment mismatch;
* unusual file upload;
* administrator actions.

---

# 37. OBSERVABILITY

Sistem harus mempunyai visibility terhadap:

```text
Application
Database
Edge Functions
Storage
Payment
Shipping
Email
Queue
```

Metrics minimal:

```text
request count
error rate
latency
p95 latency
p99 latency
DB query duration
DB connection usage
Edge Function errors
Edge Function duration
queue backlog
payment failures
webhook failures
email failures
storage usage
bandwidth
```

Supabase production guidance merekomendasikan Performance Advisor, index yang sesuai, dan load testing di staging; `pg_stat_statements` juga dapat digunakan untuk mengidentifikasi query lambat/hot.

---

# 38. LOGGING

Log harus memiliki:

```text
timestamp
request_id
user_id if available
organization_id if available
route
status
duration
error code
```

Jangan log:

```text
password
access token
secret key
payment secret
SMTP password
full sensitive document
```

---

# 39. ERROR HANDLING

Application harus memiliki standardized error format:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Product is no longer available in the requested quantity.",
    "request_id": "..."
  }
}
```

Jangan mengirim stack trace ke customer.

---

# 40. DATABASE PERFORMANCE

Semua query harus:

* menggunakan index yang sesuai;
* memiliki filter;
* memiliki pagination;
* menghindari SELECT * pada query berat;
* menghindari N+1 query;
* menghindari unbounded query;
* menggunakan cursor pagination pada dataset besar jika diperlukan.

Catalog:

```text
LIMIT/OFFSET
```

boleh pada skala kecil.

Untuk dataset yang terus berkembang:

```text
cursor pagination
```

lebih disukai.

---

# 41. CACHE STRATEGY

Cache terutama digunakan pada:

```text
product catalog
categories
public CMS
lookbook
shipping reference data
```

Jangan cache secara sembarangan:

```text
user order
payment status
private documents
admin data
```

Cache invalidation harus terjadi ketika critical catalog data berubah.

---

# 42. SEARCH

Phase awal:

```text
PostgreSQL search
```

Saat catalog/search traffic meningkat:

```text
Postgres
  ↓
Search Index
```

Search engine dedicated hanya ditambahkan ketika query volume dan complexity membenarkannya.

---

# 43. ANALYTICS

Operational database tidak boleh menjadi analytical warehouse selamanya.

Phase awal:

```text
Postgres
 ↓
aggregated metrics
```

Phase lanjut:

```text
Events
 ↓
Analytics pipeline
 ↓
Analytics store/warehouse
```

Dashboard harus menggunakan aggregate, bukan melakukan full historical scan setiap request.

---

# 44. BACKUP AND DISASTER RECOVERY

Production harus memiliki:

```text
Backup
Recovery
Restore Test
```

Minimal policy:

* automatic backup sesuai plan;
* point-in-time recovery apabila requirement RPO membutuhkannya;
* backup verification;
* restore testing;
* off-site backup untuk critical business data bila diperlukan.

Supabase saat ini menyatakan database backups yang dapat diunduh tidak tersedia pada Free Plan dan merekomendasikan PITR ketika kebutuhan recovery lebih ketat; production checklist juga membedakan durability dan availability resilience.

---

# 45. RECOVERY TARGET

Initial internal target:

```text
RPO: <= 15 menit
RTO: <= 2 jam
```

Target ini harus divalidasi dan ditingkatkan berdasarkan kebutuhan bisnis.

RPO:

> maksimal kehilangan data yang masih dapat diterima.

RTO:

> maksimal waktu sampai layanan dapat dipulihkan.

---

# 46. ENVIRONMENT STRATEGY

WINAJAYA wajib memiliki:

```text
DEV
STAGING
PRODUCTION
```

Tidak boleh menggunakan production database untuk testing.

Flow:

```text
Developer
 ↓
DEV
 ↓
PR
 ↓
STAGING
 ↓
Test
 ↓
Approval
 ↓
PRODUCTION
```

Production data tidak boleh digunakan sebagai seed data development.

Supabase juga menekankan pemisahan data development dari production karena risiko keamanan dan side effects.

---

# 47. DATABASE MIGRATION

Database schema harus dikelola melalui versioned migrations.

Contoh:

```text
0001_initial_schema
0002_profiles
0003_catalog
0004_orders
0005_rbac
0006_payment
```

Tidak diperbolehkan melakukan perubahan production secara manual tanpa migration record.

---

# 48. CI/CD

Flow:

```text
Git
 ↓
Pull Request
 ↓
Lint
 ↓
Type Check
 ↓
Unit Test
 ↓
Build
 ↓
Security Checks
 ↓
Staging
 ↓
Integration Test
 ↓
Deploy Production
```

Database migration dan Edge Function deployment harus terkontrol dan reproducible.

Supabase menyediakan CLI/deployment workflow untuk Edge Functions dan integrasi CI/CD.

---

# 49. TESTING STRATEGY

## Unit Test

Untuk:

* pricing;
* discount;
* inventory;
* permissions;
* state transition;
* shipping calculation;
* validation.

## Integration Test

Untuk:

* database;
* auth;
* RLS;
* checkout;
* payment;
* shipping;
* storage.

## End-to-End Test

Flow:

```text
register
→ login
→ product
→ cart
→ checkout
→ payment
→ order
```

dan:

```text
B2B
→ verify company
→ RFQ
→ quotation
→ accept
→ order
```

---

# 50. SECURITY TESTING

Wajib diuji:

```text
User A mencoba membaca User B
User A mencoba membaca Organization B
Customer mencoba akses admin
Sales mencoba akses Finance
Guest mencoba checkout endpoint
Manipulasi price
Manipulasi quantity
Manipulasi order ID
Manipulasi user ID
Replay webhook
Duplicate webhook
Duplicate checkout
File upload abuse
Rate limit abuse
Expired session
Invalid JWT
```

---

# 51. LOAD TESTING

Sebelum production public launch, sistem harus diuji dengan skenario terukur.

Baseline test target:

```text
5,000 active sessions
200 requests/sec aggregate public traffic
20 checkout requests/sec
100+ concurrent image uploads
```

Angka tersebut adalah **acceptance benchmark awal**, bukan klaim kapasitas Supabase.

Sistem dinyatakan siap apabila:

* tidak terjadi data corruption;
* tidak ada unauthorized access;
* order tidak duplicate;
* payment tidak duplicate;
* stock tidak oversold;
* queue tidak kehilangan critical event;
* latency masih dalam target;
* error rate masih dalam batas yang ditetapkan.

Load testing sebaiknya dilakukan pada staging atau environment yang terpisah dari production. Supabase production checklist juga merekomendasikan load testing di staging.

---

# 52. PERFORMANCE TARGET

Initial product targets:

## Public catalog

```text
p95 < 500 ms
```

untuk request yang berasal dari cache/optimized path.

## Authenticated API

```text
p95 < 800 ms
```

untuk operasi normal yang tidak bergantung pada external provider.

## Checkout

```text
internal processing p95 < 1.5 sec
```

Tidak termasuk latency dari payment provider.

## Page experience

Prioritas:

```text
fast initial render
optimized images
minimal JS
CDN/cache
responsive images
```

---

# 53. MOBILE PERFORMANCE

Sebagian customer akan mengakses melalui perangkat mobile.

Website harus:

* responsive;
* mobile-first untuk checkout;
* menggunakan optimized images;
* tidak mengirim gambar original;
* meminimalkan JavaScript;
* lazy-load media;
* memiliki accessible form.

---

# 54. SEO

Public catalog harus mendukung:

* semantic URL;
* metadata;
* Open Graph;
* structured data;
* canonical;
* sitemap;
* robots;
* SEO-friendly product pages.

Contoh:

```text
/products/category/product-slug
```

bukan:

```text
/product?id=123
```

---

# 55. PRODUCT CATALOG UX

Product page harus memiliki:

```text
Image Gallery
Product Name
SKU
Description
Attributes
Variant
Price
Stock status
Quantity
Add to Cart
Buy Now
Shipping Information
Related Products
```

B2B user dapat melihat fitur khusus sesuai authorization, misalnya:

```text
Request Quote
Bulk Purchase
Company Pricing
```

---

# 56. ADMIN PLATFORM

Admin dashboard:

```text
Dashboard
Catalog
Categories
Inventory
Orders
Payments
Shipments
Customers
Organizations
RFQs
Quotations
Content
Media
Users
Roles
Permissions
Notifications
Audit Logs
System Settings
```

Menu harus berasal dari permission, bukan sekadar role name.

---

# 57. ADMIN DASHBOARD SECURITY

Admin API harus:

* authenticated;
* authorized;
* rate-limited;
* logged;
* audited.

Frontend permission check tidak cukup.

Server/database juga harus menolak unauthorized action.

---

# 58. ORDER OPERATIONS

Internal flow:

```text
ORDER CREATED
 ↓
PAYMENT PENDING
 ↓
PAYMENT CONFIRMED
 ↓
WAREHOUSE PROCESSING
 ↓
PACKED
 ↓
SHIPPED
 ↓
DELIVERED
```

Setiap transition menghasilkan event yang dapat dikonsumsi sistem lain.

---

# 59. NOTIFICATION SYSTEM

Notification channel:

```text
Email
In-App
Future: WhatsApp/Push
```

Notification object:

```text
id
user_id
type
title
body
read_at
created_at
```

Notification harus bersifat event-driven.

---

# 60. SECURITY BOUNDARIES

## Public

```text
Catalog
CMS
Lookbook
Company
```

## Authenticated

```text
Profile
Cart
Order
RFQ
Quotation
```

## Privileged

```text
Admin
Finance
Warehouse
Sales
```

## Secret operations

```text
Payment
Webhook
ERP
SMTP
External APIs
```

---

# 61. REQUEST ARCHITECTURE

Public:

```text
User
 ↓
Cloudflare
 ↓
Next.js/cache
 ↓
Supabase
```

Authenticated normal:

```text
User
 ↓
Cloudflare
 ↓
Next.js/Supabase
 ↓
RLS
 ↓
Postgres
```

Sensitive:

```text
User
 ↓
Cloudflare
 ↓
Server / Edge Function
 ↓
Authorization
 ↓
Business Logic
 ↓
Postgres / External API
```

Webhook:

```text
Provider
 ↓
HTTPS endpoint
 ↓
signature verification
 ↓
idempotency
 ↓
database transaction
 ↓
queue
```

---

# 62. DATA CONSISTENCY RULES

Database adalah authoritative source untuk:

```text
Product
Price
Inventory
Order
Payment state
Organization
RFQ
Quotation
```

Browser tidak boleh menjadi authoritative source.

---

# 63. TRANSACTIONAL INTEGRITY

Operasi berikut harus menggunakan database transaction jika membutuhkan atomicity:

```text
create order
reserve stock
create payment record
accept quotation
release inventory
refund order
```

Contoh:

```text
Create Order
+
Create Order Items
+
Reserve Inventory
+
Create Payment
+
Create Outbox Event
```

harus memiliki failure handling yang jelas.

---

# 64. EXTERNAL API RESILIENCE

Midtrans/RajaOngkir/Email Provider dapat mengalami:

```text
timeout
rate limit
temporary failure
duplicate response
delayed response
```

Sistem harus memiliki:

```text
timeout
retry
exponential backoff
idempotency
circuit/failure handling
dead-letter strategy
```

Jangan retry pembayaran secara buta.

---

# 65. PAYMENT RECONCILIATION

Jika status internal berbeda dari provider:

```text
WINAJAYA = PENDING
MIDTRANS = SETTLEMENT
```

sistem harus dapat melakukan reconciliation.

Admin Finance harus mempunyai tool:

```text
Check Payment
Retry Verification
Reconcile
```

Manual reconciliation tidak boleh langsung mengubah database tanpa audit trail.

---

# 66. DATA PRIVACY

Customer data harus diperlakukan sebagai confidential.

Sensitive data meliputi:

* identity;
* address;
* contact;
* business documents;
* payment metadata;
* organization data.

Data collection harus minimal sesuai kebutuhan bisnis.

---

# 67. DOCUMENT ACCESS

Business document access:

```text
request
 ↓
authenticate
 ↓
verify organization membership
 ↓
verify document ownership
 ↓
generate temporary access
```

URL permanent publik tidak boleh digunakan untuk private documents.

---

# 68. FILE SECURITY

Upload harus mempertimbangkan:

* malicious file;
* spoofed MIME type;
* oversized file;
* filename injection;
* executable content;
* malicious SVG;
* duplicate upload;
* unauthorized download.

Critical document pipeline dapat menambahkan asynchronous antivirus/malware scanning.

---

# 69. RATE LIMIT POLICY

Initial logical policy:

```text
Authentication
  strict

Password Reset
  very strict

Checkout
  strict

Payment
  strict

RFQ
  moderate

Public catalog
  high allowance

Admin
  very strict
```

Rate limiting dapat diterapkan pada layer edge dan application.

---

# 70. OBSERVABILITY ALERTS

Alert minimum:

```text
5xx spike
DB CPU/resource saturation
slow query spike
storage failure
payment webhook failure
payment mismatch
queue backlog
email failure
authentication abuse
unusual traffic
```

---

# 71. COST CONTROL

Arsitektur harus menghindari penggunaan service yang tidak diperlukan.

Tidak perlu pada fase awal:

```text
separate VPS
separate PostgreSQL
Redis
Cloudinary
S3
Prisma
Kubernetes
microservice cluster
dedicated search cluster
```

selama kebutuhan tersebut belum muncul.

Namun architecture harus memungkinkan penambahan komponen tersebut tanpa rewrite besar.

---

# 72. SCALABILITY PRINCIPLE

Scaling dilakukan berdasarkan bottleneck.

Jika database bottleneck:

```text
optimize query
→ index
→ cache
→ pooling
→ stronger compute
→ read replicas
```

Jika image bandwidth bottleneck:

```text
CDN
→ resize
→ compression
→ caching
→ object storage scaling
```

Jika Edge Function bottleneck:

```text
remove unnecessary invocation
→ caching
→ queue
→ background processing
→ separate worker
```

Jika search bottleneck:

```text
Postgres
→ dedicated search system
```

Jika analytics bottleneck:

```text
Postgres
→ analytics pipeline
```

---

# 73. HIGH AVAILABILITY STRATEGY

Baseline:

```text
Cloudflare
+
Managed Next.js deployment
+
Supabase production
```

Future:

```text
Database replicas
+
advanced backup
+
regional architecture
+
independent workers
```

High availability harus ditambahkan berdasarkan actual business requirement, bukan hanya karena arsitektur terlihat lebih canggih.

---

# 74. FAILURE SCENARIOS

Sistem harus diuji terhadap:

### Database temporarily unavailable

User mendapatkan safe error.

### Payment provider unavailable

Order tidak dianggap paid.

### Shipping provider unavailable

Checkout menangani failure tanpa corruption.

### Email provider unavailable

Order tetap dapat selesai; email masuk queue/retry.

### Queue consumer down

Message tetap menunggu/retry.

### Webhook datang dua kali

Tidak terjadi double processing.

### User refresh checkout

Tidak membuat duplicate order.

### Stock berubah saat checkout

Transaction gagal dengan predictable response.

---

# 75. ACCEPTANCE CRITERIA SECURITY

Sistem belum boleh dianggap production-ready sebelum:

* RLS aktif dan diuji;
* unauthorized cross-user access ditolak;
* cross-organization access ditolak;
* privileged actions mempunyai authorization;
* service/secret keys tidak muncul di client;
* admin memiliki MFA;
* webhook signature diverifikasi;
* webhook idempotent;
* checkout idempotent;
* rate limiting aktif;
* sensitive files private;
* audit log berjalan;
* production database terpisah dari development;
* backup/recovery strategy diuji.

---

# 76. ACCEPTANCE CRITERIA COMMERCE

Customer harus mampu:

```text
Register
→ Verify Email
→ Login
→ Browse
→ Product
→ Cart
→ Checkout
→ Payment
→ Order
→ Shipment
→ Completion
```

Tanpa manual database operation.

---

# 77. ACCEPTANCE CRITERIA B2B

B2B user harus mampu:

```text
Register
→ Create Organization
→ Submit Business Verification
→ Add Members
→ Create RFQ
→ Receive Quotation
→ Review Revision
→ Accept
→ Convert to Order
```

sesuai permission.

---

# 78. ACCEPTANCE CRITERIA ADMIN

Admin harus mampu:

```text
Manage Product
Manage Variant
Manage Media
Manage Inventory
Manage Order
Manage Customer
Manage Organization
Manage RFQ
Manage Quotation
Manage User
Review Audit Logs
```

sesuai role.

---

# 79. PHASE ROADMAP

# PHASE 0 — FOUNDATION

Prioritas tertinggi.

Deliverables:

```text
Repository
Environment
Supabase
Database migrations
Auth
RBAC
RLS
Storage
Cloudflare
CI/CD
Logging
Error handling
Security baseline
```

Belum fokus pada feature sebanyak mungkin.

---

# PHASE 1 — CATALOG + AUTH + RFQ

Features:

```text
Homepage
Company
Catalog
Product
Category
Lookbook
Register
Login
Profile
Cart
RFQ
Admin catalog
Admin customer
```

Database:

```text
Auth
Catalog
Organizations
RFQ
Audit
Notifications
```

---

# PHASE 2 — FULL COMMERCE

Features:

```text
Checkout
Inventory
Order
Midtrans
Shipping
RajaOngkir
Invoice
Shipment
Payment webhook
Reconciliation
```

Security milestone:

```text
idempotency
transaction integrity
inventory concurrency
webhook verification
```

---

# PHASE 3 — B2B COMMERCE

Features:

```text
Business verification
Multi-tenant organization
Membership
Roles
RFQ
Quotation
Negotiation
Approval workflow
Company pricing
Bulk order
```

---

# PHASE 4 — SCALE + OPERATIONS

Features:

```text
Analytics
ERP integration
Advanced notifications
Advanced search
Automation
Reporting
Customer segmentation
```

Infrastructure:

```text
Queue scaling
Analytics pipeline
Read replicas if needed
Advanced monitoring
DR improvement
```

---

# PHASE 5 — ENTERPRISE

Possible future:

```text
Dedicated search
Dedicated analytics
Dedicated worker
Advanced cache
regional architecture
service decomposition
multi-region
enterprise SSO
advanced compliance
```

Hanya dilakukan berdasarkan kebutuhan nyata.

---

# 80. INITIAL REPOSITORY STRUCTURE

```text
winajaya/
│
├── apps/
│   ├── web/
│   └── admin/
│
├── packages/
│   ├── ui/
│   ├── types/
│   ├── validation/
│   ├── config/
│   └── security/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   │   ├── checkout/
│   │   ├── payment-create/
│   │   ├── payment-webhook/
│   │   ├── shipping/
│   │   ├── refund/
│   │   ├── send-email/
│   │   ├── process-queue/
│   │   └── admin/
│   │
│   └── seed/
│
├── docs/
│   ├── architecture/
│   ├── database/
│   ├── security/
│   ├── api/
│   └── operations/
│
└── tests/
    ├── unit/
    ├── integration/
    ├── security/
    └── e2e/
```

---

# 81. ENVIRONMENT VARIABLES

Client-visible:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=
```

Server-only:

```env
SUPABASE_SECRET_KEY=

MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=

RAJAONGKIR_API_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

EMAIL_PROVIDER_API_KEY=
```

Secret naming dapat disesuaikan dengan provider yang akhirnya dipilih.

---

# 82. SECURITY RULE: NEVER TRUST THE CLIENT

Client boleh mengirim:

```text
intent
selection
quantity
resource ID
```

Client tidak boleh menentukan authoritative:

```text
price
payment result
inventory
order owner
organization owner
permission
refund result
shipment status
```

Server/database selalu menentukan hasil akhir.

---

# 83. CORE ARCHITECTURE

```text
                         INTERNET
                             │
                             ▼
                     ┌──────────────┐
                     │  CLOUDFLARE  │
                     │              │
                     │ CDN          │
                     │ WAF          │
                     │ DDoS         │
                     │ Rate Limit   │
                     └──────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
       ┌─────────────┐             ┌──────────────┐
       │   NEXT.JS   │             │   STORAGE    │
       │             │             │              │
       │ Public Web  │             │ Images       │
       │ Customer    │             │ Documents    │
       │ B2B         │             └──────────────┘
       │ Admin       │
       └──────┬──────┘
              │
      ┌───────┼────────┐
      │       │        │
      ▼       ▼        ▼
    CACHE    AUTH   SENSITIVE
                     │
                     ▼
              ┌──────────────┐
              │ EDGE FUNCTION│
              └──────┬───────┘
                     │
                     ▼
             ┌────────────────┐
             │   POSTGRES     │
             │                │
             │ RLS            │
             │ Transactions   │
             │ Constraints    │
             │ Indexes        │
             └───────┬────────┘
                     │
            ┌────────┼─────────┐
            │        │         │
            ▼        ▼         ▼
          QUEUE   MIDTRANS   RAJAONGKIR
            │
       ┌────┼───────┐
       ▼    ▼       ▼
     EMAIL ERP   ANALYTICS
```

---

# 84. FUNDAMENTAL ARCHITECTURAL RULES

### Rule 1

**Postgres adalah source of truth.**

### Rule 2

**RLS adalah database security boundary.**

### Rule 3

**Browser tidak dipercaya.**

### Rule 4

**Edge Function bukan default backend untuk semua request.**

### Rule 5

**Large files tidak melewati application server.**

### Rule 6

**Payment state hanya dapat berasal dari trusted server/provider verification.**

### Rule 7

**Semua critical operation harus idempotent.**

### Rule 8

**Heavy/non-critical processing bersifat asynchronous.**

### Rule 9

**Private files harus private secara teknis, bukan hanya secara UI.**

### Rule 10

**Admin memiliki security level lebih tinggi daripada customer.**

### Rule 11

**Production dan development harus terpisah.**

### Rule 12

**Scalability harus berasal dari architecture + measurement, bukan sekadar menambah server.**

---

# 85. DEFINITION OF DONE — PRODUCTION

WINAJAYA dianggap siap production apabila:

```text
[ ] Production Supabase project
[ ] Production domain
[ ] Cloudflare configured
[ ] HTTPS
[ ] Database migrations
[ ] RLS audited
[ ] RBAC tested
[ ] MFA admin
[ ] Custom SMTP
[ ] SPF
[ ] DKIM
[ ] DMARC
[ ] Private storage policies
[ ] Image optimization
[ ] Payment integration
[ ] Payment webhook verification
[ ] Idempotency
[ ] Inventory concurrency protection
[ ] Shipping integration
[ ] Queue
[ ] Email retry
[ ] Audit logs
[ ] Monitoring
[ ] Error tracking
[ ] Backup
[ ] Recovery procedure
[ ] Load test
[ ] Security test
[ ] E2E test
[ ] Production deployment procedure
[ ] Rollback procedure
```

---

# 86. FINAL PRODUCT PRINCIPLE

WINAJAYA harus dibangun dengan mentalitas:

```text
Tidak bertanya:

"Bagaimana agar website ini bisa jalan?"

Tetapi:

"Bagaimana agar website ini tetap benar
ketika traffic meningkat,
transaksi bertambah,
request gagal,
provider down,
user melakukan retry,
attacker mencoba mengeksploitasi,
dan data harus dipulihkan?"
```

Target arsitektur WINAJAYA bukan sekadar mempunyai teknologi yang terlihat enterprise.

Targetnya adalah:

```text
CORRECTNESS
+
SECURITY
+
OBSERVABILITY
+
RELIABILITY
+
SCALABILITY
+
OPERABILITY
```

dengan kompleksitas yang ditambahkan hanya ketika memang diperlukan.

---

# 87. TECHNOLOGY DECISION RECORD

| Area                | Keputusan                                     |
| ------------------- | --------------------------------------------- |
| Frontend            | Next.js + TypeScript                          |
| Database            | Supabase PostgreSQL                           |
| Auth                | Supabase Auth                                 |
| Authorization       | RLS + RBAC                                    |
| Storage             | Supabase Storage                              |
| Edge Logic          | Supabase Edge Functions                       |
| Async Processing    | Supabase Queues + workers                     |
| CDN/WAF             | Cloudflare                                    |
| Payment             | Midtrans                                      |
| Shipping            | RajaOngkir                                    |
| Auth SMTP           | Custom SMTP                                   |
| Transactional Email | Email provider                                |
| ORM                 | None by default                               |
| Analytics           | Postgres initially, dedicated analytics later |
| Search              | PostgreSQL initially, dedicated search later  |
| Cache               | CDN/application cache initially               |
| Architecture        | Modular monolith                              |
| Multi-tenancy       | Organization-based                            |
| Deployment          | DEV / STAGING / PROD                          |
| Security            | Defense in depth                              |
| Database Security   | RLS                                           |
| Payment Security    | Signature verification + idempotency          |
| File Security       | Public/private buckets + policies             |
| Audit               | Audit logs                                    |

---

# 88. SUCCESS METRICS

Produk dianggap berhasil apabila:

### Business

* customer dapat membeli tanpa bantuan manual;
* B2B dapat mengirim RFQ;
* admin dapat menghasilkan quotation, melakukan reconciliation, dan memproses order.

### Technical

* tidak terjadi cross-user data access;
* tidak terjadi cross-organization data leak;
* tidak terjadi duplicate order akibat retry;
* tidak terjadi duplicate payment processing;
* tidak terjadi overselling akibat race condition;
* file private tidak dapat diakses unauthorized;
* production dapat dipulihkan melalui recovery procedure;
* system mampu lolos load test yang telah ditetapkan.

### Operational

* error dapat ditelusuri;
* critical operation dapat diaudit;
* payment dapat direconcile;
* queue failure dapat di-retry;
* deployment dapat diulang;
* rollback dapat dilakukan.

---

# 89. PRIORITAS IMPLEMENTASI

Urutan implementasi yang harus diikuti:

```text
1. Infrastructure Foundation
2. Database Schema
3. Authentication
4. RBAC
5. RLS
6. Storage Security
7. Catalog
8. Admin Catalog
9. Cart
10. Inventory
11. Checkout
12. Payment
13. Webhook
14. Shipping
15. Order Operations
16. Email
17. Queue
18. RFQ
19. Quotation
20. B2B Organization
21. Audit
22. Monitoring
23. Load Testing
24. Security Testing
25. Production Hardening
```

**Feature tidak boleh melompati security boundary yang sudah ditentukan.**
