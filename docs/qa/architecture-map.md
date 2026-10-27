# Peta Arsitektur Wina Jaya

Status audit source: 24 Oktober 2026. Dokumen ini membedakan perilaku yang terlihat pada source/migration dari perilaku runtime yang belum diuji.

## Repository dan stack

- Root Git: `D:/WINAJAYA`; aplikasi web: `apps/web`; migrasi database: `supabase/migrations`.
- Aplikasi memakai Next.js App Router di `apps/web/src/app` (35 file `page.tsx`, 50 handler `route.ts`), React client components, dan TypeScript. Tidak ditemukan Pages Router.
- Tidak ditemukan deklarasi Server Action (`'use server'`); mutasi yang diperiksa dilakukan melalui Route Handler dan RPC database.
- Versi lokal: Node 22.23.3, npm 11.6.1, Next.js 16.3.6, React/React DOM 19.2.8, TypeScript 5.9.3, ESLint 9.39.5.
- `apps/web/package-lock.json` adalah lockfile npm. CI yang ada memakai `npm ci`.
- `.github/workflows/ci.yml` sebelumnya hanya menjalankan lint dan build; workflow audit ini menambahkan unit test, typecheck, dan dependency audit.

## Batas lapisan

| Lapisan | Implementasi | Batas akses / data |
|---|---|---|
| Halaman publik | `src/app/page.tsx`, `products/`, `contact/`, `legal/` | Katalog dibaca dari Supabase public client/RLS; konten beranda yang dipublikasikan dibaca server-side. |
| Browser state | `src/lib/cart-context.tsx`, `src/app/HomePageClient.tsx`, dan komponen halaman | Cart disimpan di `localStorage` (`wj_cart_v1`); nama, harga, dan jumlah di browser bukan sumber otoritatif checkout. |
| Auth/session | `src/lib/supabase/client.ts`, `server.ts`, `proxy.ts`, `src/proxy.ts` | Supabase Auth cookie; server membaca user melalui `auth.getUser()`. Proxy memperbarui session untuk halaman yang dicocokkan. |
| RBAC platform | `src/lib/role-access.ts`, `admin-auth.ts`, `super-admin-auth.ts`; layout `/admin` dan `/super-admin` | Server layout dan handler API melakukan pemeriksaan role; data role berasal dari `user_roles` → `roles`. |
| Data pengguna | Supabase server client | Query berjalan memakai session pengguna dan bergantung pada RLS untuk batas row/tenant. |
| Operasi istimewa | `src/lib/supabase/service.ts` dipakai oleh handler server | Service key melewati RLS; setiap jalur harus melakukan authorization server-side sebelum operasi. Source menunjukkan beberapa jalur melakukan ini, tetapi tidak ada environment uji untuk verifikasi dinamis. |
| Database | PostgreSQL, migrasi berurutan `supabase/migrations/*.sql` | Mencakup Auth/profile, role, tenant B2B, katalog/stok, RFQ/quotation, order/pembayaran, audit/outbox, CMS dan RPC transaksional. Status migrasi yang benar-benar terpasang saat audit ini tidak dapat dibaca dari database lokal. |
| File | Supabase Storage | Bucket dokumen B2B/RFQ/order bersifat privat dan memakai policy anggota/partisipan. Gambar katalog/lookbook/brand bersifat publik. |

## Peta route utama

| Area | UI | API / fungsi backend |
|---|---|---|
| Auth dan akun | `/login`, `/register`, `/account`, `/forgot-password`, `/reset-password` | `/api/auth/*`, `/api/account/profile`, `/auth/callback`, `/auth/confirm`; trigger database membuat role dasar `user`. |
| Katalog dan cart | `/products`, `/products/[slug]`, `/cart` | `/api/products`, `/api/products/[slug]`; cart client-side. |
| B2B | `/business`, `/business/orders/[id]/payment`, `/rfq/new` | `/api/business/organizations*`, `/api/business/verification*`, `/api/rfq*`, `/api/quotations*`, `/api/business/bulk-orders*`. |
| Pembelian retail | `/checkout`, `/orders/[id]`, `/payments/[id]` | `/api/shipping/*`, `/api/orders*`, `/api/payments/midtrans*`; order dibuat lewat RPC checkout. |
| Admin | `/admin`, `/admin/products`, `/admin/rfq`, `/admin/orders`, `/admin/customers`, `/admin/operations`, `/admin/governance` | `/api/admin/*`, beberapa jalur lama `/api/finance/*` dan `/api/warehouse/*`; role platform spesialis dipetakan ke Admin pada migrasi. |
| Super Admin/CMS | `/super-admin`, `/super-admin/content/home` | `/api/super-admin/users/[id]/roles`, `/api/super-admin/content/home*`; CMS home memiliki draft, revisions, restore dan publish. `/admin/content/home` mengalihkan ke CMS Super Admin. |
| Worker/integrasi | Tidak ada halaman publik | `/api/internal/*`, Midtrans webhook, health check; memakai secret server-side. Tidak dipanggil dalam audit ini. |

## Data dan alur kepercayaan

1. Signup melewati Supabase Auth; migration role terakhir mengubah role dasar aplikasi menjadi `user`. Role Admin/Super Admin tidak berasal dari metadata browser.
2. `/api/rfq` memeriksa session, validasi Zod, Idempotency-Key, lalu RPC `create_rfq`. Migration 038 menolak RFQ baru tanpa organisasi terverifikasi dan membership owner/admin/buyer.
3. Admin membuat quotation melalui RPC; user merespons lewat RPC dengan RLS. Persetujuan B2B mengarah ke bulk order, bukan order retail.
4. `/api/orders` mengharuskan user masuk, menerima quote pengiriman dan item, lalu memanggil `create_checkout_order_with_idempotency_guard`. Fungsi SQL memakai advisory lock dan membandingkan hash untuk replay key yang sama.
5. Pembayaran memakai Midtrans; webhook memeriksa signature dan meneruskan hasil ke RPC database. Sandbox/live yang benar-benar dikonfigurasi saat ini tidak diverifikasi.
6. CMS home memakai service role setelah pemeriksaan Super Admin/MFA dan RPC yang memeriksa actor. Draft dipublikasikan melalui aksi terpisah dan cache beranda direvalidasi.

## Tool REA

Tool REA terdaftar di sesi. Analisis direktori JavaScript terbatas pada file auth/RBAC/RFQ/order/CMS berjalan lebih dari empat menit tanpa mengembalikan evidence, lalu dihentikan. Karena tidak ada hasil evidence, peta di atas berasal dari source dan SQL yang dibaca langsung; tidak ada klaim runtime REA.

## Batas kepastian

- Tidak ada container Docker aktif/tersedia dan tidak ada credential environment `SUPABASE_TEST_*`; data dan status migration runtime tidak diverifikasi.
- File `.env*` diabaikan Git dan tidak dibaca. Next.js memuat file `.env*` sendiri; build lokal tidak dijalankan karena halaman home dapat melakukan query ke Supabase yang dikonfigurasi.
- Isi `docs/operations/task-status.md` adalah catatan historis operator, bukan bukti runtime audit tanggal ini.
