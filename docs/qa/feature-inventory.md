# Inventaris Fitur

Status implementasi disimpulkan dari halaman, API, helper, dan migration yang ada. Status runtime berarti tes dengan database/akun nyata yang terisolasi; audit ini tidak memiliki environment tersebut.

| Fitur | Route / komponen | Backend dan data | Role / kontrol source | Tes sekarang | Status |
|---|---|---|---|---|---|
| Katalog publik | `/products`, `/products/[slug]` | `/api/products*`, tabel katalog, public Supabase client | Produk aktif/published dibaca lewat RLS | Tidak ada E2E/API test | Implemented; runtime BLOCKED |
| Cart | `/cart`, `src/lib/cart-context.tsx` | `localStorage`; harga/jumlah dapat diubah client | Belum memerlukan login untuk mengisi cart | Tidak ada component test | Implemented; hitungan browser belum diuji. Checkout tidak mempercayai harga client |
| Auth dan sesi | `/login`, `/register`, logout, callback, recovery | Supabase Auth; profile/role trigger; rate limit reset tersimpan di DB | `auth.getUser`, callback allowlist, cookie refresh | Unit recovery/password, URL, sanitizer | Sebagian PASS; login/session expiry runtime BLOCKED |
| Profil/MFA | `/account`, `/api/account/profile` | `profiles`, role assignment, MFA TOTP Supabase | Data akun sendiri; Admin MFA berdasarkan environment, Super Admin selalu AAL2 | Tidak ada tes API | Implemented; runtime BLOCKED |
| Buku alamat | Tidak ditemukan route/API tersendiri | Checkout menerima snapshot alamat | Validasi alamat ada pada payload checkout | Tidak ada | Pengelolaan alamat tersimpan NOT IMPLEMENTED |
| Perusahaan B2B | `/business` | `/api/business/organizations`, memberships, organizations, verification request | Owner/admin/buyer/viewer dalam tenant organisasi | RFQ schema unit saja | Create/manage tersedia; isolasi lintas perusahaan runtime BLOCKED |
| Verifikasi perusahaan | UI `BusinessClient`; `/api/business/verification*` | Upload dokumen privat, submit/review RPC, status pending/verified/rejected/suspended | Owner/admin perusahaan submit; Admin/Super Admin review | Signature helper unit; tidak ada DB test | Implemented; approval workflow runtime BLOCKED |
| RFQ | `/rfq/new`, `/admin/rfq` | `/api/rfq*`, `rfqs`, `rfq_items`, attachments, idempotency, audit | User harus memiliki membership organisasi verified; status write memakai RPC staff | Validasi schema unit; signature unit | Implemented; status/IDOR/runtime workflow BLOCKED |
| Quotation/negosiasi | `/business`, `/admin/rfq` | `/api/quotations*`, revision, messages, approvals, bulk order | Admin membuat/mengirim; user merespons; RLS membatasi tenant | Tidak ada integration test | Implemented; masa berlaku/concurrency BLOCKED |
| Order retail | `/checkout`, `/orders/[id]` | `/api/orders*`, quote ongkir, order/items, inventory reservations, invoice/shipment | POST checkout memerlukan user; lookup memakai owner user atau guest-session UUID | Tidak ada checkout test | Implemented source; integritas transaksi runtime BLOCKED |
| Pembayaran | `/payments/[id]`, B2B payment | Midtrans create/custom checkout, webhook signature/RPC, QR/payment instructions | Payment/order RPC dan webhook server-side | Tidak ada sandbox test | Implemented; sandbox/status/replay runtime BLOCKED |
| Refund/pembatalan | Tidak ditemukan API refund/cancel eksplisit | Tidak ditemukan workflow refund yang bisa dibuktikan dari route inventory | Tidak dapat dipastikan di provider | Tidak ada | NOT IMPLEMENTED di repo yang diperiksa |
| Admin katalog/operasi | `/admin/products`, orders, operations, customers, governance | `/api/admin/*`; RPC untuk katalog, kategori, harga, fulfillment, governance | `requireAdminUser`, mencakup Admin dan Super Admin; role spesialis lama dipetakan ke Admin | Tidak ada tes role/API | Implemented; role-negatif runtime BLOCKED |
| Super Admin dan akun | `/super-admin` | Daftar profil/Auth user; `/api/super-admin/users/[id]/roles` → `set_platform_user_role` | `requireSuperAdminUser`, MFA; RPC hanya service_role dan memeriksa actor; melindungi Super Admin terakhir | Tidak ada tes role | Implemented source; role change runtime BLOCKED |
| CMS homepage | `/super-admin/content/home`; route Admin lama redirect | `/api/super-admin/content/home*`, `cms_home_pages`, revisions, publish RPC | Super Admin + MFA; migration mencabut permission Admin | Tidak ada tes schema/publish | Implemented; draft/public visibility runtime BLOCKED |
| Worker/ERP/email | Tidak ada UI | `/api/internal/*`, cron auth, outbox, ERP sync, expiration worker | Secret worker / service role | Tidak ada test suite | Implemented source; external integration NOT RUN |
| Upload file | Business docs, RFQ attachments, catalog/lookbook/CMS assets | Private/public Supabase Storage buckets, DB metadata/audit | Membership atau role server-side; MIME + signature file diperiksa source | Tes signature file unit | Implemented; storage policy/runtime blocked |

## Fitur yang belum dapat diverifikasi

- Tidak ada akun uji User/Admin/Super Admin yang aman, database lokal, fixtures lintas tenant, atau test harness provider.
- Tidak ada source test untuk akses halaman/API langsung, session kedaluwarsa/nonaktif, IDOR, method mismatch, webhook duplicate, concurrency checkout, atau stok race.
- README menyebut UI upload belum tersedia, tetapi `BusinessClient` dan halaman RFQ sekarang memiliki kontrol upload; README tersebut tidak sesuai source saat ini.
- Integrasi retur/refund, cancellation retail, dan pengelolaan alamat tersimpan tidak ditemukan dalam route/API lokal.
- Copy upload aset CMS sebelumnya mencantumkan AVIF walau endpoint dan bucket menerima JPEG/PNG/WebP saja; copy endpoint diselaraskan dengan format yang benar-benar didukung.
