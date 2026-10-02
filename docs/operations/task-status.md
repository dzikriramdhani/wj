# WINAJAYA task status

Status ini mengikuti roadmap di [PRD.md](../../PRD.md).

**Diperbarui:** 2 Oktober 2026. Audit produksi menempatkan PRD sebagai patokan. Database dan konfigurasi aplikasi kini berada pada tahap STAGING; peluncuran publik hanya dapat memakai proyek Supabase PRODUCTION terpisah, Midtrans production, dan seluruh bukti pengujian PRD.

## Status akses platform

- [x] Role aktif disederhanakan menjadi `user`, `admin`, dan `super_admin`.
- [x] Sales, Finance, Warehouse, dan Content Admin dipindahkan menjadi kemampuan Admin.
- [x] Admin memiliki satu portal di `/admin`: produk, lookbook, RFQ/B2B, pembayaran, fulfillment, customer, operasi, dan governance.
- [x] Super Admin hanya mengelola akses platform, governance, dan seluruh area kerja Admin dari `/super-admin`.
- [x] Membership organisasi B2B tetap terpisah: `owner`, `admin`, `buyer`, `viewer`.
- [x] URL portal lama mengarahkan ke area Admin yang sesuai agar bookmark lama tidak memecah akses pengguna.
- [x] `202609300023_add_user_platform_role.sql` sampai `202609300025_simplify_catalog_admin_authorization.sql` telah diterapkan ke proyek Supabase yang dipakai peluncuran ini.

## Phase 0 — Foundation

- [x] Next.js, TypeScript, Supabase Auth, PostgreSQL, Storage, RLS, role assignment, audit record, security headers, dan secret server-side telah tersedia.
- [x] Trigger akun baru memberi role `user`; migration memindahkan assignment internal lama ke `admin`.
- [x] Batas tenant organisasi B2B dan membership dijaga oleh database serta RLS.
- [x] Proyek Supabase STAGING `winajaya_staging` sudah terpisah dari DEV dan menerima migration `001`–`025`.
- [x] Key Supabase STAGING, Midtrans Sandbox, RajaOngkir API key, SMTP, origin, bobot, dan scheduler STAGING telah diisi; koneksi Supabase serta preflight tervalidasi.
- [ ] Ganti `NEXT_PUBLIC_APP_URL` placeholder dengan domain HTTPS STAGING yang telah dideploy, lalu gunakan domain itu pada Supabase Auth dan webhook Midtrans Sandbox.
- [x] Origin RajaOngkir STAGING telah diverifikasi melalui Search Domestic Destination: ID `5190` untuk Cijagra, Paseh, Kabupaten Bandung, Jawa Barat 40383. Bobot serta `CRON_SECRET` telah melewati preflight.
- [ ] Pindahkan secret dari `.env.staging.example` ke `.env.staging` yang diabaikan Git atau secret store hosting, lalu kosongkan kembali file template.
- [ ] Pada domain publik: Cloudflare/TLS, custom SMTP, scheduler `CRON_SECRET`, URL webhook Midtrans production, backup/PITR, error tracking, dan monitoring.

## Phase 1 — Catalog, Auth, dan RFQ

- [x] Storefront lama dipertahankan: homepage, company, katalog, kategori, keranjang, login/register, akun, contact, dan RFQ.
- [x] Admin mengelola produk, harga, stok, variasi, gambar, dan lookbook dari satu portal.
- [x] Password recovery, profil, notifikasi akun, contact message, RFQ attachment, dan transactional email outbox sudah tersedia.
- [x] Katalog DEV berisi data sintetis yang dapat diedit.
- [ ] Ganti produk, gambar, copy legal/perusahaan, SKU, harga, stok, bobot produk, dan konfigurasi gudang dengan data bisnis sebenarnya.

## Phase 2 — Commerce

- [x] Checkout idempotent, reservation stok, order tracking, invoice, shipment workflow, reconciliation pembayaran, dan fulfillment tersedia.
- [x] Checkout menyimpan keranjang saat refresh, mengisi data akun bila sudah masuk, memvalidasi MOQ dan ongkir server-side, lalu memberikan jalur retry Midtrans.
- [x] RajaOngkir DEV dan Midtrans Sandbox Snap/webhook idempotent terhubung lewat konfigurasi environment.
- [ ] Konfigurasi origin, courier, bobot SKU/kemasan, dan secret scheduler telah ada. Deploy STAGING lalu buktikan checkout dan webhook Midtrans Sandbox. Gunakan key Midtrans production hanya di PRODUCTION setelah bukti STAGING disetujui.

## Phase 3 — B2B commerce

- [x] User dapat membuat organisasi, menjadi owner, unggah dokumen, dan mengirim verifikasi dari `/business`.
- [x] Owner/Admin perusahaan dapat menambah, mengubah, dan menghapus anggota tanpa menghapus owner terakhir.
- [x] Admin menangani RFQ, quotation, verifikasi B2B, dan harga perusahaan dari portal Admin.
- [x] RFQ, quotation revision, negotiation message, approval, bulk order, audit entry, database function, dan RLS sudah tersedia.
- [ ] Buat organisasi nyata, daftarkan anggotanya, dan lakukan satu alur RFQ hingga quotation dengan data bisnis sebelum go-live.

## Phase 4 — Operasi dan skala

- [x] Admin → Operasi menampilkan agregat transaksi/RFQ, segmentasi customer, outbox, ERP sync, pencarian terikat scope, verifikasi perusahaan, dan harga perusahaan.
- [x] Worker menangani analytics harian, segmentasi, outbox retry, serta job ERP idempotent.
- [ ] Siapkan scheduler operasi, receiver/secrets ERP bila digunakan, uptime/error alert, dan capacity monitoring sebelum production.

## Phase 5 — Enterprise readiness

- [x] Permission catalog, audit before/after, source IP/user-agent, governance, serta server/database authorization tersedia.
- [x] Super Admin selalu membutuhkan Supabase AAL2 MFA; Admin juga wajib AAL2 ketika aplikasi berjalan di production.
- [x] **Akun Saya → Verifikasi dua langkah** mendukung enrollment dan verifikasi TOTP.
- [x] Super Admin dapat memberi/mencabut Admin atau Super Admin dengan audit dan perlindungan Super Admin terakhir.
- [ ] SAML/OIDC, universal Admin MFA, policy retention/legal, layanan search/analytics/worker terpisah, dan multi-region memerlukan provider serta kebutuhan production yang terukur.

## Role map

| Model | Role | Portal / tanggung jawab |
| --- | --- | --- |
| Platform | `user` | Storefront, Account, order/RFQ sendiri, dan portal B2B bila menjadi anggota. |
| Platform | `admin` | `/admin`: seluruh pekerjaan internal operasional. |
| Platform | `super_admin` | `/super-admin`: role platform, governance, dan akses operasi Admin. MFA wajib. |
| B2B organisasi | `owner` / `admin` | Mengelola perusahaan, verifikasi, quotation, dan anggota sesuai batas role. |
| B2B organisasi | `buyer` | Membuat RFQ perusahaan terverifikasi. |
| B2B organisasi | `viewer` | Melihat informasi perusahaan. |

`admin` platform dan `admin` organisasi B2B adalah dua role yang berbeda. Keduanya tidak saling memberikan akses.

## Yang perlu disiapkan sekarang

1. Daftarkan akun internal melalui alur akun biasa.
2. Bootstrap satu Super Admin dengan SQL pada [first-admin.md](first-admin.md), aktifkan MFA, lalu beri `admin` kepada operator internal.
3. Buat organisasi dan membership B2B nyata dari `/business` bila workflow B2B akan digunakan.
4. Isi katalog nyata lewat **Admin → Produk** dan **Admin → Lookbook**.
5. Tetapkan `RAJAONGKIR_ORIGIN_ID`, courier, bobot SKU, dan berat kemasan di environment deployment.
6. Buat proyek Supabase PRODUCTION yang kosong dan terpisah; terapkan migration, bucket/policy, Auth redirect, serta bootstrap Super Admin hanya pada proyek itu.
7. Uji Sandbox di STAGING sampai checkout, webhook, fulfillment, email worker, dan reservation expiry terbukti berjalan. Catat hasil security, E2E, load, dan restore test.
8. Siapkan Midtrans production, RajaOngkir origin/courier/berat sebenarnya, custom SMTP beserta SPF/DKIM/DMARC, Cloudflare, scheduler, backup/PITR, monitoring, dan error tracking.
9. Deploy domain HTTPS dengan secret production, webhook Midtrans production, dan scheduler. Jalankan `npm run preflight:production -- .env.production` sampai lulus sebelum DNS cutover.

## Cara mengubah data operasional

- **Role platform:** bootstrap pertama melalui SQL, lalu gunakan **Super Admin → Pengguna & role**.
- **Membership B2B:** **Akun Saya → Portal Perusahaan → Kelola anggota**.
- **Produk:** **Admin → Produk** untuk SKU, harga, stok, bobot, variasi, dan gambar.
- **Lookbook:** **Admin → Lookbook** untuk mengunggah atau menghapus gambar.
- **Shipping:** ubah environment `RAJAONGKIR_ORIGIN_ID`, `RAJAONGKIR_ORIGIN_SEARCH`, `RAJAONGKIR_COURIERS`, `SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER`, dan `SHIPPING_PACKAGING_WEIGHT_GRAMS`, lalu restart aplikasi.
- **Midtrans:** gunakan `MIDTRANS_IS_PRODUCTION=false` beserta key Sandbox hanya di DEV/STAGING. Gunakan `true` bersama key production yang cocok di secret store PRODUCTION.
