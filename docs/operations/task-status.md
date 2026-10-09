# WINAJAYA task status

Status ini mengikuti [PRD.md](../../PRD.md) dan rencana eksekusi [PRD-LANJUTAN-STAGING-PRODUCTION.md](../../PRD-LANJUTAN-STAGING-PRODUCTION.md).

**Diperbarui:** 10 Oktober 2026. Validasi teknis STAGING selesai. Fondasi database PRODUCTION menggunakan project Supabase `winajaya` yang dipisahkan dari STAGING dan dibangun ulang tanpa data DEV. Integrasi pembayaran dan ongkir pada deployment publik tetap menggunakan mode Sandbox atas keputusan owner.

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
- [ ] Scheduler Production otomatis belum terbukti. GitHub Actions manual run `37975276764` lulus untuk health, reservation expiry, dan operations; cron workflow di-offset pada commit `4dadb19` (worker menit `2,7,...,57`, email outbox menit `4,9,...,59`), tetapi event `schedule` setelah perubahan belum terkonfirmasi. Pemeriksaan terakhir ke GitHub API gagal karena koneksi jaringan, sehingga status jadwal terkini belum bisa diverifikasi.
- [ ] Vercel `wj` saat diperiksa memakai paket Hobby dan halaman **Settings → Cron Jobs** kosong. Batas resmi Hobby hanya mengizinkan Cron sekali sehari; ini tidak cukup untuk worker tiap lima menit ([batas Cron Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs)). Pilihan: upgrade Vercel ke paket yang mendukung frekuensi tersebut (berbayar), atau gunakan scheduler eksternal dengan request HTTPS ber-auth. Scheduler eksternal berarti menyimpan `SCHEDULER_CRON_SECRET` di penyedia tersebut; jangan kirimkan nilai secret ke chat. Belum ada provider eksternal yang dikonfigurasi atau diotorisasi owner.
- [x] Environment GitHub `production` dibatasi ke branch `main`; secret khusus `SCHEDULER_CRON_SECRET` hanya diterima reservation expiry dan operations.
- [x] Run production `37736188644` pada 8 Oktober 2026 lulus untuk ketiga job: health check, expire reservations, dan process operations. Bukti: https://github.com/dzikriramdhani/wj/actions/runs/37736188644.
- [ ] Gate domain publik yang tersisa: lihat checklist rinci berikut. “Menunggu bukti” berarti checklist belum dicentang karena hasil pada Production belum direkam; itu tidak selalu berarti pengaturannya belum pernah diisi.

### Checklist gate Production Sandbox

**Percobaan ulang 8 Oktober 2026 setelah owner memperbarui sebagian konfigurasi:** endpoint publik Production kembali dapat diakses: health, katalog, dan pencarian origin RajaOngkir semuanya memberi HTTP 200. Vercel mengonfirmasi nama seluruh variable yang diperlukan ada, tetapi menyamarkan delapan nilai secret ketika snapshot diambil sehingga validitas `SUPABASE_SECRET_KEY` dan `MIDTRANS_SERVER_KEY` tidak dapat dibaca ulang dari workstation ini. Tidak ada secret yang ditampilkan dan tidak ada perubahan eksternal.

| Gate | Status | Tindakan dan bukti untuk menutup gate |
| --- | --- | --- |
| Webhook Midtrans Sandbox publik | Lulus untuk tiga transaksi uji | Mode runtime tetap `sandbox` dengan flag Midtrans `false`. Dashboard Midtrans Sandbox menunjukkan order `WJ-261009-00000002`, `00000003`, dan `00000004` berstatus `Settlement`. Database Production membuktikan ketiganya `PAID/settlement`, masing-masing dengan satu event settlement signed-valid yang diproses, satu invoice, dan satu shipment. Order `00000002` semula mengirim callback ke URL STAGING; payload settlement asli dikirim ulang ke endpoint Production, lalu statusnya kini terverifikasi di DB. |
| SMTP dan DNS email | Lulus: tiga email diterima; cadence otomatis belum terbukti | `SMTP_HOST` Production memakai `smtp.gmail.com`; tiga job `payment_settled` untuk order `00000002`–`00000004` berstatus `sent`, tanpa error, dan pemilik mengonfirmasi semuanya diterima. Workflow email manual `37973013426` sukses. Jadwal otomatis email di-offset pada commit `4dadb19`, tetapi event terjadwal belum terkonfirmasi; scheduler email membutuhkan jalur cadence yang andal. SMTP Supabase Auth adalah pengaturan terpisah pada **Authentication → Emails → SMTP Settings**. |
| Backup dan PITR Production | Ditunda oleh owner: belum ingin upgrade/menambah biaya | Pemeriksaan CLI Production pada 10 Okt 2026 mengembalikan region `ap-northeast-2` (Seoul), `walg_enabled=true`, `pitr_enabled=false`, dan `backups=[]`. Ini tidak berarti database kosong; `backups=[]` berarti belum ada restore point yang terdaftar/tersedia lewat daftar backup. Tidak ada upgrade, add-on, atau restore yang dilakukan. Ikuti panduan **Backup nanti** di bawah saat owner siap upgrade. Backup harian tersedia pada paket berbayar tertentu; PITR merupakan add-on berbayar dan memerlukan compute Small. Project Seoul mungkin tidak menampilkan PITR; cek dashboard/Supabase saat upgrade. Backup database tidak menyimpan objek Storage. |
| Super Admin Production | Lulus | Akun `dzikriramdhani24@gmail.com` memiliki role `super_admin` serta baseline `user`; login Production mengembalikan default portal `/super-admin`. Database Production memverifikasi satu faktor TOTP dengan status `verified`. |
| Katalog Production | Diterima untuk pengujian Sandbox; owner meminta dibiarkan | Katalog awal berisi enam produk, lima kategori, 14 variasi, enam harga, stok, dan bobot kirim. Tidak ada perubahan katalog yang dilakukan. Data awal ada di [production-initial-catalog.sql](../../scripts/production-initial-catalog.sql); perubahan kelak dapat dilakukan lewat **Admin → Produk**. Validasi data bisnis hanya diperlukan sebelum pembayaran live atau order riil. |
| RajaOngkir Sandbox/uji publik | Lulus | Origin `5190` untuk Cijagra, Paseh, Kabupaten Bandung berhasil. Quote uji untuk 1 meter Denim 12 oz menuju Braga, Bandung 40111 menghasilkan 12 layanan dari JNE, POS, dan TIKI. Aplikasi menghitung bobot `520 g`: 320 g produk + 200 g kemasan. Hasil ini tetap tarif Sandbox/uji. |
| Transaksi Sandbox Production | Lulus untuk tiga transaksi | Ketiga order `WJ-261009-00000002`–`00000004` berstatus `PAID/settlement`; setiap order memiliki satu event settlement valid yang diproses, satu invoice, satu shipment, dan satu email job. Stok Denim 12 oz menjadi on-hand `65.00 m`, reserved `0.00 m`, konsisten dengan tiga pembelian masing-masing 5 m dari 80 m. Tidak ada dana riil karena Midtrans tetap Sandbox. |
| Hypercare 24 jam | Baseline dan email lulus; periode hypercare menunggu bukti scheduler otomatis | Pemilik telah mengonfirmasi ketiga email masuk. Baseline GET `https://wj-wine.vercel.app/api/health` memberi HTTP 200 `{"status":"ok"}`; manual run worker pada commit cron baru juga lulus. Belum ada event `schedule` otomatis setelah push, jadi belum ada bukti pemantauan rutin lima-menit. Mulai hitung 24 jam setelah event terjadwal kembali muncul dan alert aktif; pantau deployment/domain, Sentry, GitHub Actions, Supabase health/usage, webhook, dan queue. Tutup setelah 24 jam tanpa blocker Critical/High atau semua insiden ditangani. |

**Hasil pemeriksaan 10 Oktober 2026:** MFA Super Admin terverifikasi. Checkout Production semula gagal karena prosedur database membaca field JSON checkout dengan nama yang salah. Migration `202610090030` dan `202610090031` memperbaiki parsing `productId`, `variantId`, serta `qtyMeters`; deployment `dpl_By8UeMvgULs5951gnAZActsFKMyo` menambahkan log aman untuk diagnosis checkout. Migration `202610090032` memperbaiki referensi `order_id` ambigu pada settlement. Dashboard Midtrans Sandbox menunjukkan tiga order (`00000002`–`00000004`) berstatus Settlement; masing-masing sudah diverifikasi di DB Production sebagai `PAID/settlement`, dengan satu event valid, satu invoice, dan satu shipment. Stok produk menjadi on-hand 65 m dan reserved 0 m. Ketiga email `payment_settled` dikirim ke `dzikriramdhani24@gmail.com`, tercatat `sent`, dan owner mengonfirmasi ketiganya diterima. Workflow email manual `37973013426` lulus. Health Production memberi HTTP 200. Cron offset masuk commit `4dadb19`; manual worker run `37975276764` lulus untuk tiga job, tetapi belum ada event schedule baru setelah push. Query backup Supabase mengembalikan region Seoul, `pitr_enabled=false`, dan tidak ada snapshot terdaftar; upgrade backup ditunda owner, katalog dipertahankan untuk Sandbox. |

**Yang perlu dilakukan berikutnya:** pemilik memeriksa Inbox/Spam `dzikriramdhani24@gmail.com` untuk tiga email konfirmasi. Tidak perlu upgrade backup sekarang; langkahnya disimpan pada bagian **Backup nanti**. Pastikan cadence scheduler/alert, lalu mulai dan catat hypercare 24 jam. Katalog dibiarkan sesuai instruksi owner untuk seluruh uji Sandbox; tinjau hanya bila kelak beralih ke pembayaran live atau menerima order riil.

## Phase 1 — Catalog, Auth, dan RFQ

- [x] Storefront lama dipertahankan: homepage, company, katalog, kategori, keranjang, login/register, akun, contact, dan RFQ.
- [x] Admin mengelola produk, harga, stok, variasi, gambar, dan lookbook dari satu portal.
- [x] Password recovery, profil, notifikasi akun, contact message, RFQ attachment, dan transactional email outbox sudah tersedia.
- [x] Koneksi SMTP dan satu pengiriman email verifikasi STAGING ke inbox yang disetujui berhasil. Production email outbox aktif setelah penerima transaksi disetujui; tiga email konfirmasi Production tercatat `sent`.
- [x] Katalog DEV berisi data sintetis yang dapat diedit.
- [x] Katalog awal Production berisi enam produk yang dapat diedit dari **Admin → Produk**.
- [x] Katalog awal dipertahankan untuk pengujian Sandbox sesuai instruksi owner. Penggantian produk, harga, stok, bobot, legal copy, dan gambar ditunda sampai sebelum transaksi pembayaran Live.

## Phase 2 — Commerce

- [x] Checkout idempotent, reservation stok, order tracking, invoice, shipment workflow, reconciliation pembayaran, dan fulfillment tersedia.
- [x] Checkout menyimpan keranjang saat refresh, mengisi data akun bila sudah masuk, memvalidasi MOQ dan ongkir server-side, lalu memberikan jalur retry Midtrans.
- [x] RajaOngkir dan Midtrans Sandbox Snap terhubung lewat konfigurasi STAGING; HTTP end-to-end membuktikan quote ongkir, order, replay idempotent, dan pembuatan sesi Sandbox.
- [x] Migration `202610030026_fix_checkout_item_json_keys.sql` memperbaiki pembacaan item checkout. Prosedur atomik STAGING berhasil membuat order uji, reservasi stok, dan status `PENDING_PAYMENT`.
- [x] Migration `202610040028_fix_midtrans_settlement_order_id.sql` memperbaiki settlement webhook. Uji signed Sandbox membuktikan signature salah ditolak, `pending`, `expire`, settlement, dan event duplikat; settlement menghasilkan order `PAID`, invoice, serta shipment.
- [x] GitHub Actions menjalankan expiry reservation dan worker operasi STAGING setiap lima menit. Run manual `37175583697` membuktikan kedua job lulus dengan `CRON_SECRET`.
- [x] GitHub Actions memeriksa health endpoint STAGING setiap lima menit. Run `37176193812` lulus untuk health check, expiry reservation, dan worker operasi.
- [x] Worker email Production dipicu setelah seluruh penerima transaksi disetujui; run manual `37973013426` sukses dan ketiga job tercatat `sent`. Cadence scheduler otomatis masih perlu dibuktikan. Scheduler ERP hanya diperlukan bila integrasi ERP dipakai.

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

## Yang perlu dilakukan sekarang

1. Tidak ada tindakan email yang tersisa; owner telah mengonfirmasi menerima ketiga email.
2. Putuskan jalur scheduler: (a) upgrade Vercel dari Hobby ke paket berbayar yang mendukung cron 5-menit; atau (b) pilih provider scheduler eksternal dan simpan `SCHEDULER_CRON_SECRET` langsung pada penyedia tersebut. Vercel Hobby hanya mengizinkan cron harian, dan halaman Cron Jobs `wj` kosong. Jangan tempel secret ke chat. Setelah ada jalur yang dipilih, pastikan worker expiry, operations, dan email dipanggil berkala serta catat run sukses.
3. Jika memilih menunggu GitHub Actions, periksa **GitHub → dzikriramdhani/wj → Actions → PRODUCTION workers / PRODUCTION email outbox** dan pastikan event bertipe `schedule` benar-benar muncul; manual run tidak membuktikan cadence.
4. Mulai pencatatan hypercare 24 jam setelah jalur scheduler berjalan otomatis dan Sentry/alert aktif. Midtrans dan RajaOngkir tetap Sandbox; transaksi tidak menerima atau memindahkan uang riil.
5. Biarkan backup berbayar dan perubahan katalog ditunda sesuai keputusan owner. Ikuti langkah **Backup nanti** saat siap upgrade. Biarkan katalog seperti sekarang sampai sebelum go-live pembayaran riil.

## Backup nanti — langkah upgrade dan restore drill

**Arti snapshot:** snapshot adalah salinan database pada satu titik waktu yang dapat dipilih sebagai titik pemulihan. Ini bukan screenshot dan tidak berarti data sekarang kosong. Pemeriksaan terakhir melaporkan `backups=[]`, artinya tidak ada snapshot yang tersedia pada daftar backup Production saat itu. Backup database Supabase tidak menyertakan file/objek di Storage; file perlu dicadangkan dan diuji terpisah. Backup harian dikelola Supabase pada paket Pro, Team, dan Enterprise. [Panduan backup Supabase](https://supabase.com/docs/guides/platform/backups).

Saat Anda siap upgrade:

1. Masuk Supabase Dashboard dan pilih organisasi yang memiliki project `winajaya` (`qcgcpheeskkdcnxspbgx`). Upgrade ditagihkan pada tingkat organisasi, jadi periksa bahwa Anda sedang berada di organisasi yang tepat.
2. Buka **Organization → Billing → Subscription Plan → Change subscription plan**, pilih paket yang menyediakan backup harian, lalu tinjau harga/estimasi sebelum mengonfirmasi. Supabase menyatakan upgrade berlaku segera dan biaya ditampilkan dalam proses upgrade. [Panduan mengubah paket](https://supabase.com/docs/guides/platform/manage-your-subscription).
3. Setelah upgrade, buka **Project `winajaya` → Database → Backups**. Tunggu hingga tanggal/waktu backup muncul. Catat timestamp dan retention; sebelum ada entry, belum ada snapshot yang dapat dipakai untuk restore drill.
4. Opsional: bila memerlukan recovery point lebih rapat, buka pengaturan **Point in Time Recovery** pada halaman Backups. Periksa dukungan untuk region Seoul dan harga add-on/compute. Supabase mensyaratkan compute Small untuk PITR; jangan aktifkan bila biaya atau ketersediaan belum disetujui. [Aturan PITR dan biaya](https://supabase.com/docs/guides/platform/backups).
5. Untuk restore drill, buka **Database → Backups → Restore to a New Project**, pilih snapshot dan timestamp, lalu baca estimasi biaya proyek baru sebelum menyetujui. Restore ke project terpisah, bukan `winajaya`. Restore project baru menyalin database dan data Auth, tetapi perlu konfigurasi ulang beberapa layanan dan tidak menyalin objek Storage. [Panduan restore ke project baru](https://supabase.com/docs/guides/platform/clone-project).
6. Di project hasil restore, validasi migration/schema, jumlah data, akun Auth, RLS, Storage secara terpisah, health check, dan alur aplikasi; catat waktu mulai/selesai untuk RPO/RTO. Hapus project uji hanya setelah bukti restore dicatat dan dengan konfirmasi owner.

## Task Status — checkpoint Production Sandbox (10 Oktober 2026)

- [x] Mengosongkan project `winajaya` dari data DEV berdasarkan persetujuan owner.
- [x] Menerapkan seluruh migration tanpa seed DEV, membuat ulang bucket dan policy, lalu memverifikasi data aplikasi, Auth, dan Storage object kosong.
- [x] Mengarahkan Vercel `wj` ke Supabase PRODUCTION dan mengaktifkan deployment `b299a1b`.
- [x] Menetapkan domain deployment `https://wj-wine.vercel.app`, Supabase Auth URL, redirect URL, serta health check database.
- [x] Menetapkan mode integrasi Sandbox eksplisit untuk deployment publik: `PRODUCTION_INTEGRATION_MODE=sandbox` bersama `MIDTRANS_IS_PRODUCTION=false`. Preflight menolak kombinasi mode/key yang keliru.
- [x] P1 — webhook signed Midtrans Sandbox Production dan tiga transaksi Sandbox berhasil direkonsiliasi.
- [x] P1 — RajaOngkir Sandbox, pengiriman SMTP Production, Super Admin Production dengan MFA, dan katalog awal telah diverifikasi.
- [ ] P1 — scheduler Production: manual GitHub run lulus, tetapi cadence otomatis belum terbukti; Vercel `wj` Hobby tidak mendukung cron lima menit dan belum ada scheduler eksternal yang dikonfigurasi.
- [ ] P2 (ditunda atas keputusan owner) — upgrade paket/backup dan restore drill belum dilakukan; lihat panduan **Backup nanti**.
- [x] P2 Sandbox — katalog awal dipertahankan sesuai instruksi owner. Tinjau ulang hanya sebelum pembayaran live/order riil.
- [ ] P3 — pantau hypercare 24 jam setelah cron baru terbukti berjalan; tutup setelah tidak ada blocker Critical/High.

## Cara mengubah data operasional

- **Role platform:** bootstrap pertama melalui SQL, lalu gunakan **Super Admin → Pengguna & role**.
- **Membership B2B:** **Akun Saya → Portal Perusahaan → Kelola anggota**.
- **Produk:** **Admin → Produk** untuk SKU, harga, stok, bobot, variasi, dan gambar.
- **Lookbook:** **Admin → Lookbook** untuk mengunggah atau menghapus gambar.
- **Shipping:** ubah environment `RAJAONGKIR_ORIGIN_ID`, `RAJAONGKIR_ORIGIN_SEARCH`, `RAJAONGKIR_COURIERS`, `SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER`, dan `SHIPPING_PACKAGING_WEIGHT_GRAMS`, lalu restart aplikasi.
- **Mode integrasi:** set `PRODUCTION_INTEGRATION_MODE=sandbox` dan `MIDTRANS_IS_PRODUCTION=false` untuk deployment publik yang hanya dipakai pengujian Sandbox. Untuk pembayaran nyata, ubah keduanya menjadi `live` dan `true`, masukkan key production yang cocok, lalu ulangi seluruh gate pembayaran dan webhook.
