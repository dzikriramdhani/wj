# Audit kesiapan produksi

**Tanggal:** 4 Oktober 2026
**Patokan:** [PRD.md](../../PRD.md), terutama environment strategy, acceptance security, dan definition of done production.

## Kesimpulan

Status saat ini adalah **STAGING, belum layak cutover ke PRODUCTION**. Aplikasi, deployment STAGING, checkout Sandbox, webhook, RLS, B2B, MFA, scheduler, email uji, load ringan, dan restore test sudah dibuktikan. Gate yang tersisa adalah error tracking aplikasi dengan penerima alert operasi, persetujuan/aktivasi email worker untuk antrean yang masih pending, serta seluruh provisioning PRODUCTION terpisah.

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
| STAGING | Hampir selesai | Proyek `winajaya_staging` terpisah memakai migration `001`–`029`, deployment HTTPS aktif, dan seluruh bukti inti tersedia. Error tracking aplikasi, penerima alert operasi, serta persetujuan email worker masih diperlukan. |
| Migration terkontrol | Siap STAGING | Migration `001`–`029` sama pada workspace dan proyek STAGING. Terapkan berurutan melalui Supabase CLI pada PRODUCTION setelah gate STAGING disetujui. |
| RLS dan RBAC | Lulus STAGING | Uji lintas user dan lintas organisasi membuktikan isolasi order, profil, organisasi, membership, dan dokumen private; role platform tiga tingkat berlaku. |
| MFA privileged | Lulus STAGING | Faktor TOTP permanen Admin dan Super Admin telah diverifikasi. Super Admin wajib AAL2; Admin wajib AAL2 pada production. |
| Payment | Blocker | Kode mendukung Midtrans production, tetapi environment memakai Sandbox. Diperlukan key production dan notification URL production. |
| Shipping | Siap konfigurasi STAGING | Origin RajaOngkir telah diverifikasi sebagai ID `5190` (Cijagra, Paseh, Kabupaten Bandung, Jawa Barat 40383); courier dan bobot tersedia. Tetap buktikan quote dan checkout Sandbox di domain STAGING. |
| Email | Blocker | Custom SMTP aplikasi tersedia, tetapi konfigurasi Supabase Auth SMTP, SPF, DKIM, dan DMARC belum dapat dibuktikan. |
| Scheduler / queue | Lulus sebagian | GitHub Actions menjalankan health, reservation expiry, dan operations tiap lima menit dengan bearer secret. Email worker belum diaktifkan karena terdapat penerima pending yang belum menyetujui pengiriman. |
| Cloudflare | Blocker | TLS Full (strict), WAF, bot mitigation, cache policy, dan rate limit per endpoint belum dapat diverifikasi dari repository. |
| Rate limiting | Perlu konfigurasi | Aplikasi mempunyai fallback in-memory; Cloudflare wajib menjadi pembatas yang durable untuk endpoint publik. |
| Private storage | Lulus STAGING | Owner organisasi dapat unggah/baca dokumen private; pengguna lain dan anon ditolak. |
| Image optimization | Partial blocker | Next Image optimisation dan remote source allowlist sudah aktif, tetapi upload belum menyimpan derivative image beserta metadata pipeline yang diminta PRD. |
| Monitoring dan error tracking | Blocker | Health dan worker dipantau GitHub Actions setiap lima menit, tetapi error tracking aplikasi serta penerima alert operasi belum dikonfigurasi. |
| Backup dan recovery | Lulus STAGING | Restore ke proyek Supabase sementara menghasilkan migration/data inti yang identik; RPO 0 menit dan RTO kurang dari 2 menit. |
| Lint | Lulus | `npm run lint` lulus tanpa error maupun warning setelah audit. |
| Security, E2E, load test | Lulus STAGING | Security/RLS, checkout-webhook, B2B, dan load ringan 20 request paralel telah dicatat pada evidence STAGING. |

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
