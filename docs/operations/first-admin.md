# Menyiapkan Super Admin pertama

Registrasi publik selalu memberi role platform `user`. Browser tidak dapat meminta role internal.

Super Admin pertama adalah pengecualian bootstrap karena halaman pengelolaan role memerlukan Super Admin yang sudah ada. Daftarkan akun operator yang ditunjuk, lalu buka Supabase Dashboard SQL Editor pada proyek lingkungan yang benar. Ganti `AUTH_USER_UUID` dengan Auth user ID operator:

```sql
insert into public.user_roles (user_id, role_id, assigned_by)
select 'AUTH_USER_UUID'::uuid, roles.id, 'AUTH_USER_UUID'::uuid
from public.roles
where roles.name = 'super_admin'
on conflict (user_id, role_id) do nothing;
```

Setelah itu:

1. Masuk ke Wina Jaya dengan akun tersebut.
2. Buka **Akun Saya → Verifikasi dua langkah**, aktifkan MFA, pindai QR code TOTP, lalu masukkan kode enam digit.
3. Buka **Portal Super Admin → Pengguna & role**.
4. Berikan role `admin` kepada operator katalog, RFQ/B2B, pembayaran, dan fulfillment; berikan `super_admin` hanya kepada personel yang memang mengelola akses atau konfigurasi sensitif.

Gunakan **Portal Perusahaan** untuk membership B2B. Membership itu tidak dikelola dari Portal Super Admin. Rincian kedua model akses ada di [role-management.md](role-management.md).

Ulangi prosedur bootstrap ini untuk STAGING dan PRODUCTION hanya setelah memeriksa proyek Supabase dan identitas operator yang tepat. Jangan masukkan UUID atau kredensial nyata ke seed publik atau source code.
