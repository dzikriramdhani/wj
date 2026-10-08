# WINAJAYA task status

Status ini mengikuti [PRD.md](../../PRD.md) dan rencana eksekusi [PRD-LANJUTAN-STAGING-PRODUCTION.md](../../PRD-LANJUTAN-STAGING-PRODUCTION.md).

**Diperbarui:** 8 Oktober 2026. Validasi teknis STAGING selesai. Fondasi database PRODUCTION menggunakan project Supabase `winajaya` yang dipisahkan dari STAGING dan dibangun ulang tanpa data DEV. Integrasi pembayaran dan ongkir pada deployment publik tetap menggunakan mode Sandbox atas keputusan owner.

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
- [x] Audit RLS STAGING membuktikan User A dapat membaca order dan profil sendiri, sedangkan User B tidak menerima data milik A.
- [x] Audit RLS STAGING membuktikan owner organisasi dapat membaca organisasi dan membership sendiri, sedangkan organisasi lain tidak menerima data tersebut.
- [x] Audit private Storage STAGING membuktikan owner dapat unggah dan membaca `business-documents`, sedangkan pengguna lain dan anon ditolak. Migration `202610040027_fix_business_document_read_policy.sql` memperbaiki policy baca owner.
- [x] Proyek Supabase STAGING `winajaya_staging` sudah terpisah dari DEV dan menerima migration `001`–`029`.
- [x] Key Supabase STAGING, Midtrans Sandbox, RajaOngkir API key, SMTP, origin, bobot, dan scheduler STAGING telah diisi; koneksi Supabase serta preflight tervalidasi.
- [x] Konfigurasi Auth URL dan Midtrans Sandbox notification URL dari [staging-manual-setup.md](staging-manual-setup.md) telah dikonfirmasi oleh pemilik project; endpoint webhook menerima notifikasi signed pada domain STAGING.
- [x] `NEXT_PUBLIC_APP_URL` telah menggunakan domain HTTPS STAGING yang valid dan dapat di-resolve DNS; build STAGING lulus.
- [x] Endpoint pemantauan `GET /api/health` tersedia tanpa membocorkan secret atau data pengguna; worker scheduler menerima `GET` dan `POST` dengan otorisasi bearer `CRON_SECRET`.
- [x] Audit HTTPS STAGING memverifikasi CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, dan Referrer Policy; worker email tanpa bearer menerima `401`.
- [x] Project Vercel `wj-staging` memakai Next.js dan Node.js 22; deployment `dpl_9oUPwCcP2ZTKHN4Ez8Poq2YGKNkA` aktif di `https://wj-staging.vercel.app`, dengan health check lulus.
- [x] SSO Deployment Protection sudah dinonaktifkan hanya pada project `wj-staging`, sehingga domain STAGING dapat menerima webhook, monitor uptime, dan akses akun uji.
- [x] `.vercelignore` mengecualikan `.env` dan `.env.*`; environment runtime berasal dari Vercel, bukan dari file lokal yang diunggah saat build.
- [x] Restore test STAGING memulihkan data aplikasi dan `auth.users` ke proyek Supabase sementara terisolasi. Migration `29` serta jumlah 12 akun/profil, 1 produk, 8 pesanan, dan 6 organisasi sama dengan sumber; RPO 0 menit dan RTO di bawah 2 menit. Dump lokal dan proyek sementara sudah dihapus.
- [x] Integrasi error tracking Sentry tersedia untuk browser, server, Midtrans webhook, checkout, quote ongkir, dan worker. Integrasi aktif hanya setelah DSN STAGING dipasang di Vercel; tidak ada request body atau data pelanggan yang ditambahkan oleh kode aplikasi.
- [x] Sentry project `winajaya-staging` memakai DSN di Vercel dengan environment `staging`. Deployment `9aa477d` aktif dan menunggu pengiriman event sebelum respons error dikembalikan oleh serverless.
- [x] Alert Sentry `Notify dzikriramdhani` ditetapkan untuk akun `dzikriramdhani24@gmail.com`. Error JSON terkontrol tanpa data pelanggan menghasilkan issue `WINAJAYA-STAGING-1` dan alert tercatat terpicu pada 7 Oktober 2026.
- [x] Origin RajaOngkir STAGING telah diverifikasi melalui Search Domestic Destination: ID `5190` untuk Cijagra, Paseh, Kabupaten Bandung, Jawa Barat 40383. Bobot serta `CRON_SECRET` telah melewati preflight.
- [x] Secret STAGING berada pada `.env.staging` yang diabaikan Git. Secret yang sama harus dimasukkan ke secret store hosting saat deployment.
- [x] Project Supabase PRODUCTION `winajaya` (`qcgcpheeskkdcnxspbgx`) telah direset tanpa backup sesuai persetujuan owner, tanpa seed DEV. Seluruh 26 migration, 6 bucket, dan policy telah dibangun ulang; data Auth, produk, pesanan, organisasi, serta objek Storage bernilai nol.
- [x] Vercel project `wj` memakai URL dan key project Supabase PRODUCTION. Domain deployment yang dipilih adalah `https://wj-wine.vercel.app`.
- [x] Supabase Auth PRODUCTION memakai Site URL serta redirect URL `https://wj-wine.vercel.app`. Email confirmation dan enrollment/verifikasi TOTP yang telah aktif pada project dipertahankan.
- [x] Smoke test deployment PRODUCTION lulus: `GET /api/health` memberi HTTP 200 dengan status `ok`, sedangkan katalog publik memberi HTTP 200 dan total produk 0. Route health hanya memeriksa ketersediaan Supabase tanpa mengeluarkan data atau secret.
- [x] Project Sentry `winajaya-production` dibuat. DSN tersimpan hanya di Vercel `wj` Production sebagai `SENTRY_DSN` dan konfigurasi browser `NEXT_PUBLIC_SENTRY_DSN`; deployment `dpl_9E8q1cheRFN7ghTHR6LffUTTFDAt` berstatus Ready dan memakai alias `https://wj-wine.vercel.app`.
- [x] Alert email Sentry Production diperbarui untuk issue baru. Dua error uji tanpa data pelanggan menghasilkan issue `WINAJAYA-PRODUCTION-1` dan `WINAJAYA-PRODUCTION-2`; halaman riwayat alert mencatat dua trigger. Perbaikan pelaporan parsing webhook dan inisialisasi Sentry server aktif melalui deployment dari commit `18b5ee5`.
- [x] Workflow GitHub Actions production menjalankan health, reservation expiry, dan operations tiap lima menit. GitHub Environment `production` dibatasi ke branch `main`; secret khusus `SCHEDULER_CRON_SECRET` hanya diterima reservation expiry dan operations.
- [x] Run production `37736188644` pada 8 Oktober 2026 lulus untuk ketiga job: health check, expire reservations, dan process operations. Bukti: https://github.com/dzikriramdhani/wj/actions/runs/37736188644.
- [ ] Gate domain publik yang tersisa: lihat checklist rinci berikut. “Menunggu bukti” berarti checklist belum dicentang karena hasil pada Production belum direkam; itu tidak selalu berarti pengaturannya belum pernah diisi.

### Checklist gate Production Sandbox

| Gate | Status | Tindakan dan bukti untuk menutup gate |
| --- | --- | --- |
| Webhook Midtrans Sandbox publik | Perlu konfirmasi owner dan uji | Di Midtrans **Sandbox → Settings → Configuration**, pastikan Notification URL tepat `https://wj-wine.vercel.app/api/payments/midtrans/webhook` dan tidak redirect. Lakukan satu checkout Sandbox setelah produk uji tersedia. Bukti: transaksi Sandbox sukses/pending tercatat, webhook diterima di Vercel/Sentry tanpa error, dan status order/payment pada WINAJAYA cocok. Jangan gunakan Production key/dashboard. |
| SMTP dan DNS email | Perlu verifikasi Production | Di Supabase project `winajaya`, periksa **Authentication → Emails → SMTP Settings** memakai provider SMTP Anda; cocokkan alamat pengirim dengan domain yang telah diverifikasi provider. Di registrar/DNS domain pengirim, pasang record SPF, DKIM, dan DMARC persis seperti yang diberikan provider. Kirim email konfirmasi atau reset ke inbox uji yang disetujui dan pastikan diterima. Catat provider, domain pengirim, waktu, dan hasil; jangan catat password SMTP. Domain website `wj-wine.vercel.app` tidak memberi akses untuk mengubah DNS-nya. |
| Backup dan PITR Production | Belum dibuktikan | Pada Supabase `winajaya`, buka **Database → Backups** untuk memastikan backup yang tersedia dan retensinya; tinjau **Project Settings → Add-ons / Point in Time Recovery** untuk opsi PITR dan biayanya. Jika perlu mengaktifkan paket berbayar, owner memilih/menyetujui paket di dashboard. Setelah tersedia, lakukan restore drill ke project Supabase sementara yang terpisah—jangan restore menimpa `winajaya`—lalu catat waktu, migration, hasil smoke/RLS, RPO, dan RTO. |
| Super Admin Production | Belum dibuat | Owner mendaftarkan akun operator pilihan di `https://wj-wine.vercel.app/register` dan menyelesaikan verifikasi email. Dari Supabase `winajaya` → **SQL Editor**, ambil UUID akun dari `auth.users`, lalu jalankan prosedur di [first-admin.md](first-admin.md) dengan UUID tersebut. Login kembali, daftarkan TOTP di **Akun Saya → Verifikasi dua langkah**, lalu pastikan `/super-admin` bisa dibuka. Jangan kirim password atau secret lewat chat. |
| Katalog bisnis Production | Belum diisi (katalog saat ini kosong) | Owner menyiapkan produk resmi: nama, SKU, deskripsi, harga, stok, MOQ, berat kirim dalam gram, gambar yang berhak dipakai, dan status tampil. Setelah Super Admin/Admin tersedia, masukkan lewat **Admin → Produk** dan gambar melalui **Admin → Lookbook** bila diperlukan. Untuk webhook test, gunakan satu item yang jelas ditandai sebagai produk uji dan stok uji; jangan tampilkan barang/harga yang belum disetujui. |
| RajaOngkir Sandbox/uji publik | Perlu verifikasi Production | Owner/Operator melakukan quote ongkir dari checkout publik setelah item uji dibuat; pastikan origin `5190`, courier uji yang diaktifkan, alamat tujuan, dan bobot kemasan/SKU menghasilkan layanan serta tarif. Catat courier, tujuan uji, dan hasil quote tanpa data pribadi berlebih. Jangan anggap tarif uji sebagai tarif live. |
| Transaksi Sandbox Production | Menunggu prasyarat | Setelah webhook, produk uji, dan ongkir uji siap, owner jalankan checkout di `https://wj-wine.vercel.app` menggunakan alur/metode Sandbox Midtrans. Verifikasi callback, order/payment, invoice, reservasi stok, dan log tanpa mengirim barang. Bukti ini hanya validasi teknis; tidak menunjukkan bahwa pembayaran live siap. |
| Hypercare 24 jam | Menunggu transaksi uji | Mulai setelah transaksi Sandbox Production lulus. Selama 24 jam owner memantau deployment/domain, Sentry `winajaya-production`, GitHub Actions scheduler, Supabase health/usage, dan webhook/queue; catat waktu pemeriksaan dan insiden. Tutup gate bila tidak ada blocker critical/high atau semua insiden sudah ditangani. |

**Yang perlu dilakukan owner berikutnya:** konfirmasi Notification URL di Midtrans Sandbox; tentukan/verifikasi SMTP serta domain pengirim; tinjau opsi backup/PITR dan biaya Supabase; daftarkan akun operator untuk Super Admin; siapkan data satu produk uji dan data produk resmi. Setelah itu verifikasi quote RajaOngkir, jalankan transaksi Sandbox, lalu mulai hypercare 24 jam.

## Phase 1 — Catalog, Auth, dan RFQ

- [x] Storefront lama dipertahankan: homepage, company, katalog, kategori, keranjang, login/register, akun, contact, dan RFQ.
- [x] Admin mengelola produk, harga, stok, variasi, gambar, dan lookbook dari satu portal.
- [x] Password recovery, profil, notifikasi akun, contact message, RFQ attachment, dan transactional email outbox sudah tersedia.
- [x] Koneksi SMTP dan satu pengiriman email verifikasi STAGING ke inbox yang disetujui berhasil. Worker outbox tetap dinonaktifkan sampai semua penerima pending disetujui.
- [x] Katalog DEV berisi data sintetis yang dapat diedit.
- [ ] Ganti produk, gambar, copy legal/perusahaan, SKU, harga, stok, bobot produk, dan konfigurasi gudang dengan data bisnis sebenarnya.

## Phase 2 — Commerce

- [x] Checkout idempotent, reservation stok, order tracking, invoice, shipment workflow, reconciliation pembayaran, dan fulfillment tersedia.
- [x] Checkout menyimpan keranjang saat refresh, mengisi data akun bila sudah masuk, memvalidasi MOQ dan ongkir server-side, lalu memberikan jalur retry Midtrans.
- [x] RajaOngkir dan Midtrans Sandbox Snap terhubung lewat konfigurasi STAGING; HTTP end-to-end membuktikan quote ongkir, order, replay idempotent, dan pembuatan sesi Sandbox.
- [x] Migration `202610030026_fix_checkout_item_json_keys.sql` memperbaiki pembacaan item checkout. Prosedur atomik STAGING berhasil membuat order uji, reservasi stok, dan status `PENDING_PAYMENT`.
- [x] Migration `202610040028_fix_midtrans_settlement_order_id.sql` memperbaiki settlement webhook. Uji signed Sandbox membuktikan signature salah ditolak, `pending`, `expire`, settlement, dan event duplikat; settlement menghasilkan order `PAID`, invoice, serta shipment.
- [x] GitHub Actions menjalankan expiry reservation dan worker operasi STAGING setiap lima menit. Run manual `37175583697` membuktikan kedua job lulus dengan `CRON_SECRET`.
- [x] GitHub Actions memeriksa health endpoint STAGING setiap lima menit. Run `37176193812` lulus untuk health check, expiry reservation, dan worker operasi.
- [ ] Aktifkan email worker setelah seluruh penerima pending disetujui. Scheduler ERP hanya diperlukan bila integrasi ERP dipakai.

## Phase 3 — B2B commerce

- [x] User dapat membuat organisasi, menjadi owner, unggah dokumen, dan mengirim verifikasi dari `/business`.
- [x] Owner/Admin perusahaan dapat menambah, mengubah, dan menghapus anggota tanpa menghapus owner terakhir.
- [x] Admin menangani RFQ, quotation, verifikasi B2B, dan harga perusahaan dari portal Admin.
- [x] RFQ, quotation revision, negotiation message, approval, bulk order, audit entry, database function, dan RLS sudah tersedia.
- [x] Alur B2B STAGING diuji: organisasi terverifikasi, RFQ, quotation, negosiasi, persetujuan, dan bulk order.

## Phase 4 — Operasi dan skala

- [x] Admin → Operasi menampilkan agregat transaksi/RFQ, segmentasi customer, outbox, ERP sync, pencarian terikat scope, verifikasi perusahaan, dan harga perusahaan.
- [x] Worker menangani analytics harian, segmentasi, outbox retry, serta job ERP idempotent.
- [x] Scheduler operasi STAGING aktif melalui GitHub Actions setiap lima menit dan telah diuji.
- [ ] Siapkan receiver/secrets ERP bila digunakan dan capacity monitoring sebelum production.

## Phase 5 — Enterprise readiness

- [x] Permission catalog, audit before/after, source IP/user-agent, governance, serta server/database authorization tersedia.
- [x] Super Admin selalu membutuhkan Supabase AAL2 MFA; Admin juga wajib AAL2 ketika aplikasi berjalan di production.
- [x] **Akun Saya → Verifikasi dua langkah** mendukung enrollment dan verifikasi TOTP.
- [x] Super Admin dapat memberi/mencabut Admin atau Super Admin dengan audit dan perlindungan Super Admin terakhir.
- [x] Tiga akun uji STAGING (`user`, `admin`, `super_admin`) dibuat. Bootstrap role dan verifikasi teknis enrollment TOTP untuk Admin/Super Admin lulus; faktor TOTP sementara dihapus agar pemilik dapat mendaftarkan authenticator sendiri.
- [x] Pemilik akun telah mendaftarkan TOTP permanen. Database STAGING memverifikasi satu faktor TOTP aktif untuk setiap akun Admin dan Super Admin.
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
7. Uji Sandbox di STAGING sampai checkout, webhook, fulfillment, email worker, dan reservation expiry terbukti berjalan. Checkout, webhook, fulfillment, RLS, private storage, B2B, load ringan, scheduler reservation/operasi, pengiriman email uji, alert GitHub Actions, restore test, serta Sentry alert terkontrol sudah lulus.
8. Untuk mode Sandbox publik yang disetujui saat ini, pertahankan `MIDTRANS_IS_PRODUCTION=false`, pakai key Midtrans Sandbox, dan arahkan notification URL Sandbox ke `https://wj-wine.vercel.app/api/payments/midtrans/webhook`. Gunakan konfigurasi RajaOngkir uji yang telah disetujui. Sebelum menerima uang atau memenuhi pesanan nyata, ganti keduanya ke kredensial dan konfigurasi live yang sesuai.
9. Deploy domain HTTPS dengan secret production, webhook Midtrans Sandbox, dan scheduler. Jalankan `npm run preflight:production -- .env.production` sampai lulus sebelum DNS cutover.

## Task Completed — checkpoint Production Sandbox P0

- [x] Mengosongkan project `winajaya` dari data DEV berdasarkan persetujuan owner.
- [x] Menerapkan seluruh migration tanpa seed DEV, membuat ulang bucket dan policy, lalu memverifikasi data aplikasi, Auth, dan Storage object kosong.
- [x] Mengarahkan Vercel `wj` ke Supabase PRODUCTION dan mengaktifkan deployment `b299a1b`.
- [x] Menetapkan domain deployment `https://wj-wine.vercel.app`, Supabase Auth URL, redirect URL, serta health check database.
- [x] Menetapkan mode integrasi Sandbox eksplisit untuk deployment publik: `PRODUCTION_INTEGRATION_MODE=sandbox` bersama `MIDTRANS_IS_PRODUCTION=false`. Preflight menolak kombinasi mode/key yang keliru.
- [ ] Menyelesaikan P1–P3: notification URL dan webhook signed Midtrans Sandbox, konfigurasi RajaOngkir uji, SMTP/DNS production, backup/PITR, bootstrap Super Admin, katalog bisnis, transaksi Sandbox terkontrol, serta hypercare 24 jam.

## Cara mengubah data operasional

- **Role platform:** bootstrap pertama melalui SQL, lalu gunakan **Super Admin → Pengguna & role**.
- **Membership B2B:** **Akun Saya → Portal Perusahaan → Kelola anggota**.
- **Produk:** **Admin → Produk** untuk SKU, harga, stok, bobot, variasi, dan gambar.
- **Lookbook:** **Admin → Lookbook** untuk mengunggah atau menghapus gambar.
- **Shipping:** ubah environment `RAJAONGKIR_ORIGIN_ID`, `RAJAONGKIR_ORIGIN_SEARCH`, `RAJAONGKIR_COURIERS`, `SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER`, dan `SHIPPING_PACKAGING_WEIGHT_GRAMS`, lalu restart aplikasi.
- **Mode integrasi:** set `PRODUCTION_INTEGRATION_MODE=sandbox` dan `MIDTRANS_IS_PRODUCTION=false` untuk deployment publik yang hanya dipakai pengujian Sandbox. Untuk pembayaran nyata, ubah keduanya menjadi `live` dan `true`, masukkan key production yang cocok, lalu ulangi seluruh gate pembayaran dan webhook.
