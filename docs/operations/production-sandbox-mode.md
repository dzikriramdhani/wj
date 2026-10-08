# Mode integrasi Sandbox pada deployment publik

**Status:** disetujui owner pada 7 Oktober 2026.

Deployment publik `https://wj-wine.vercel.app` memakai database Supabase PRODUCTION `winajaya`, tetapi Midtrans dan RajaOngkir tetap memakai konfigurasi Sandbox/uji. Tujuannya adalah memverifikasi aplikasi, webhook, ongkir, dan operasi tanpa menerima pembayaran atau memulai fulfillment bisnis nyata.

## Konfigurasi Vercel `wj` → Production

Tambahkan atau pertahankan nilai berikut tanpa menuliskan key ke repository:

```env
PRODUCTION_INTEGRATION_MODE=sandbox
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_APP_URL=https://wj-wine.vercel.app
```

Gunakan pasangan Server Key dan Client Key **Midtrans Sandbox**. Pertahankan konfigurasi RajaOngkir uji yang telah disetujui, termasuk origin `5190`, daftar courier uji, dan bobot uji terukur.

Di Midtrans **Sandbox Dashboard → Settings → Configuration**, set notification URL berikut tanpa redirect:

```text
https://wj-wine.vercel.app/api/payments/midtrans/webhook
```

## Batas rilis

- Jangan mengiklankan checkout ini sebagai pembayaran nyata.
- Jangan melakukan pengiriman atau invoice bisnis nyata dari transaksi Sandbox.
- Produk bisnis boleh disiapkan, tetapi transaksi validasi harus diberi penanda uji dan dapat dibersihkan menurut prosedur operasi.
- Sentry sudah dikonfigurasi pada deployment; alert issue baru mencatat dua event uji tanpa data pelanggan. Scheduler production juga sudah lulus verifikasi. Backup/PITR, SMTP, bootstrap Super Admin, katalog, webhook Sandbox, dan transaksi uji tetap harus diselesaikan sebelum status rilis operasional dinyatakan selesai.

## Scheduler Production

Project Vercel saat ini ada pada paket Hobby, yang hanya mendukung cron harian. Repository sudah menyiapkan GitHub Actions workflow `.github/workflows/production-workers.yml` untuk health check, reservation expiry, dan operations worker setiap lima menit.

Workflow memakai credential khusus `SCHEDULER_CRON_SECRET`, yang diterima hanya oleh reservation expiry dan operations worker. Email dan ERP tetap memakai `CRON_SECRET` yang tidak diberikan kepada GitHub Actions. GitHub Environment `production` dibatasi ke branch `main`, dan credential khusus disimpan sebagai GitHub Environment secret serta Vercel Production secret. Run manual [37736188644](https://github.com/dzikriramdhani/wj/actions/runs/37736188644) pada 8 Oktober 2026 lulus untuk ketiga job: health check, expire reservations, dan process operations. Jadwal otomatis berjalan tiap lima menit. Email worker tetap belum dijadwalkan karena penerima queued email belum disetujui.

## Beralih ke layanan live

1. Masukkan credential Midtrans dan RajaOngkir live ke environment Production Vercel.
2. Ubah `PRODUCTION_INTEGRATION_MODE=live` dan `MIDTRANS_IS_PRODUCTION=true`.
3. Ubah notification URL di Midtrans Production Dashboard ke endpoint yang sama.
4. Jalankan preflight, smoke test, uji webhook resmi, dan review rilis sebelum menerima transaksi nyata.
