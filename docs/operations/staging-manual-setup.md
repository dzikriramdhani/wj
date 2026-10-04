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

Workflow [`staging-workers.yml`](../../.github/workflows/staging-workers.yml) sudah dipush ke branch default repository dan memeriksa health endpoint, expiry reservation, serta operations worker setiap lima menit. Repository secret berikut telah disimpan:

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

### Aktivasi TOTP untuk Admin dan Super Admin

Lakukan langkah berikut satu kali untuk akun `admin`, lalu ulangi untuk akun `super_admin`.

1. Buka `https://wj-staging.vercel.app/login` dan masuk dengan akun yang sesuai.
2. Buka **Akun Saya**. Bila membuka `/admin` atau `/super-admin` lebih dahulu, aplikasi akan mengarahkan ke halaman ini dengan status MFA diperlukan.
3. Pada kartu **Keamanan Akun → Verifikasi dua langkah**, klik **Aktifkan MFA**.
4. Pindai QR code menggunakan Google Authenticator, Microsoft Authenticator, 1Password, atau aplikasi TOTP lain yang dikuasai pemegang akun. Jangan menyimpan screenshot QR code atau membagikan secret TOTP.
5. Masukkan kode enam digit yang sedang aktif, lalu klik **Verifikasi & aktifkan MFA**. Status kartu harus berubah menjadi **Aktif** dan aplikasi meneruskan akun ke portalnya.
6. Keluar, masuk kembali, lalu buka `/admin` untuk Admin atau `/super-admin` untuk Super Admin. Portal hanya boleh terbuka setelah kode TOTP berhasil diverifikasi.

Jika tombol menampilkan pesan TOTP belum aktif, buka **Supabase Dashboard → project `winajaya_staging` → Authentication → Multi-factor Auth** dan aktifkan enrollment serta verification untuk TOTP. Aplikasi ini sudah memiliki flow enroll, challenge, dan verify sesuai [panduan TOTP Supabase](https://supabase.com/docs/guides/auth/auth-mfa/totp).

## 5. Email, monitor, backup, dan bukti

- Satu email verifikasi SMTP STAGING berhasil dikirim ke inbox yang disetujui pada 4 Oktober 2026. Worker outbox belum diaktifkan: terdapat email lain yang pending dan tidak boleh dikirim tanpa persetujuan penerimanya.

### Monitoring dan alert

GitHub Actions sudah memeriksa `GET https://wj-staging.vercel.app/api/health` setiap lima menit. Untuk menerima alert, buka [GitHub Notification Settings](https://github.com/settings/notifications), pada **System → Actions** pilih **Email** atau **On GitHub**, lalu pilih **Only notify for failed workflows** dan simpan. Pastikan repository `dzikriramdhani/wj` sedang di-watch. Ini membuat kegagalan health check atau worker muncul pada akun GitHub pemilik repository, sesuai [panduan notifikasi GitHub Actions](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications).

Untuk error aplikasi di luar tiga job tersebut, buat project error tracking terpisah, misalnya Sentry, dengan nama `winajaya-staging`. Pada provider tersebut buat alert rule untuk error baru atau lonjakan error, dengan penerima inbox operasi. Berikan DSN STAGING setelah project dibuat agar integrasi aplikasi dapat dipasang tanpa memasukkan DSN ke repository.

### Restore test

Restore test memakai project sementara `winajaya-staging-restore-20261004` (`fpdglanfrfsrinlslfie`), bukan `winajaya_staging`, karena restore dapat menimpa tabel dan data. Schema `001`–`029` telah diterapkan ke project sementara.

Untuk menyelesaikan restore, buka **Supabase Dashboard → project `winajaya_staging` → Connect → Session pooler** dan gunakan password database STAGING. Ulangi pada project restore `winajaya-staging-restore-20261004` menggunakan password saat project dibuat. Jangan memasukkan nilai tersebut ke chat.

Simpan hanya di file lokal `apps/web/.env.restore-test` yang sudah diabaikan Git:

```text
RESTORE_SOURCE_DATABASE_PASSWORD=<password database winajaya_staging>
RESTORE_TARGET_DATABASE_PASSWORD=<password database winajaya-staging-restore-20261004>
```

Masukkan password apa adanya, termasuk karakter khusus; jangan URL encode. Kemudian jalankan `scripts/restore-staging-test.example.ps1`, atau beri tahu operator rilis bahwa file sudah ada agar skrip restore dapat dijalankan. Skrip membuat backup temporary, memulihkan ke project sementara, lalu hanya menampilkan ukuran, hash SHA-256, durasi, dan jumlah record utama. Hapus folder temporary setelah evidence dicatat. Bukti akhir: waktu mulai/selesai, migration version, count tabel utama, RPO/RTO, dan waktu penghapusan project. Tidak ada dump data atau password yang masuk Git.
- Setelah notification URL Midtrans tersimpan, lakukan pembayaran Sandbox dan beri tahu hasilnya. Lalu verifikasi webhook sukses, pending, gagal, expired, dan event duplikat.
- Catat bukti SMTP, scheduler, privileged MFA, B2B/RFQ, monitoring, restore, dan load test pada [task-status.md](task-status.md).
