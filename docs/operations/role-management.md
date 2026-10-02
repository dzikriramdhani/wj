# Panduan role

Wina Jaya memakai dua model akses yang terpisah: role platform untuk akses internal, serta membership organisasi untuk akses B2B suatu perusahaan.

## Role platform

| Role | Portal | Kemampuan |
| --- | --- | --- |
| `user` | `/account` | Belanja, checkout, melihat pesanan dan RFQ sendiri, serta memakai portal B2B bila menjadi anggota organisasi. Ditambahkan otomatis saat registrasi. |
| `admin` | `/admin` | Mengelola katalog dan lookbook, RFQ dan quotation, verifikasi B2B, pesanan, pembayaran, fulfillment, customer, operasi, dan governance. MFA mengikuti `ADMIN_MFA_REQUIRED`. |
| `super_admin` | `/super-admin` | Mengelola pemberian role Admin dan Super Admin, melihat governance, serta memakai seluruh area kerja Admin. MFA wajib pada setiap sesi. |

Sales, Finance, Warehouse, dan Content Admin tidak lagi menjadi role platform. Migration memindahkan setiap assignment lama tersebut ke `admin`. URL lama `/sales`, `/finance`, `/warehouse`, dan `/content` mengarahkan pengguna ke area Admin yang sesuai.

Seorang pengguna selalu memiliki role `user`. Super Admin dapat menambah atau mencabut `admin` dan `super_admin` melalui **Portal Super Admin → Pengguna & role**. Perlindungan database mencegah pencabutan Super Admin terakhir.

## Membership organisasi B2B

Membership ini berlaku hanya di dalam satu organisasi pada `/business`. Membership tidak memberi akses ke portal internal.

| Membership | Label | Kemampuan |
| --- | --- | --- |
| `owner` | Pemilik perusahaan | Mengelola anggota termasuk owner, mengirim dokumen verifikasi, dan menyetujui atau menolak quotation. |
| `admin` | Admin perusahaan | Mengelola anggota non-owner, mengirim dokumen verifikasi, dan menyetujui atau menolak quotation. |
| `buyer` | Pembeli perusahaan | Membuat RFQ untuk perusahaan yang sudah terverifikasi. |
| `viewer` | Pembaca perusahaan | Melihat informasi perusahaan. |

Database menjaga agar setiap organisasi selalu mempunyai sedikitnya satu `owner`. Admin perusahaan tidak dapat mengubah owner.

## Memberi role platform

1. Daftarkan orang tersebut melalui alur akun Wina Jaya biasa.
2. Jika belum ada Super Admin, ikuti [first-admin.md](first-admin.md).
3. Masuk sebagai Super Admin dan selesaikan MFA di **Akun Saya**.
4. Buka **Portal Super Admin → Pengguna & role**.
5. Cari akun dan aktifkan `admin` atau `super_admin`. Perubahan dicatat pada audit log.

Role `user` tidak diubah manual karena trigger autentikasi yang mengelolanya.

## Mengelola tim B2B

1. Owner membuat organisasi pada **Akun Saya → Portal Perusahaan**.
2. Buka **Kelola anggota**.
3. Masukkan email akun Wina Jaya rekan kerja dan pilih membership organisasi.
4. Gunakan pemilih role untuk mengubah membership anggota yang sudah ada.

Orang yang diundang harus sudah memiliki akun Wina Jaya. Portal tidak membuka daftar lengkap semua akun.

## MFA

Super Admin selalu memerlukan MFA. Admin memerlukan MFA bila `ADMIN_MFA_REQUIRED=true`. Pengguna akan diarahkan ke **Akun Saya → Verifikasi dua langkah** untuk mengaktifkan TOTP dan memasukkan kode enam digit.

Aktifkan TOTP MFA pada pengaturan Supabase Auth di lingkungan yang sama sebelum menerapkan kebijakan MFA pada production.
