# Playwright E2E Results

## Status: PARTIAL PASS / BLOCKED

Playwright Test 1.58.2 dipasang dari npm cache lokal dan diverifikasi dengan `npx playwright --version`. Browser Chromium 1.61.1 yang sudah ada di cache mesin dipakai untuk tes lokal; browser revision pasangan otomatis Playwright 1.58.2 tidak tersedia. CI memasang browser yang cocok. Docker tidak tersedia; PostgreSQL lokal menerima koneksi TCP pada `127.0.0.1:5432`, tetapi `psql -w` ditolak karena tidak ada password dan identity database tidak terverifikasi disposable. Guard DB berhenti karena link Supabase menunjuk project production; tidak ada koneksi atau mutasi DB.

| Alur | Hasil |
|---|---|
| Homepage dan katalog public | PASS: browser Chromium lokal; HTTP 200 dan body ter-render |
| Anonymous direct `/admin` dan `/super-admin` | PASS: dua browser tests diarahkan ke halaman login |
| Detail, cart, responsive/accessibility | NOT IMPLEMENTED; belum ada assertion elemen, viewport, atau keyboard |
| Register/login/logout/session dan direct URL tiap role | BLOCKED; tidak ada isolated Auth/browser |
| Company application → Admin verification → RFQ → quotation → acceptance → B2B order | BLOCKED; database/RLS fixture belum ada |
| Retail catalog → cart → checkout → simulated payment → webhook → fulfillment | BLOCKED; tidak ada database atau payment sandbox |
| User B / Organization B mencoba akses data A | BLOCKED; belum ada tenant identities |
| Super Admin account/role/MFA dan CMS draft/publish | BLOCKED; belum ada local identity dan browser |

## Local browser E2E yang benar-benar dijalankan

Command: `npm run test:e2e:local` dengan marker `local`, URL tetap `http://127.0.0.1:3100/`, dan cached Chromium. Hasil **3 passed**: homepage+katalog, direct admin redirect, direct super-admin redirect. Runner headless; traces, screenshots, dan video mati. Test memblokir image optimization requests agar tidak memanggil hostname avatar eksternal. Ini hanya anonymous browser smoke tanpa database/Auth fixture.

Attempt awal pada Windows sandbox mendapat `spawn EPERM` saat Playwright membuat worker, dan satu HTTP smoke dimulai sebelum server listen lalu timeout. Setelah server dijalankan dengan izin proses lokal yang dibutuhkan dan endpoint readiness diverifikasi, HTTP smoke 6/6 serta browser suite 3/3 lulus. Tidak ada assertion failure yang tersisa pada final run.

Regression hardening: pada run awal dengan public Supabase config lokal tidak lengkap, page Admin/Super Admin tetap mencoba membuat service client sebelum parent layout redirect. Kedua page sekarang memeriksa user, role, serta MFA sebelum pembacaan service-role. `test/qa/privileged-page-order.test.mjs` mengunci urutan itu. E2E anonim akhir lulus. Ini bukan bukti auth/RLS runtime.

Production authenticated E2E tidak dijalankan: belum ada identitas QA, koneksi DNS ke Supabase gagal, dan browser profile pribadi tidak digunakan. Tidak ada user/org/order/RFQ/Storage/payment fixture pada production.

## Runtime checks lain yang benar-benar dijalankan

### Built local application (tanpa database/auth provider)

`npm run qa:local-http` dijalankan terhadap standalone production build pada `http://127.0.0.1:3100/` dengan marker local eksplisit. Hanya GET tanpa cookie/header auth:

| Route | Expected | Actual | Status |
|---|---:|---:|---|
| `/api/account/profile` | 401 + `private, no-store` | 401 + `private, no-store` | PASS |
| `/api/admin/search?q=qa-cache-check` | 403 + `private, no-store` | 403 + `private, no-store` | PASS |
| `/api/super-admin/content/home` | 403 + `private, no-store` | 403 + `private, no-store` | PASS |
| `/api/orders/00000000-0000-4000-8000-000000000000` | 401 + `private, no-store` | 401 + `private, no-store` | PASS |
| `/admin`, `/super-admin` | Redirect login, no-store | 307 ke login, no-store | PASS (2 routes) |

Ini runtime pada local built app, bukan database integration, browser E2E, atau autentikasi tiga role. URL lokal harus tetap `127.0.0.1:3100`; harness menolak host remote.

### Production read-only HTTP

Dengan Node `fetch`, tanpa cookie dan hanya method GET: homepage, `/products`, `/login` memberi 200; `/admin` dan `/super-admin` redirect 307 ke login; katalog API 200; API profil/order 401; pencarian Admin dan CMS Super Admin 403. Empat respons 401/403 hanya memiliki properti `error`, tanpa cookie sesi. Empat GET ke endpoint POST-only (login, RFQ, orders, organizations) memberi 405. Hasil ini tidak menguji role terautentikasi atau RLS.

Observasi halaman melalui browser UI sempat menemukan sesi autentikasi yang sudah aktif. Pengujian langsung dihentikan, tab ditutup, dan tidak ada screenshot, trace, cookie, atau data akun yang disimpan/dikutip. Karena itu hasil browser tidak dihitung sebagai anonymous E2E.

Tidak ada screenshots, traces, akun, atau kredensial yang dibuat. Tidak ada cart, RFQ, order, pembayaran, upload, account, atau CMS mutation yang dijalankan pada production. Role/B2B/retail E2E masih belum terimplementasi dan tidak dihitung PASS.

## Rerun terbaru — 24 Oktober 2026

`npm run test:e2e:local` diulang pada standalone build yang telah lolos pemeriksaan tidak ada `.env*` di root standalone. Runner hanya memberi Supabase URL loopback dan placeholder publishable key; environment desktop dibersihkan sebelum menjalankan tes; browser memakai executable Chromium dari cache Playwright dan context baru. **3/3 PASS**: homepage/katalog, anonymous direct `/admin`, dan anonymous direct `/super-admin`. Trace, screenshot, serta video tetap off. Server berhenti sesudah tes dan port 3100 tidak lagi listen.

Percobaan awal pada run yang sama gagal memulai tes karena executable default Playwright tidak tersedia pada sandbox-local cache. Setelah menemukan cache browser sistem, percobaan awal memakai `next start` langsung dari repository untuk mengatasi isolasi loopback. Karena `.env.local` ada dan Next dapat memuatnya, percobaan itu berpotensi membaca konfigurasi lokal; tidak ada nilainya yang dibaca/ditampilkan dan hasilnya tidak dihitung. Tidak dapat dipastikan apakah halaman membuat backend GET. Tidak ada aksi write dari tes. E2E kemudian diulang memakai runner standalone yang terisolasi dan hasil 3/3 di atas adalah satu-satunya PASS yang dihitung untuk rerun ini.

Rerun production website masih **BLOCKED**: `wj-wine.vercel.app`, Supabase hostname, dan `example.com` semuanya gagal DNS; browser inspection tool juga tidak dapat membuka target. Tidak ada GET production baru yang terkirim pada run ini.

## Current-artifact status — 26 Oktober 2026

No E2E or local HTTP smoke was rerun after the dependency update because the current isolated production build did not complete (`EPERM` in temporary Next output). The existing 3-browser and 6-HTTP local results remain historical evidence for the prior standalone artifact only; they are **not** used to validate Next 16.4.3. No production browser session, QA account, authenticated workflow, or mutation was used in this checkpoint.

## Build recovery follow-up — 27 Oktober 2026

The current isolated build now exits 0, but its generated workspace is deliberately removed after verification. The historical local HTTP (6 checks) and browser (3 checks) results are therefore still not reclassified as validation of this new artifact. The CI workflow contains a fresh-build standalone start plus the HTTP/Playwright steps, but CI has not been triggered for the dirty working tree. Authenticated E2E remains **BLOCKED**.
