# Audit kesiapan produksi

**Tanggal:** 4 Oktober 2026
**Patokan:** [PRD.md](../../PRD.md), terutama environment strategy, acceptance security, dan definition of done production.

## Kesimpulan

Status saat ini adalah **fondasi deployment PRODUCTION dengan integrasi Sandbox**. Project Supabase `winajaya` telah dibersihkan dan menerima seluruh migration tanpa seed DEV; Vercel `wj` memakai project tersebut dan health check lulus. Aplikasi, deployment STAGING, checkout Sandbox, webhook STAGING, RLS, B2B, MFA, scheduler STAGING dan PRODUCTION, email uji, load ringan, restore test, Sentry, dan alert error terkontrol sudah dibuktikan. Gate yang tersisa untuk operasi publik adalah webhook Midtrans Sandbox pada domain publik, SMTP/DNS, backup/PITR, akun Super Admin, katalog, konfigurasi ongkir uji, dan bukti transaksi Sandbox. Pembayaran atau fulfillment nyata tetap menunggu mode layanan live.

## Perbaikan yang diterapkan dalam audit ini

- Otorisasi endpoint scheduler kini menghapus awalan `Bearer ` dengan benar. Sebelumnya pola regex tidak menerima header standar sehingga job terjadwal dapat selalu ditolak.
- API detail order dan invoice kini memerlukan session pengguna atau cookie sesi checkout yang sama. Parameter email tidak lagi menjadi bukti kepemilikan.
- Admin dan Super Admin memerlukan MFA AAL2 pada runtime production. Preflight juga menolak konfigurasi yang tidak menetapkan `ADMIN_MFA_REQUIRED=true`.
- Preflight production menolak kombinasi mode integrasi dan flag Midtrans yang tidak cocok, serta proyek Supabase yang masih berisi akun `@winajaya.test`.
- Template environment dan runbook telah diubah untuk proyek Supabase production terpisah dan Midtrans production.

## Audit terhadap Definition of Done PRD

| Area PRD | Status | Bukti / tindakan yang tersisa |
| --- | --- | --- |
| Proyek Supabase production | Lulus fondasi | Project `winajaya` (`qcgcpheeskkdcnxspbgx`) telah direset tanpa backup berdasarkan persetujuan owner, menerima seluruh migration tanpa seed DEV, dan diverifikasi tanpa akun Auth, objek Storage, produk, order, atau organisasi. |
| STAGING | Selesai teknis | Proyek `winajaya_staging` terpisah memakai migration `001`–`029`, deployment HTTPS aktif, bukti inti tersedia, serta issue dan alert Sentry terkontrol telah terbukti. Persetujuan evidence release owner dan email worker yang masih pending perlu diselesaikan sebelum cutover. |
| Migration terkontrol | Siap STAGING | Migration `001`–`029` sama pada workspace dan proyek STAGING. Terapkan berurutan melalui Supabase CLI pada PRODUCTION setelah gate STAGING disetujui. |
| RLS dan RBAC | Lulus STAGING | Uji lintas user dan lintas organisasi membuktikan isolasi order, profil, organisasi, membership, dan dokumen private; role platform tiga tingkat berlaku. |
| MFA privileged | Lulus STAGING | Faktor TOTP permanen Admin dan Super Admin telah diverifikasi. Super Admin wajib AAL2; Admin wajib AAL2 pada production. |
| Payment | Sandbox publik | Owner menyetujui `PRODUCTION_INTEGRATION_MODE=sandbox` dengan `MIDTRANS_IS_PRODUCTION=false`. Notification URL Midtrans Sandbox dan uji webhook domain publik masih perlu dibuktikan. Layanan live diperlukan sebelum pembayaran nyata. |
| Shipping | Siap konfigurasi STAGING | Origin RajaOngkir telah diverifikasi sebagai ID `5190` (Cijagra, Paseh, Kabupaten Bandung, Jawa Barat 40383); courier dan bobot tersedia. Tetap buktikan quote dan checkout Sandbox di domain STAGING. |
| Email | Blocker | Custom SMTP aplikasi tersedia, tetapi konfigurasi Supabase Auth SMTP, SPF, DKIM, dan DMARC belum dapat dibuktikan. |
| Scheduler / queue | Scheduler lulus; email tertunda | Production workflow run [37736188644](https://github.com/dzikriramdhani/wj/actions/runs/37736188644) lulus untuk health, reservation expiry, dan operations. Environment GitHub `production` dibatasi ke `main`; dedicated `SCHEDULER_CRON_SECRET` hanya mengotorisasi dua worker terjadwal tersebut. Email worker tetap tidak dijadwalkan karena penerima queued email belum menyetujui pengiriman. |
| Cloudflare | Blocker | TLS Full (strict), WAF, bot mitigation, cache policy, dan rate limit per endpoint belum dapat diverifikasi dari repository. |
| Rate limiting | Perlu konfigurasi | Aplikasi mempunyai fallback in-memory; Cloudflare wajib menjadi pembatas yang durable untuk endpoint publik. |
| Private storage | Lulus STAGING | Owner organisasi dapat unggah/baca dokumen private; pengguna lain dan anon ditolak. |
| Image optimization | Partial blocker | Next Image optimisation dan remote source allowlist sudah aktif, tetapi upload belum menyimpan derivative image beserta metadata pipeline yang diminta PRD. |
| Monitoring dan error tracking | Sentry Production teruji | Health domain publik lulus. Project Sentry `winajaya-production` memakai DSN pada Vercel Production; alert issue baru mencatat dua trigger dari error uji tanpa data pelanggan. Parsing webhook malformed kini dilaporkan ke Sentry dan `reportServerError` menginisialisasi config Sentry server secara langsung. |
| Backup dan recovery | Lulus STAGING | Restore ke proyek Supabase sementara menghasilkan migration/data inti yang identik; RPO 0 menit dan RTO kurang dari 2 menit. |
| Lint | Lulus | `npm run lint` lulus tanpa error maupun warning setelah audit. |
| Security, E2E, load test | Lulus STAGING | Security/RLS, checkout-webhook, B2B, dan load ringan 20 request paralel telah dicatat pada evidence STAGING. |

## Urutan menuju production

1. Buat dan amankan proyek Supabase STAGING serta PRODUCTION yang terpisah.
2. Terapkan migration pada STAGING, isi data nonproduksi, lalu uji RLS, checkout Sandbox, webhook, worker, fulfillment, email, dan restore.
3. Selesaikan testing, monitoring/error tracking, Cloudflare, SMTP/DNS, dan backup/PITR.
4. Lengkapi environment deployment publik dengan domain HTTPS, credential sesuai `PRODUCTION_INTEGRATION_MODE`, SMTP, scheduler, Sentry, backup/PITR, serta `ADMIN_MFA_REQUIRED=true`. Scheduler production telah aktif dan lulus run manual; gate lainnya tetap perlu bukti.
5. Jalankan `npm run preflight:production -- .env.production`, build, review evidence STAGING, lalu deploy. Jalankan satu transaksi Sandbox terkontrol dan pantau alert; sebelum transaksi nyata, ulangi gate ini dalam mode `live`.

## Dokumen terkait

- [production-release.md](production-release.md)
- [production-cutover.md](production-cutover.md)
- [restore-test.md](restore-test.md)
- [task-status.md](task-status.md)
