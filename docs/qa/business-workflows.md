# Alur Bisnis yang Terlihat

Alur berikut direkonstruksi dari source dan migrasi. Belum ada yang dijalankan end-to-end pada database uji pada audit ini.

## Registrasi dan akun

1. User mengisi `/register`; `/api/auth/register` membuat akun melalui Supabase Auth.
2. Trigger database membuat profil dan role dasar `user`.
3. Email confirmation kembali melalui `/auth/callback` atau `/auth/confirm`; callback path dibatasi helper `app-url.ts`.
4. Login/logout memakai Supabase Auth. `/account` membaca profil dan transaksi melalui session/RLS. MFA TOTP disediakan untuk Admin/Super Admin sesuai aturan role.
5. Password reset memiliki endpoint, rate-limit DB, validasi password, dan callback khusus. Tes unit lokal mencakup validator, URL, header dan sanitasi Sentry; email reset nyata tidak diuji.

## Pengajuan perusahaan dan verifikasi

1. User membuat organisasi melalui `/api/business/organizations`; membership organisasi `owner` dibuat lewat RPC.
2. Owner/admin mengunggah PDF/JPEG/PNG ke bucket privat `business-documents`; API membatasi 10 file, 20 MB/file, memeriksa membership dan signature file.
3. Owner/admin mengirim dokumen/profil ke `/api/business/verification`; status dan tinjauan dikelola melalui RPC.
4. Admin/Super Admin menerima atau menolak verifikasi (`verified`/`rejected`). RLS membatasi organisasi/dokumen.
5. Tidak ada fixture uji untuk duplikasi, resubmit, akses dokumen antar organisasi, atau rejection workflow.

## RFQ dan quotation B2B

1. User memilih organisasi verified dan mengirim produk/kuantitas/spesifikasi/deadline/attachment dari `/rfq/new`.
2. `/api/rfq` memerlukan Idempotency-Key, session terverifikasi, Zod payload, dan RPC atomik. Database memeriksa membership owner/admin/buyer di organisasi verified.
3. Admin meninjau RFQ dan membuat quotation dengan item, harga, syarat pembayaran, dan masa berlaku; API menggunakan RPC database.
4. Admin mengirim quotation. User merespons accepted/rejected atau mengirim pesan negosiasi melalui RPC. Revisi/approval tersimpan di tabel terkait.
5. Persetujuan quotation dapat membuat bulk order; pembayaran B2B memiliki endpoint Midtrans sendiri.
6. Status/RLS, masa berlaku, concurrency, percobaan User B, dan duplikasi notifikasi belum diuji pada environment terisolasi.

## Pembelian satuan dan order

1. User menjelajah katalog, memilih variant/kuantitas dalam meter dan menyimpan cart di browser.
2. Checkout memerlukan user login, alamat snapshot dengan kode pos, quote pengiriman, dan 1–30 item. Harga, stok, diskon, dan total final dihitung di sisi server/database; client tidak mengirim harga yang dipercaya.
3. `/api/orders` menerima Idempotency-Key dan hash request, lalu RPC transaksional membuat order, item, pembayaran/reservasi sesuai migration checkout.
4. Shipping quote memakai integrasi RajaOngkir; pembayaran memakai Midtrans. Webhook divalidasi signature-nya dan diproses lewat RPC. Detail order difilter menurut user ID atau guest session.
5. Admin dapat merekonsiliasi pembayaran dan mengubah fulfillment; user melihat status order/invoice/pengiriman.
6. Tidak ditemukan API retail refund/cancel. Checkout bersamaan, harga/stok berubah, pembayaran gagal, webhook berulang, dan retry belum diuji.

## CMS homepage

1. Super Admin mengubah draft tervalidasi dan dapat memulihkan revision.
2. Aksi publish memanggil RPC, mencatat revision, merevalidasi tag/path.
3. Storefront membaca `published_content`; source memisahkan draft dan publikasi.
4. Tes role, stored XSS, preview, dan konsistensi cache belum dijalankan. Pencarian source tidak menemukan `dangerouslySetInnerHTML`; ini bukan bukti menyeluruh keamanan XSS.

## Cross-role dan concurrency

Semua 12 langkah skenario user → admin → quotation → payment → order → CMS yang diminta **BLOCKED** karena tidak tersedia DB lokal/container, akun role terpisah, seed terisolasi, atau sandbox provider yang dikonfirmasi. Migration checkout memiliki guard idempotency/advisory lock secara statis; ini bukan bukti bahwa migration aktif atau race benar-benar tertangani runtime.
