# Konfigurasi manual STAGING

Dokumen ini hanya untuk STAGING. Jangan gunakan project Supabase, key, atau URL Midtrans production pada langkah berikut.

## 1. Supabase Auth

Buka [Supabase Auth URL Configuration](https://supabase.com/dashboard/project/aqfllncygivcvsacbfpi/auth/url-configuration) untuk project **`winajaya_staging`** dengan ref **`aqfllncygivcvsacbfpi`**.

Isi nilai berikut.

| Field Supabase | Nilai STAGING |
| --- | --- |
| Site URL | `https://wj-staging.vercel.app` |
| Additional Redirect URL | `https://wj-staging.vercel.app/auth/callback?next=/account` |
| Additional Redirect URL | `https://wj-staging.vercel.app/auth/callback?next=/reset-password` |

Pada menu **Authentication → Providers → Email**, pastikan Email provider aktif dan email confirmation aktif. Pada **Authentication → SMTP Settings**, masukkan konfigurasi SMTP STAGING bila email konfirmasi dan reset harus memakai SMTP milik Anda.

Pada **Authentication → Multi-factor Auth**, aktifkan TOTP. Setelah Super Admin pertama dibuat, akun tersebut harus masuk ke aplikasi lalu membuka **Akun Saya → Verifikasi dua langkah** untuk mendaftarkan aplikasi authenticator dan menyelesaikan kode enam digit.

Konfigurasi URL dan notification URL pada bagian ini telah dikonfirmasi selesai pada 4 Oktober 2026. Pendaftaran TOTP permanen tetap dilakukan oleh pemegang akun, karena secret authenticator tidak dicatat di aplikasi atau repository.

## 2. Midtrans Sandbox

Buka [Midtrans Sandbox Dashboard](https://dashboard.sandbox.midtrans.com/), lalu masuk ke **Settings → Configuration**.

Isi field **Payment Notification URL** dengan:

```text
https://wj-staging.vercel.app/api/payments/midtrans/webhook
```

Gunakan tetap Server Key dan Client Key **Sandbox** yang telah dipasang di Vercel `wj-staging`; `MIDTRANS_IS_PRODUCTION` harus tetap `false`.

Jangan mengisi webhook dengan URL halaman checkout atau URL production. Finish redirect Snap sudah dibuat aplikasi dari `NEXT_PUBLIC_APP_URL` saat sesi pembayaran dibuat.

## 3. Scheduler worker

Gunakan scheduler yang dapat menjalankan HTTP `GET` dan mengirim custom header, misalnya cron-job.org, GitHub Actions, atau layanan operasi Anda. Buat job berikut dengan header yang sama:

```text
Authorization: Bearer <nilai CRON_SECRET dari .env.staging>
```

| Frekuensi | Method | URL |
| --- | --- | --- |
| Setiap 5 menit (`*/5 * * * *`) | `GET` | `https://wj-staging.vercel.app/api/internal/commerce/expire-reservations` |
| Setiap 2 menit (`*/2 * * * *`) | `GET` | `https://wj-staging.vercel.app/api/internal/email/process` |
| Setiap 5 menit (`*/5 * * * *`) | `GET` | `https://wj-staging.vercel.app/api/internal/operations/process` |
| Setiap 5 menit, bila ERP dipakai | `GET` | `https://wj-staging.vercel.app/api/internal/erp/sync` |

`CRON_SECRET` hanya ditempatkan pada header scheduler, bukan pada URL, repository, atau screenshot. Endpoint tanpa header yang benar harus selalu memberi `401`.

Vercel pada paket Hobby menolak jadwal di atas karena hanya mendukung cron harian. GitHub Actions digunakan sebagai scheduler eksternal untuk reservation dan operasi. Email dan ERP tetap dinonaktifkan sampai masing-masing kebutuhan operasionalnya dipenuhi.

### GitHub Actions sebagai scheduler STAGING

Workflow [`staging-workers.yml`](../../.github/workflows/staging-workers.yml) sudah dipush ke branch default repository dan mengeksekusi expiry reservation serta operations worker setiap lima menit. Repository secret berikut telah disimpan:

| Nama secret | Nilai |
| --- | --- |
| `STAGING_APP_URL` | `https://wj-staging.vercel.app` |
| `STAGING_CRON_SECRET` | Nilai `CRON_SECRET` dari `.env.staging` atau Vercel project `wj-staging` |

Jangan aktifkan email worker pada workflow ini sebelum inbox penerima uji ditetapkan dan pengiriman email disetujui. Run manual `37175583697` memberi status hijau untuk kedua job; endpoint tanpa bearer tetap harus memberi `401`.

## 4. Akun dan role uji

1. Daftarkan satu email operator STAGING melalui `https://wj-staging.vercel.app/register`.
2. Salin Auth User UUID operator dari **Supabase Dashboard → Authentication → Users**.
3. Jalankan SQL bootstrap pada [first-admin.md](first-admin.md) di SQL Editor project `winajaya_staging` untuk memberi role `super_admin`.
4. Masuk kembali dengan akun itu, aktifkan TOTP, lalu buat satu akun `admin` dari **Portal Super Admin → Pengguna & role**.
5. Gunakan akun `user`, `admin`, dan `super_admin` berbeda untuk pengujian. Password tidak dicatat di repository atau dokumen evidence.
## 5. Email, monitor, backup, dan bukti

- Siapkan satu inbox penerima STAGING yang dapat menerima email konfirmasi, reset password, dan email transaksi. Jangan gunakan inbox customer.
- Koneksi SMTP STAGING lulus setelah `SMTP_HOST` dikoreksi menjadi `smtp.gmail.com`, tetapi pengiriman email belum diuji karena inbox penerima belum ditetapkan dan belum ada persetujuan eksplisit untuk mengirim email keluar.
- Buat uptime monitor HTTP `GET` ke `https://wj-staging.vercel.app/api/health`, interval 5 menit, ekspektasi HTTP `200` dan body `{"status":"ok","service":"winajaya"}`.
- Buat backup STAGING lalu restore ke project disposable sebelum menyatakan restore test lulus. Catat waktu backup, waktu restore, dan hasil health check tanpa menyimpan secret.
- Setelah notification URL Midtrans tersimpan, lakukan pembayaran Sandbox dan beri tahu hasilnya. Lalu verifikasi webhook sukses, pending, gagal, expired, dan event duplikat.
- Catat bukti SMTP, scheduler, privileged MFA, B2B/RFQ, monitoring, restore, dan load test pada [task-status.md](task-status.md).
