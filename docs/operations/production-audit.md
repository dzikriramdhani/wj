# Audit kesiapan produksi

**Tanggal:** 2 Oktober 2026  
**Patokan:** [PRD.md](../../PRD.md), terutama environment strategy, acceptance security, dan definition of done production.

## Kesimpulan

Status saat ini adalah **STAGING, belum layak cutover ke PRODUCTION**. Aplikasi memiliki fondasi commerce, B2B, RBAC, RLS, checkout idempotent, webhook Midtrans, outbox, dan worker. Database STAGING terpisah telah siap, Midtrans tetap Sandbox sesuai tahap ini, sementara deployment STAGING dan bukti pengujian serta layanan operasional wajib belum tersedia.

## Perbaikan yang diterapkan dalam audit ini

- Otorisasi endpoint scheduler kini menghapus awalan `Bearer ` dengan benar. Sebelumnya pola regex tidak menerima header standar sehingga job terjadwal dapat selalu ditolak.
- API detail order dan invoice kini memerlukan session pengguna atau cookie sesi checkout yang sama. Parameter email tidak lagi menjadi bukti kepemilikan.
- Admin dan Super Admin memerlukan MFA AAL2 pada runtime production. Preflight juga menolak konfigurasi yang tidak menetapkan `ADMIN_MFA_REQUIRED=true`.
- Preflight production menolak Midtrans Sandbox dan proyek Supabase yang masih berisi akun `@winajaya.test`.
- Template environment dan runbook telah diubah untuk proyek Supabase production terpisah dan Midtrans production.

## Audit terhadap Definition of Done PRD

| Area PRD | Status | Bukti / tindakan yang tersisa |
| --- | --- | --- |
| Proyek Supabase production | Blocker | Konfigurasi aktif masih terdeteksi sebagai DEV. Buat proyek PRODUCTION terpisah dan jangan salin akun/order DEV. |
| STAGING | Dalam persiapan | Proyek `winajaya_staging` terpisah telah menerima migration 001–025, konfigurasi lulus preflight, dan belum menerima data DEV. Deployment serta bukti checkout Sandbox, webhook, dan restore masih diperlukan. |
| Migration terkontrol | Siap STAGING | `supabase migration list --linked` membuktikan migration 001–025 sama pada workspace dan proyek STAGING terhubung. Terapkan berurutan melalui Supabase CLI pada PRODUCTION setelah bukti STAGING lengkap. |
| RLS dan RBAC | Perlu bukti | Migration mengaktifkan RLS dan policy pada data commerce/B2B. Jalankan security test lintas user dan lintas organisasi di STAGING. |
| MFA privileged | Siap kode | Super Admin wajib AAL2; Admin wajib AAL2 pada production. Aktifkan TOTP pada Supabase Auth dan enrol semua operator. |
| Payment | Blocker | Kode mendukung Midtrans production, tetapi environment memakai Sandbox. Diperlukan key production dan notification URL production. |
| Shipping | Siap konfigurasi STAGING | Origin RajaOngkir telah diverifikasi sebagai ID `5190` (Cijagra, Paseh, Kabupaten Bandung, Jawa Barat 40383); courier dan bobot tersedia. Tetap buktikan quote dan checkout Sandbox di domain STAGING. |
| Email | Blocker | Custom SMTP aplikasi tersedia, tetapi konfigurasi Supabase Auth SMTP, SPF, DKIM, dan DMARC belum dapat dibuktikan. |
| Scheduler / queue | Perlu konfigurasi | Endpoint worker tersedia. Atur scheduler dengan `Authorization: Bearer <CRON_SECRET>` setelah deployment. |
| Cloudflare | Blocker | TLS Full (strict), WAF, bot mitigation, cache policy, dan rate limit per endpoint belum dapat diverifikasi dari repository. |
| Rate limiting | Perlu konfigurasi | Aplikasi mempunyai fallback in-memory; Cloudflare wajib menjadi pembatas yang durable untuk endpoint publik. |
| Private storage | Perlu bukti | Policy bucket harus diuji dengan pengguna lintas organisasi di STAGING. |
| Image optimization | Partial blocker | Next Image optimisation dan remote source allowlist sudah aktif, tetapi upload belum menyimpan derivative image beserta metadata pipeline yang diminta PRD. |
| Monitoring dan error tracking | Blocker | Belum ada provider atau alert aktif untuk application, database, payment, shipping, email, dan worker. |
| Backup dan recovery | Blocker | Jalankan restore test STAGING dan simpan bukti RPO/RTO. |
| Lint | Lulus | `npm run lint` lulus tanpa error maupun warning setelah audit. |
| Security, E2E, load test | Blocker | Belum ada suite otomatis atau hasil pengujian untuk skenario wajib PRD. |

## Urutan menuju production

1. Buat dan amankan proyek Supabase STAGING serta PRODUCTION yang terpisah.
2. Terapkan migration pada STAGING, isi data nonproduksi, lalu uji RLS, checkout Sandbox, webhook, worker, fulfillment, email, dan restore.
3. Selesaikan testing, monitoring/error tracking, Cloudflare, SMTP/DNS, dan backup/PITR.
4. Buat environment production dengan domain HTTPS, key Midtrans production, RajaOngkir production, SMTP, scheduler, serta `ADMIN_MFA_REQUIRED=true`.
5. Jalankan `npm run preflight:production -- .env.production`, build, review evidence STAGING, lalu cutover DNS. Setelah itu jalankan satu transaksi production terkontrol dan pantau alert.

## Dokumen terkait

- [production-release.md](production-release.md)
- [production-cutover.md](production-cutover.md)
- [restore-test.md](restore-test.md)
- [task-status.md](task-status.md)
