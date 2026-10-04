# Backup restore exercise

Run this exercise in STAGING every quarter and before the first production launch.

1. Record the target time and the expected schema migration version.
2. Restore a separate STAGING database from the selected backup or point in time.
3. Run `supabase db push --dry-run` against the restored database and confirm it has the expected migration history.
4. Confirm RLS still blocks cross-user orders, RFQs, documents, and notifications.
5. Run a Sandbox checkout, expiry release, and payment-webhook replay against the restored environment.
6. Record duration, data gap, issues, and the operator who performed the test.

The target is RPO ≤15 minutes and RTO ≤2 hours. Escalate when either target is missed.

## Hasil STAGING — 4 Oktober 2026

- **Sumber:** `winajaya_staging` (`aqfllncygivcvsacbfpi`).
- **Target terisolasi:** `winajaya-staging-restore-20261004` (`fpdglanfrfsrinlslfie`). Target telah menerima migration `001`–`029` sebelum data dipulihkan.
- **Metode:** ekspor logis data `auth.users` dan seluruh data `public`, kemudian restore transaksional pada proyek terpisah dengan trigger replikasi dinonaktifkan sementara. Tidak ada schema Supabase atau event trigger sistem yang ditimpa.
- **Verifikasi:** migration `29`, Auth users `12`, profiles `12`, products `1`, orders `8`, dan organizations `6` sama antara sumber dan target.
- **RPO tercapai:** snapshot diambil pada saat exercise, sehingga gap data yang diuji adalah `0` menit.
- **RTO tercapai:** ekspor dan restore data selesai dalam kurang dari 2 menit, di bawah target 2 jam.
- **Pembersihan:** berkas ekspor dan file password lokal telah dihapus, kemudian proyek target sementara dihapus dari Supabase setelah verifikasi selesai.

Ruang lingkup exercise ini memulihkan data aplikasi dan akun Auth. Object Storage, session/token Auth, dan faktor MFA tidak dipulihkan karena tidak termasuk ekspor logis aplikasi; pengujian production harus memakai backup/PITR provider yang mencakup kebutuhan operasional tersebut.
