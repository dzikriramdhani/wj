# PRODUCT REQUIREMENTS DOCUMENT LANJUTAN

## WINAJAYA — Penyelesaian STAGING dan Peluncuran PRODUCTION

**Versi:** 1.0  
**Tanggal:** 3 Oktober 2026  
**Status:** STAGING tervalidasi; deployment publik berjalan dalam mode integrasi Sandbox sampai owner menyetujui layanan live
**Dokumen induk:** [PRD.md](PRD.md)

---

## 1. Tujuan

Menyelesaikan validasi WINAJAYA pada STAGING, lalu melakukan peluncuran PRODUCTION yang terukur dan dapat dipulihkan. Dokumen ini adalah kelanjutan PRD utama. Semua aturan arsitektur, keamanan, RBAC, RLS, checkout, payment, B2B, dan Definition of Done dalam PRD utama tetap berlaku.

Target akhir adalah domain produksi yang melayani transaksi nyata dengan proyek Supabase PRODUCTION terpisah, Midtrans production, konfigurasi RajaOngkir nyata, SMTP terverifikasi, monitoring, backup, dan bukti pengujian yang disetujui. Saat ini owner memilih mode integrasi Sandbox pada domain publik; fase ini hanya melayani validasi teknis dan tidak boleh dinyatakan sebagai penerimaan pembayaran atau pemenuhan pesanan nyata.

## 2. Kondisi awal yang telah tervalidasi

| Area | Status | Bukti saat ini |
| --- | --- | --- |
| Database STAGING | Siap | Proyek `winajaya_staging` dengan ref `aqfllncygivcvsacbfpi` terpisah dari DEV. |
| Migration STAGING | Siap | Migration `202609290001` sampai `202610040029` telah diterapkan; migration 026 memperbaiki item checkout, 027 private business document, 028 settlement Midtrans, dan 029 constraint path notifikasi. |
| Environment STAGING | Siap konfigurasi | Variabel runtime sudah diisi pada Vercel dan file lokal `.env.staging` diabaikan Git. |
| Build STAGING | Lulus | Preflight STAGING, lint, dan build Vercel Node 22 berhasil. Artefak Next.js standalone tersedia. |
| Observability dan scheduler STAGING | Siap | `GET /api/health` tersedia; seluruh worker menerima GET/POST dan tetap mengharuskan bearer `CRON_SECRET`. GitHub Actions menjalankan health check, reservation, dan operations worker tiap lima menit. Sentry STAGING dan alert penerima operasi telah diuji dengan error tanpa data pelanggan. |
| Shipping STAGING | Siap konfigurasi | Origin RajaOngkir adalah ID `5190`: Cijagra, Paseh, Kabupaten Bandung, Jawa Barat 40383. |
| Checkout STAGING | Lulus inti | Quote ongkir, order atomik, replay idempotent, sesi Midtrans Sandbox, dan webhook signed untuk pending, expire, settlement, serta duplicate telah lolos. Settlement membuat invoice dan shipment. |
| RLS STAGING | Lulus sebagian | Audit dua akun dan dua organisasi uji membuktikan isolasi order, profil, organisasi, membership, serta private business document lintas pemilik. Alur B2B sampai bulk order juga lulus. Faktor MFA permanen masih menunggu pemilik akun. |
| Hosting STAGING | Siap | Project `wj-staging` aktif pada `https://wj-staging.vercel.app`, health check publik lulus, dan SSO Deployment Protection telah dinonaktifkan untuk project STAGING. |
| PRODUCTION | Fondasi aktif; gate publik berjalan | Project Supabase `winajaya` telah dibersihkan dan menerima migration tanpa seed DEV; Vercel `wj` melayani `https://wj-wine.vercel.app`, health check lulus, Sentry Production aktif, dan scheduler GitHub production run `37736188644` berhasil. Midtrans dan RajaOngkir tetap Sandbox/uji sesuai keputusan owner. Webhook Sandbox pada domain publik, SMTP/DNS, backup/PITR, bootstrap Super Admin, katalog, transaksi uji, dan hypercare masih memerlukan bukti. |

## 3. Prinsip pelaksanaan

1. STAGING memakai Supabase STAGING dan Midtrans Sandbox. PRODUCTION memakai Supabase PRODUCTION. Pembayaran dan ongkir di domain publik dapat memakai Sandbox sementara hanya bila `PRODUCTION_INTEGRATION_MODE=sandbox` dan bukti/komunikasi rilis menyatakannya secara eksplisit; transaksi nyata mewajibkan mode `live`.
2. Tidak ada secret dalam repository, source code, data seed, screenshot, atau dokumen bukti.
3. Tidak ada data akun, order, pembayaran, atau RFQ DEV/STAGING yang disalin ke PRODUCTION.
4. Tidak ada perubahan UI atau desain lama kecuali dibutuhkan untuk memperbaiki flow yang gagal dalam acceptance test.
5. Setiap gate membutuhkan bukti yang dapat ditinjau sebelum gate berikutnya dimulai.
6. Pembayaran, webhook, stok, order, dan perubahan status hanya dinilai benar melalui server/database, sesuai PRD utama.

## 4. Environment dan batas akses

| Area | DEV | STAGING | PRODUCTION |
| --- | --- | --- | --- |
| Supabase | Proyek DEV | `winajaya_staging` | Proyek PRODUCTION baru dan kosong |
| Midtrans | Sandbox | Sandbox | Sandbox sementara; production saat pembayaran nyata |
| RajaOngkir | Data uji | Konfigurasi uji terukur | Konfigurasi uji sementara; origin, kurir, dan bobot bisnis nyata saat fulfillment nyata |
| Domain | Lokal/DEV | Domain STAGING | Domain publik utama |
| Vercel | Development | Project/environment STAGING | Project/environment PRODUCTION |
| Data | Sintetis | Akun dan transaksi uji | Data bisnis yang telah disetujui |

Role platform tetap tiga: `user`, `admin`, dan `super_admin`. Role membership organisasi (`owner`, `admin`, `buyer`, `viewer`) hanya berlaku di dalam organisasi B2B.

## 5. Tahap STAGING

### S0 — Deploy dan konektivitas publik

**Tujuan:** aplikasi STAGING tersedia melalui domain HTTPS dan memakai seluruh environment variable STAGING Vercel.

**Pekerjaan:**

- Pastikan Vercel Root Directory mengarah ke `apps/web`.
- Gunakan Node.js 22 dan build command `npm run build`.
- Pastikan semua variable yang sudah diisi dipasang pada environment STAGING yang benar, tanpa nilai rahasia pada Build Log.
- Jalankan deployment STAGING dan simpan URL deployment serta commit/revision yang dirilis.
- Verifikasi halaman `/`, `/products`, `/login`, `/register`, `/checkout`, dan `GET /api/health` melalui HTTPS.
- Set `NEXT_PUBLIC_APP_URL` menjadi domain STAGING final, lalu redeploy jika nilainya berubah.

**Acceptance criteria:**

- `npm run preflight:staging -- .env.staging` lulus.
- `npm run lint` dan `npm run build` lulus pada revision yang dideploy.
- Domain STAGING memberi respons HTTPS tanpa redirect loop atau mixed content; `GET /api/health` memberi HTTP 200 tanpa detail secret atau data pengguna.
- Tidak ada secret pada repository, response API publik, browser bundle, atau log yang dibagikan.

### S1 — Konfigurasi integrasi STAGING

**Tujuan:** semua integrasi eksternal menunjuk ke STAGING dan dapat digunakan oleh akun uji.

**Pekerjaan:**

- Pada Supabase STAGING, set Site URL ke domain STAGING dan tambahkan redirect `/auth/callback` serta `/reset-password`.
- Aktifkan email confirmation, password reset, CAPTCHA/rate limit Auth yang sesuai, dan TOTP MFA untuk akun privileged.
- Pada Midtrans Sandbox, set notification URL ke `https://<domain-staging>/api/payments/midtrans/webhook`.
- Konfigurasikan SMTP STAGING dan uji email confirmation, password reset, serta transactional email.
- Konfigurasikan scheduler yang mengirim `Authorization: Bearer <CRON_SECRET>` ke endpoint worker berikut:

| Endpoint | Frekuensi |
| --- | --- |
| `/api/internal/commerce/expire-reservations` | 5 menit |
| `/api/internal/email/process` | 2 menit |
| `/api/internal/operations/process` | 5 menit |
| `/api/internal/erp/sync` | 5 menit, hanya jika ERP diaktifkan |

- Gunakan ID origin RajaOngkir `5190`, daftar kurir yang disetujui, berat produk uji, dan berat kemasan terukur.
- Worker menerima `GET` dan `POST`; gunakan `GET` untuk Vercel Cron. Vercel Cron hanya berjalan pada deployment production, sehingga scheduler eksternal digunakan untuk STAGING.

**Acceptance criteria:**

- Redirect Auth berhasil dan tidak kembali ke domain DEV/PRODUCTION.
- Webhook Sandbox diterima, signature diverifikasi, dan event duplikat tidak membuat pembayaran/order ganda.
- Quote RajaOngkir tersedia untuk alamat tujuan uji yang valid.
- Request provider dibatasi waktu dan mengembalikan kegagalan terkontrol bila RajaOngkir tidak tersedia.
- Worker hanya menerima request dengan bearer secret yang benar.

### S2 — Akun uji dan uji alur inti

**Tujuan:** membuktikan fungsi product dari perspektif pengguna dan operator tanpa memakai akun produksi.

**Data minimum:**

- Dua akun `user` terpisah.
- Satu akun `admin` dengan MFA TOTP.
- Satu akun `super_admin` dengan MFA TOTP.
- Dua organisasi B2B terpisah, masing-masing dengan owner/buyer yang berbeda.
- Produk aktif dengan SKU unik, harga, stok, MOQ, gambar, dan berat terukur.

**Skenario wajib:**

1. Register, verifikasi email, login, password reset, logout, dan akses profil.
2. Isolasi user: User A tidak dapat membaca atau mengubah order User B.
3. Isolasi organisasi: organisasi A tidak dapat membaca RFQ, quotation, dokumen, atau order organisasi B.
4. Katalog, keranjang, quote ongkir, checkout, retry request, dan reservation expiry.
5. Pembayaran Midtrans Sandbox sukses, pending, gagal, expired, dan webhook duplikat.
6. Invoice, fulfillment Admin, shipment status, dan rekonsiliasi pembayaran.
7. RFQ, quotation revision, negosiasi, persetujuan, dan bulk order B2B.
8. Admin dapat menjalankan area kerja internal; user tidak dapat membuka `/admin`; hanya Super Admin dapat mengubah role platform.

**Acceptance criteria:**

- Tidak ada duplicate order, duplicate payment event, atau oversell pada uji retry/concurrency yang disepakati.
- Semua skenario memiliki hasil pass/fail, waktu, akun uji anonim, dan link bukti.
- Semua temuan severity critical/high ditutup sebelum lanjut ke S3.

### S3 — Reliability, security, dan evidence STAGING

**Tujuan:** membuktikan aplikasi siap menerima risiko production.

**Pekerjaan:**

- Jalankan restore test pada data STAGING dan catat RPO/RTO aktual.
- Jalankan security test untuk RLS, authorization API, file private, header keamanan, rate limit, MFA, webhook signature, dan secret exposure.
- Jalankan E2E test untuk alur critical S2.
- Jalankan load test yang disetujui untuk katalog, checkout, webhook, dan worker tanpa menguji Midtrans/RajaOngkir secara berlebihan.
- Pasang error tracking, uptime check, serta alert untuk aplikasi, database, webhook, email worker, dan scheduler.
- Verifikasi Cloudflare STAGING jika domain menggunakan Cloudflare: TLS Full (strict), WAF, cache asset publik, dan rate limit endpoint publik.

**Acceptance criteria:**

- Restore test berhasil dan bukti disimpan.
- Tidak ada kebocoran data lintas user/organisasi atau akses private file tanpa otorisasi.
- Alert dapat diuji dengan kejadian terkontrol dan diterima oleh penanggung jawab.
- Evidence STAGING disetujui oleh Super Admin/owner rilis.

### Gate STAGING → PRODUCTION

Semua syarat berikut wajib lulus:

- S0 sampai S3 selesai dengan bukti.
- Tidak ada temuan critical/high terbuka.
- Semua migration STAGING tetap cocok dengan workspace.
- Prosedur rollback STAGING telah diuji.
- Daftar katalog, SKU, harga, stok, bobot, kurir, dan kebijakan bisnis untuk production telah disetujui.

## 6. Tahap PRODUCTION

### P0 — Provisioning PRODUCTION terpisah

**Tujuan:** membuat fondasi produksi tanpa mencampur environment.

**Pekerjaan:**

- Buat proyek Supabase PRODUCTION baru, kosong, dan terpisah dari DEV/STAGING.
- Buat project/environment Vercel PRODUCTION dengan domain publik utama.
- Masukkan hanya secret untuk deployment PRODUCTION ke Vercel: key Supabase production, credential Midtrans dan RajaOngkir sesuai mode integrasi yang disetujui, SMTP production, `CRON_SECRET` baru, dan konfigurasi operasi yang relevan.
- Jalankan `supabase link --project-ref <production-ref>` lalu `supabase db push` setelah memastikan ref tujuan adalah PRODUCTION.
- Jangan menjalankan seed DEV. Masukkan katalog awal yang sudah disetujui melalui Admin atau import terkontrol.
- Bootstrap tepat satu Super Admin, aktifkan TOTP, kemudian beri role `admin` kepada operator yang membutuhkan.

**Acceptance criteria:**

- `npm run preflight:production -- .env.production` lulus.
- Seluruh migration lokal dan remote PRODUCTION cocok.
- Tidak ada akun/test order DEV atau STAGING pada production.
- Secret production tidak sama dengan secret STAGING untuk layanan yang mendukung pemisahan credential.

### P1 — Konfigurasi domain dan layanan produksi

**Pekerjaan:**

- Set domain publik, HTTPS, Cloudflare TLS Full (strict), WAF, cache policy, dan rate limit sesuai `production-cutover.md`.
- Pada Supabase PRODUCTION, set Site URL/redirect URL production, custom SMTP Auth, email confirmation, CAPTCHA, rate limit, network restriction, dan MFA.
- Publikasikan SPF, DKIM, dan DMARC untuk domain email produksi.
- Set notification URL Midtrans yang cocok dengan mode integrasi ke `https://<domain-produksi>/api/payments/midtrans/webhook`. Pada mode Sandbox, gunakan Dashboard Sandbox dan pertahankan `MIDTRANS_IS_PRODUCTION=false`.
- Jadwalkan health check, reservation expiry, dan operations worker setiap lima menit melalui GitHub Actions. Batasi GitHub Environment `production` ke branch `main`, simpan dedicated `SCHEDULER_CRON_SECRET` di GitHub Environment dan Vercel Production, dan izinkan credential tersebut hanya pada dua worker terjadwal. Jangan berikan `CRON_SECRET` umum ke GitHub Actions; email dan ERP worker memerlukan persetujuan serta jadwal terpisah.
- Set monitoring, error tracking, backup/PITR, kebijakan retensi log, dan penerima alert produksi.

**Acceptance criteria:**

- Semua domain dan webhook memakai HTTPS tanpa redirect.
- Email Auth dan transactional production berhasil untuk penerima uji yang sah.
- Scheduler dan alert dapat dibuktikan tanpa transaksi customer nyata; scheduler production telah dibuktikan pada run `37736188644`. Backup/PITR masih harus diuji.

### P2 — Go-live readiness review

**Pekerjaan:**

- Review evidence STAGING dan checklist production dari PRD utama bagian 85.
- Lakukan smoke test production tanpa mempublikasikan katalog atau transaksi penuh: auth privileged, katalog, private storage policy, quote shipping, dan worker authorization.
- Validasi signature Midtrans production dengan mekanisme resmi tanpa memproses pembayaran customer sebelum cutover disetujui.
- Tetapkan owner rilis, owner rollback, kontak Midtrans/RajaOngkir/SMTP, dan jalur eskalasi insiden.
- Catat revision aplikasi, hash commit, versi migration, konfigurasi DNS, dan waktu rencana cutover.

**Acceptance criteria:**

- Release owner menyetujui seluruh gate secara tertulis.
- Rollback owner memiliki akses ke Vercel, Supabase, DNS/Cloudflare, dan dokumentasi recovery.
- Tidak ada perubahan schema atau feature tanpa melewati STAGING setelah readiness review dimulai.

### P3 — Cutover dan hypercare

**Pekerjaan:**

1. Deploy revision yang sama dengan revision STAGING yang disetujui.
2. Jalankan health/smoke test HTTPS, auth, katalog, cart, quote shipping, dan endpoint webhook.
3. Arahkan DNS/Cloudflare ke deployment PRODUCTION setelah health check lulus.
4. Lakukan satu transaksi produksi terkontrol sesuai kebijakan bisnis, lalu verifikasi payment event, order, email, invoice, stok, dan fulfillment.
5. Pantau error rate, webhook, queue, email, database, dan alert selama minimal 24 jam pertama.
6. Catat keputusan go-live dan setiap insiden dalam log rilis.

**Rollback criteria:**

- Kebocoran lintas tenant/user, kegagalan signature payment, status order/pembayaran salah, atau secret exposure: hentikan checkout dan rollback/mitigasi segera.
- Error rate atau kegagalan transaksi melampaui ambang yang disetujui: rollback deployment Vercel ke revision stabil dan nonaktifkan webhook/checkout bila diperlukan.
- Migration yang sudah diterapkan tidak dihapus secara paksa. Gunakan migration korektif dan prosedur recovery database yang disetujui.

## 7. Artefak bukti wajib

Simpan pada lokasi akses terbatas dan tanpa secret:

| Artefak | STAGING | PRODUCTION |
| --- | --- | --- |
| Revision deployment dan hasil build | Wajib | Wajib |
| Hasil preflight dan migration list | Wajib | Wajib |
| Checklist Auth, MFA, RLS/RBAC, file private | Wajib | Wajib smoke test |
| Hasil checkout/webhook/shipping/email | Wajib Sandbox | Wajib transaksi terkontrol |
| Restore, security, E2E, load test | Wajib | Referensi hasil STAGING |
| Konfigurasi DNS/Cloudflare/SMTP/alert | Wajib bila dipakai | Wajib |
| Log cutover dan rollback owner | Tidak wajib | Wajib |

## 8. Status pekerjaan dan urutan eksekusi

| Urutan | Status | Pekerjaan |
| --- | --- | --- |
| 1 | Selesai | S0: deploy Vercel STAGING dan verifikasi endpoint publik. |
| 2 | Selesai | S1: SMTP, scheduler reservation/operasi, email uji, dan MFA permanen akun privileged telah dibuktikan. |
| 3 | Selesai | S2: transaksi Sandbox, B2B, role, RLS, dan worker telah dibuktikan. |
| 4 | Selesai teknis | S3: restore, security, E2E, load, Sentry, dan alert error terkontrol telah dibuktikan. Persetujuan evidence oleh release owner diperlukan sebelum P0. |
| 5 | Berjalan | P0 foundation selesai: project Supabase `winajaya` telah dibersihkan dari data DEV dan menerima seluruh migration tanpa seed; Vercel `wj`, Auth URL/redirect, serta health check memakai project tersebut. P1–P2 masih memerlukan layanan dan evidence production. |
| 6 | Menunggu P0–P2 | P3: cutover terkontrol dan monitoring 24 jam. |

## 9. Definition of Done lanjutan

Pekerjaan ini selesai ketika:

- STAGING memenuhi seluruh gate S0–S3 dengan bukti yang dapat ditinjau.
- PRODUCTION memiliki project Supabase, domain, secrets, payment, shipping, SMTP, scheduler, backup, monitoring, dan owner operasi yang terpisah dari STAGING.
- Cutover P3 selesai tanpa temuan critical/high terbuka.
- Satu transaksi produksi terkontrol diproses end-to-end secara benar.
- Monitoring hypercare berjalan 24 jam dan keputusan stabilisasi dicatat.

---

## Dokumen operasi terkait

- [Staging activation](docs/operations/staging-activation.md)
- [Production release](docs/operations/production-release.md)
- [Production cutover](docs/operations/production-cutover.md)
- [Production audit](docs/operations/production-audit.md)
- [Task status](docs/operations/task-status.md)
