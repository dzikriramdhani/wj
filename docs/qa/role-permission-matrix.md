# Matriks Role dan Permission

Ini adalah kebijakan yang terlihat dari source dan migration terakhir, bukan bukti role assignment yang aktif pada database remote.

## Role platform

| Role | Halaman | Operasi yang terlihat di source | Ditolak / dibatasi | Status bukti |
|---|---|---|---|---|
| `user` | `/account`, `/business`, `/orders`, storefront, checkout | Profil sendiri, organisasi tempat ia menjadi anggota, RFQ verified organization, lihat/respons quotation sendiri, order milik sendiri | Tidak memenuhi `requireAdminUser`/`requireSuperAdminUser`; tidak dapat mengubah status RFQ melalui RPC staff; tidak dapat memberi role | Pemeriksaan route/RPC statis; tes lintas user BLOCKED |
| `admin` | `/admin` | Katalog, harga/kategori/lookbook, verifikasi perusahaan, RFQ/quotation, order, pembayaran, fulfillment, customer, operasi dan governance | Tidak dapat mengelola role platform; CMS homepage dikeluarkan dari permission Admin pada migration 036; MFA wajib di production atau saat `ADMIN_MFA_REQUIRED=true` | Pemeriksaan route/migration; tes runtime BLOCKED |
| `super_admin` | `/super-admin`, `/admin` | Operasi Admin, CMS home, grant/revoke role Admin/Super Admin | MFA AAL2 setiap sesi; RPC role melindungi Super Admin terakhir dan menyimpan audit log | Pemeriksaan route/migration; tes runtime BLOCKED |
| Anonim | Homepage, katalog publik, contact/legal | Membaca konten/katalog publik dan mengirim contact request sesuai route | Tidak dapat membaca akun atau menulis RFQ/order; API privat mengembalikan penolakan sesuai auth | Tidak ada API/E2E test |

### Runtime anonymous evidence (production, GET tanpa cookie)

| Request | Hasil teramati | Status |
|---|---|---|
| `GET /admin`, `GET /super-admin` | 307 ke login; response `no-store` | PASS untuk anonymous saja |
| `GET /api/account/profile`, fake order ID | 401; body error-only | PASS untuk anonymous saja |
| `GET /api/admin/search`, `GET /api/super-admin/content/home` | 403; body error-only | PASS untuk anonymous saja |
| `GET /api/auth/login`, `/api/rfq`, `/api/orders`, `/api/business/organizations` | 405 untuk method yang tidak didukung | PASS untuk method gate saja |

Local standalone build setelah perbaikan cache mengulang empat API privat dan dua halaman dashboard: 401/403/307 dengan `private, no-store` atau redirect no-store. Playwright mengulang direct dashboard navigation untuk anonymous. Admin/Super Admin page juga sekarang memeriksa role/MFA sebelum service-role queries. Tidak ada operasi authenticated/role-specific yang dicoba.

## Membership B2B (bukan role platform)

| Membership | Kapabilitas source | Batas |
|---|---|---|
| `owner` | Kelola anggota, submit dokumen verifikasi, membuat/menyetujui quotation | Organisasi yang sama |
| `admin` | Kelola anggota non-owner dan submit dokumen; respons quotation | Organisasi yang sama; tidak mengambil alih owner |
| `buyer` | Membuat RFQ organisasi terverifikasi | Tidak mendapat portal Admin |
| `viewer` | Melihat data organisasi | Tidak membuat RFQ/mengelola anggota |

Migration `202610210038_rfq_verified_organization_required.sql` mewajibkan status organisasi `verified` dan membership `owner/admin/buyer` pada insert RFQ. Storage policy memfilter objek dokumen berdasarkan organisasi di path. Kedua hal ini belum diuji terhadap database aktif.

## Backend checks

- `src/lib/role-access.ts` mengambil role dari `user_roles`/`roles`, memvalidasi nama terhadap `user`, `admin`, `super_admin`, dan tidak membaca role dari body/cookie browser.
- `/admin` dan `/super-admin` memeriksa role di server layout. Proxy memperbarui sesi tetapi bukan satu-satunya lapisan otorisasi.
- API admin memanggil `requireAdminUser`; API super-admin memanggil `requireSuperAdminUser`. Role update route menerima hanya `admin` atau `super_admin` dan mengirim `actor.id` hasil auth ke RPC.
- Migration role terakhir membatasi `set_platform_user_role` hanya untuk `service_role`; fungsi memeriksa actor super-admin, target, role yang diperbolehkan, jumlah Super Admin terakhir, dan menulis `audit_logs`.
- Data user memakai server Supabase client/session agar RLS diterapkan. Route yang memakai service role harus tetap memeriksa actor dahulu.

## Kasus yang belum diuji

| Kasus | Status |
|---|---|
| Direct URL `/admin` dan `/super-admin` sebagai anonymous | PASS terbatas — live GET dan local Playwright memberi redirect ke login; role terautentikasi tetap BLOCKED |
| API admin/super-admin tanpa auth | PASS terbatas — live GET memberi 403 tanpa data; role terautentikasi tetap BLOCKED |
| Request role/body/cookie dimanipulasi | BLOCKED; source menunjukkan schema ketat dan actor dari sesi |
| Session expired, invalid, akun dinonaktifkan, role dicabut saat session aktif | BLOCKED |
| User B membaca profil, RFQ, quotation, file, atau order User A | BLOCKED — RLS static only |
| Admin mengubah role / membuka CMS; Super Admin MFA | BLOCKED — source policy terlihat, runtime tidak |
| Permission bisnis Admin granular | UNKNOWN — source memberi satu role Admin operasional luas; pemisahan per capability tidak tampak pada API role saat ini |

## Keputusan target

Dokumen operasi repository menyatakan Admin menjalankan seluruh operasi internal, sedangkan role platform dan CMS hanya Super Admin. Pemetaan ini mengikuti dokumentasi tersebut. Pemilik bisnis tetap perlu menyetujui bila Admin seharusnya dibatasi per tugas atau per data customer sebelum kebijakan itu diuji sebagai target.
