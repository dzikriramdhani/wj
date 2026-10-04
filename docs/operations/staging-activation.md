# Staging activation

**Supabase project:** `winajaya_staging` (`aqfllncygivcvsacbfpi`)

## Completed

- Project Vercel STAGING `wj-staging` telah dibuat terpisah dari project `wj` dan memakai Node.js 22 serta framework Next.js.
- Semua environment variable STAGING telah disalin ke environment Production milik project `wj-staging`; project ini tetap memakai Supabase STAGING dan Midtrans Sandbox.
- Deployment STAGING `dpl_9oUPwCcP2ZTKHN4Ez8Poq2YGKNkA` siap pada `https://wj-staging.vercel.app`.
- Health check publik `GET /api/health` lulus dan mengembalikan `{"status":"ok","service":"winajaya"}`.
- The workspace is linked to `winajaya_staging`.
- Migration `202609290001` through `202610040029` are applied.
- The database has not received DEV account, order, or catalog data. It contains only the isolated STAGING catalog fixture and checkout evidence created for validation.
- Supabase, Midtrans Sandbox, RajaOngkir API, and SMTP configuration have been supplied; connection to Supabase STAGING has been verified.
- `npm run lint`, STAGING preflight, dan build Vercel lulus pada deployment aktif.
- Checkout STAGING telah diuji pada database dengan produk fixture: order atomik, reservasi stok, dan status `PENDING_PAYMENT` berhasil dibuat. Migration 026 memperbaiki pemetaan field item JSON pada prosedur checkout.
- HTTP end-to-end pada domain STAGING membuktikan quote RajaOngkir, pembuatan order, replay idempotent, dan pembuatan sesi Midtrans Sandbox. Pembayaran tidak diselesaikan; order uji tetap `PENDING_PAYMENT`.
- Audit RLS STAGING dengan dua akun uji membuktikan order dan profil hanya terlihat oleh pemiliknya. Dua organisasi B2B uji juga membuktikan owner tidak dapat membaca organisasi atau membership organisasi lain.
- HTTPS STAGING mengirim CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, dan Referrer Policy. Worker email tanpa bearer diverifikasi memberi `401`.
- Uji private Storage `business-documents` lulus: owner organisasi dapat mengunggah dan membaca PDF uji, sementara pengguna lain dan anon ditolak. File uji dibersihkan setelah verifikasi; migration 027 memperbaiki policy baca owner.
- Konfigurasi Auth URL dan Midtrans Sandbox notification URL telah dikonfirmasi pemilik project. Uji webhook signed membuktikan signature salah ditolak, status pending/expire diterapkan, serta settlement dan event duplikat berhasil; settlement membuat invoice dan shipment. Migration 028 memperbaiki referensi order internal pada settlement.
- Alur B2B STAGING lulus: organisasi terverifikasi, RFQ, quotation, negosiasi, persetujuan, dan bulk order.
- SMTP STAGING telah diperbaiki dari host tidak valid `//gmail.com` menjadi `smtp.gmail.com`; nilai yang sama telah dideploy ke Vercel.
- Satu email verifikasi SMTP STAGING berhasil dikirim ke inbox yang disetujui. Worker outbox belum dijalankan karena antrean masih berisi penerima lain yang belum disetujui.
- Faktor TOTP permanen untuk akun Admin dan Super Admin telah diverifikasi pada database STAGING.
- Load ringan 20 request paralel pada health dan katalog menghasilkan 20 respons HTTP 200 dalam 2,878 ms.
- SSO Deployment Protection telah dinonaktifkan pada `wj-staging` sesuai persetujuan, sehingga endpoint dapat diakses publik untuk Sandbox webhook dan uptime check.
- `.vercelignore` mengecualikan seluruh file `.env*` lokal dari upload deployment.
- Restore test STAGING memulihkan data aplikasi serta `auth.users` ke proyek sementara terisolasi. Migration `29` dan jumlah 12 akun/profil, 1 produk, 8 pesanan, serta 6 organisasi identik dengan sumber. RPO yang diuji 0 menit dan RTO kurang dari 2 menit.

## Configure the application

1. `apps/web/.env.staging` sudah tersedia sebagai file yang diabaikan Git. Masukkan nilai yang sama ke secret store hosting STAGING saat deploy. Bila template perlu dibuat kembali, gunakan `.env.staging.example` dengan nilai placeholder saja.
2. Obtain the STAGING publishable and secret keys from the Supabase project. Do not use keys from DEV or PRODUCTION.
3. Configure a public HTTPS STAGING domain and use it for `NEXT_PUBLIC_APP_URL`.
4. Add the STAGING Site URL and redirect URLs listed in [staging-manual-setup.md](staging-manual-setup.md) in STAGING Supabase Auth.
5. Configure Midtrans Sandbox notification URL as `https://wj-staging.vercel.app/api/payments/midtrans/webhook`.
6. Configure SMTP, `CRON_SECRET`, RajaOngkir origin/couriers, and measured test product weights.
7. Enable TOTP MFA and create separate STAGING test accounts for `user`, `admin`, and `super_admin`.
8. Configure an uptime check for `GET /api/health`. A healthy response is HTTP 200 with `{"status":"ok","service":"winajaya"}` and exposes no configuration values.
9. Run `npm run preflight:staging -- .env.staging` before deploying.

## Required staging evidence

- [x] Cross-user dan cross-organization RLS checks.
- Register, login, product, cart, checkout, Midtrans Sandbox webhook, invoice, fulfillment, and reservation expiry.
- B2B organization, RFQ, quotation revision, approval, and bulk order.
- Email worker and operations worker schedule.
- [x] Restore, security, E2E, dan load test tercatat pada evidence STAGING.

Do not point the production domain or Midtrans production webhook at this environment.

## Status konfigurasi saat ini

- RajaOngkir Search Domestic Destination memverifikasi origin ID `5190` untuk Cijagra, Paseh, Kabupaten Bandung, Jawa Barat 40383. ID ini sudah digunakan pada konfigurasi STAGING dan bukan kode pos.
- Preflight STAGING lulus dengan konfigurasi yang telah diisi, termasuk bobot, `CRON_SECRET`, Supabase, Midtrans Sandbox, RajaOngkir, dan SMTP.
- Build aplikasi dengan environment STAGING lulus; artefak standalone untuk Docker tersedia. Domain HTTPS `https://wj-staging.vercel.app` aktif dan health endpoint memberi HTTP 200.
- Secret STAGING telah berada pada `.env.staging` yang diabaikan Git dan sudah diisi pada Vercel. Bila template perlu dibuat kembali, gunakan `.env.staging.example` dengan placeholder tanpa nilai rahasia.
- GitHub Actions scheduler STAGING menjalankan health check, expiry reservation, dan operasi setiap lima menit. Run `37176193812` lulus untuk seluruh job dengan secret yang tersimpan di GitHub.
- Pengiriman email ke inbox penerima, pendaftaran TOTP permanen untuk pemilik akun privileged, restore test, load test, dan alert GitHub Actions telah selesai. Error tracking aplikasi dengan penerima alert operasi tetap perlu disiapkan sebelum production.
- Worker internal menerima `GET` maupun `POST` dan tetap memerlukan `Authorization: Bearer <CRON_SECRET>`. Percobaan deploy Vercel Cron setiap 2/5 menit ditolak oleh paket Hobby karena hanya mengizinkan cron harian. Konfigurasi yang ditolak telah dihapus agar deployment berikutnya tidak gagal. Pilih Vercel Pro atau scheduler eksternal yang dapat diautentikasi untuk memenuhi frekuensi PRD.
- Quote RajaOngkir memakai batas waktu 20 detik agar perhitungan antar-kota yang lebih lambat tetap dapat selesai; error provider tetap dikembalikan sebagai respons `503` tanpa membocorkan key.
- Worker expiry reservation telah diuji: request tanpa bearer menerima `401`, sedangkan request dengan `CRON_SECRET` berhasil. Notification URL Midtrans Sandbox dan uji event webhook signed telah selesai.
