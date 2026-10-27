# Production QA Target dan Preflight

Tanggal: 24 Oktober 2026 (Asia/Jakarta)

## Target dan izin

- Pemilik mengonfirmasi project ref `qcgcpheeskkdcnxspbgx` sebagai target production dan mengizinkan QA.
- Hostname yang diverifikasi konfigurasi harus persis `qcgcpheeskkdcnxspbgx.supabase.co` pada HTTPS.
- Runtime mode hanya menerima `TEST_ENVIRONMENT=production-authorized` dan `QA_PRODUCTION_AUTHORIZED=true`; URL/ref mismatch ditolak.
- Tidak ada `.env.qa.production` atau QA credentials di environment proses. `.env.local` tidak dibaca. Template `.env.qa.production.example` berisi target dan placeholder saja.
- Production runner hanya memanggil GET pada `/auth/v1/health`, `/rest/v1/`, dan `/storage/v1/bucket`, tanpa key, cookie, redirect following, database connection, atau request body. Ia tidak memanggil migration/RPC write.

## Hasil preflight runtime

| Check | Environment | Expected | Actual | Status |
|---|---|---|---|---|
| Target config ref dan URL cocok | Production-authorized, nilai eksplisit tanpa credential | ref dan HTTPS host cocok persis | Production target guard unit test PASS; nilai yang diberikan cocok | PASS konfigurasi, bukan live identity |
| DNS host Supabase terkonfirmasi | `production-authorized`, 2026-10-24 20:48:53 +07:00 | hostname resolves ke alamat publik | DNS gagal (`ENOTFOUND`); domain pembanding publik `example.com` juga tidak resolve | BLOCKED sebelum request |
| HTTP health, REST OpenAPI root, Storage bucket endpoint | `production-authorized`, 2026-10-24 20:48:53 +07:00 | status HTTP direkam tanpa membaca body | Runner berhenti pada DNS; tidak satu pun request dikirim | BLOCKED |
| DB read-only connection dan live catalog | Production-authorized | server identity, migration history, schema/policies/grants runtime | tidak ada DB credential/QA connection dan DNS tidak tersedia | BLOCKED; tidak ada koneksi |
| Auth QA account, JWT/RLS, Storage object | Production-authorized | identitas sintetis yang pemilikannya diketahui | tidak tersedia; tidak membuat akun/objek | BLOCKED |

Sebelumnya dalam audit yang sama telah direkam 18 observasi HTTP production read-only tanpa cookie: 10 route status, 4 response error-shape, dan 4 unsupported-method checks. Hasil lama itu tidak memverifikasi Supabase database, role terautentikasi, RLS, Storage policy, atau keadaan migration live dan tidak dianggap hasil preflight baru.

## Konfigurasi mode

- `local`: `local-test-target.mjs`, hanya loopback port dan identitas DB lokal yang cocok; metadata link remote tetap ditolak.
- `staging`: `assertStagingAuthorizedTarget()` menuntut marker `staging`, flag `QA_STAGING_AUTHORIZED=true`, ref 20 karakter non-production yang dikonfigurasi eksplisit, dan hostname HTTPS yang cocok. Belum ada staging target yang disediakan dan belum ada runner staging.
- `production-authorized`: `production-test-target.mjs` serta `run-production-qa.mjs`; tidak ada fallback ke `.env.local` atau Supabase CLI link. Public preflight memerlukan marker/flag/ref/URL eksplisit dan target yang cocok persis.

Perintah read-only (jalankan dari `apps/web`):

```powershell
$env:TEST_ENVIRONMENT = 'production-authorized'
$env:QA_PRODUCTION_AUTHORIZED = 'true'
$env:QA_PRODUCTION_PROJECT_REF = 'qcgcpheeskkdcnxspbgx'
$env:QA_PRODUCTION_SUPABASE_URL = 'https://qcgcpheeskkdcnxspbgx.supabase.co'
npm run qa:production:preflight
```

Perintah ini hanya melakukan GET setelah DNS lulus. Ia tidak menggunakan key dari file `.env.local`; optional publishable key hanya boleh diletakkan pada `.env.qa.production`, tidak digunakan public preflight, dan tidak membuktikan RLS.

## Mutasi dan fixture QA

`qa:production:mutations` tidak mengeksekusi operasi bisnis. Mode ini memerlukan `QA_ALLOW_SYNTHETIC_MUTATIONS=true`, namespace `qa-<run>-<uuid>`, UUID pemilik QA yang dikonfirmasi, dan konfirmasi owner. Setelah validasi pun runner sengaja berhenti karena belum ada adapter fixture/manifest yang mendaftarkan jenis objek, ownership path, captured created IDs, dan cleanup selektif. Tidak ada object/account/record yang boleh dihapus tanpa bukti dibuat oleh run.

Gate mutation dicoba 2026-10-24 20:49:06 +07:00 tanpa flag, namespace, atau QA owner; hasilnya `BLOCKED` pada flag tambahan, sebelum network dan sebelum operasi apa pun.

Tidak ada akun QA, email, dokumen, order, RFQ, Storage object, pembayaran, refund, email eksternal, atau data lain dibuat/diubah/dihapus pada project production selama fase ini. Tidak ada perubahan konfigurasi atau Supabase link metadata.

## Keterbatasan dan tindak lanjut

1. Pulihkan akses DNS/egress dari runner yang berizin. Ulangi preflight; jangan mengubah target URL untuk melewati guard.
2. Operator sediakan konfigurasi khusus `.env.qa.production` melalui secret store lokal yang aman jika API read-only membutuhkan publishable key; jangan menyalin `.env.local`.
3. Untuk Auth/RLS, sediakan identitas QA sintetis yang dikendalikan operator dan JWT/session login normal. Jangan memakai service-role key sebagai bukti RLS.
4. Untuk mutasi, siapkan fixture adapter terpisah dengan owner QA terverifikasi, namespace run, daftar objek dibuat, pencatatan ID, dan cleanup hanya untuk ID tersebut. Sandbox pembayaran/email/ERP harus dibuktikan sebelum mengaktifkan alur terkait.
5. Jangan jalankan ZAP, load test, transaksi, upload, atau perubahan CMS pada production sampai scope dan isolasi masing-masing terbukti.

**Verdict preflight:** BLOCKED untuk live Supabase identity/schema/Auth/RLS/Storage; tidak ada HTTP request ke Supabase pada run ini. **Release verdict:** HOLD.

## Follow-up runtime check — 24 Oktober 2026

Hasil diperiksa pada 21:26 WIB. DNS dijalankan terpisah untuk ketiga hostname yang diminta:

| Host | Hasil DNS | HTTP | Status |
|---|---|---|---|
| `qcgcpheeskkdcnxspbgx.supabase.co` | Resolver gagal (`Win32Exception`) | Tidak dikirim | BLOCKED sebelum HTTP |
| `wj-wine.vercel.app` | Resolver gagal (`Win32Exception`) | Tidak dikirim | BLOCKED sebelum HTTP |
| `example.com` | Resolver gagal (`Win32Exception`) | Tidak dikirim | BLOCKED; kegagalan resolver/jaringan, bukan bukti layanan target down |

`npm run qa:production:preflight` diulang dengan marker, approval, ref, dan URL tepat; runner berhenti sebelum HTTP dengan `Confirmed production hostname could not be resolved ... no HTTP request was sent.` Browser inspection tool juga tidak dapat membuka route production. Tidak ada GET yang berhasil dikirim ke hostname production yang dikonfirmasi pada follow-up ini; 18 pemeriksaan HTTP yang tercatat di atas tetap merupakan bukti audit terdahulu, bukan run baru. Percobaan `next start` yang berpotensi memuat `.env.local` dapat saja melakukan backend read ke target yang tidak diketahui; hal itu tidak dapat diverifikasi dan dirinci pada catatan keselamatan berikut.

## Baseline dan local runtime terbaru

- `npm test`: exit 0, 37 PASS, 0 FAIL, 1 SKIP dari 38 test.
- `npm run qa:check`: exit 0.
- `npm run lint`: exit 0, 0 error dan 6 warning `<img>`.
- `npm run typecheck`: exit 1. TypeScript berhenti pada sintaks tidak valid di generated `.next/dev/types/routes.d.ts` dan `.next/dev/types/validator.ts`; file generated tersebut tidak diedit. TSC source-only dengan temporary config yang mengecualikan `.next` dan `next-env.d.ts` exit 0, tetapi itu tidak memvalidasi Next route types.
- `npm audit --audit-level=high`: BLOCKED; registry `registry.npmjs.org` gagal DNS (`ENOTFOUND`), sehingga tidak ada hasil audit terkini.
- `npm run qa:db:guard` dan `npm run test:integration`: BLOCKED oleh metadata Supabase CLI yang menunjuk project production; guard berhenti sebelum membuka koneksi, membaca file fixture, atau menjalankan migration.
- `npm run qa:local-http`: 6/6 PASS pada app standalone loopback. `npm run test:e2e:local`: 3/3 PASS pada runner standalone dengan env allowlist, placeholder Supabase loopback, Chromium dari cache, dan tanpa trace/screenshot/video.
- Build terbaru tidak dinyatakan PASS. Build di repository tidak dijalankan karena Next dapat memuat `.env.local`; build copy terisolasi tidak berhasil disiapkan karena junction dependency tidak diizinkan/robocopy copy tidak mempertahankan dependency symlink. Build PASS terdahulu tetap hasil historis.

### Catatan keselamatan saat E2E

Pada percobaan awal untuk memperbaiki konektivitas loopback, server sempat diluncurkan memakai `next start` langsung dari repository, bukan `scripts/qa/start-local-standalone.mjs`. File `.env.local` diketahui ada (keberadaannya saja yang diperiksa). Next dapat memuat file tersebut otomatis; saya tidak membaca atau mencetak nilainya, tetapi tidak dapat memastikan apakah proses sempat memuatnya atau melakukan backend read. Percobaan tersebut hanya membuka homepage, katalog, dan dua dashboard anonim; tidak ada form submit atau operasi write. Hasilnya **dikeluarkan dari bukti PASS**. Proses dihentikan dan port 3100 diverifikasi tidak lagi listen. E2E kemudian diulang 3/3 PASS melalui standalone runner yang menolak `.env*` dan memberi child process konfigurasi loopback eksplisit. Tidak ada trace, screenshot, video, atau nilai credential yang disimpan.

**Status live website/Supabase tetap BLOCKED**, bukan down atau PASS. Tidak ada write, migration, Auth/Storage mutation, transaksi, email, atau konfigurasi production yang dilakukan.

## Follow-up production-authorized dan perbaikan typecheck — 26 Oktober 2026, 17:44 WIB

Environment runner: branch `main`, commit `1bec6c7`, Node `22.23.3`, npm `11.6.1`, Next `16.3.6`. Tidak ada `.env.qa.production` yang dibuat atau `.env.local` yang dibaca.

- Root cause typecheck terverifikasi: `tsconfig.json` memasukkan `.next/dev/types/**/*.ts`, sementara generated `routes.d.ts` dan `validator.ts` sebelumnya korup/truncated. Dokumentasi Next 16 yang terpasang menyatakan `next typegen` sebagai generator deklarasi rute untuk CI. Script `scripts/qa/prepare-next-typecheck.mjs` kini menghapus **hanya** `.next/dev/types` apabila merupakan direktori biasa di bawah `.next`, lalu `npm run typecheck` menjalankan `next typegen && tsc --noEmit`.
- `npm run typecheck` pada salinan aplikasi terisolasi tanpa `.env*` berhasil (exit 0) dengan command resmi tersebut. Percobaan langsung di repository mencapai `next typegen` tetapi runner interaktif berhenti pada batas 30 detik sebelum exit code tersedia; hasil direct run adalah **INCONCLUSIVE**, bukan PASS. `npm test` tetap 37 PASS, 0 FAIL, 1 SKIP; `npm run lint` dan `npm run qa:check` PASS.
- `scripts/qa/run-isolated-build.mjs` ditambahkan untuk build dari salinan sementara tanpa `.env*`, `.next`, `node_modules`, atau hasil tes dan meneruskan hanya environment loopback/placeholder ke Next. Percobaan build mencapai `Creating an optimized production build`, tetapi tidak menghasilkan exit code sebelum batas runner; build tetap **BLOCKED/INCONCLUSIVE**.

### Production read-only

Runner production dengan `TEST_ENVIRONMENT=production-authorized`, `QA_PRODUCTION_AUTHORIZED=true`, ref dan hostname exact berhasil resolve empat alamat publik lalu mengirim GET tanpa API key, cookie, body, database connection, atau mutation:

- Supabase `/auth/v1/health`: 401; `/rest/v1/`: 401; `/storage/v1/bucket`: 400; tidak ada redirect.
- Website `https://wj-wine.vercel.app`: `/`, `/products`, `/login`, `/api/products`, dan `/api/health` memberi 200. `/admin` dan `/super-admin` memberi 307 ke login serta `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.
- Semua tujuh route website membawa CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, dan `Permissions-Policy` yang diharapkan. Header dan status dicatat tanpa `Set-Cookie` atau response body.
- GET anonim ke `/api/account/profile`, `/api/admin/search`, dan `/api/super-admin/content/home` ditolak (masing-masing 401, 403, 403). Namun ketiganya mengirim `Cache-Control: public, max-age=0, must-revalidate`, berlawanan dengan helper source `privateJson()` yang memaksa `private, no-store`. Ini adalah temuan runtime/deployment F-SEC-003; perubahan source belum terbukti deployed. `/api/orders/not-a-real-qa-order` memberi 400 dengan cache publik karena ID invalid.

Tidak ada request production yang mengubah state. Authenticated RBAC, RLS, Storage, checkout, payment, RFQ, concurrency, database catalog, dan browser E2E beridentitas QA masih BLOCKED karena tidak ada fixture/identity QA terisolasi atau database test.

### REA artifact evidence

REA menganalisis statis direktori local `apps/web/.next/standalone` tanpa menjalankan bundle (Evidence `ev_a6c4d46a307f9df0b0977233fa0cf20015c5fab208c24aa4d8275b5526998e03`; SHA-256 artifact `7193793c849f61c18ada50247bf073807160bdd6869e5eeb862702682b073e4b`). Hanya `server.js` dipilih; 2.693 file inventoried tidak dianalisis. Evidence ini membuktikan artifact lokal yang diperiksa dan batas cakupannya, bukan kesetaraan dengan production, eksekusi runtime, atau keamanan flow yang belum diuji.

## Dependency remediation dan final type gate — 26 Oktober 2026

- Audit registry awal menemukan 3 advisory: Next `16.3.6` Critical, Nodemailer `7.0.13` High, dan Zod `4.6.5` High. Setelah compatibility check, dependency diperbarui eksplisit tanpa `--force`: Next `16.4.3`, Nodemailer `10.2.1`, dan Zod `4.6.6`. `npm ls` mengonfirmasi ketiga versi dan `npm audit --audit-level=high --package-lock-only` melaporkan **0 vulnerabilities**.
- Regresi setelah upgrade: `npm test` 37 PASS, 0 FAIL, 1 SKIP; `npm run lint` PASS; `npm run qa:check` PASS.
- `next typegen` pada Next `16.4.3` menghasilkan `.next/types/*`; guard diperbaiki untuk membersihkan kedua lokasi generated (`.next/dev/types` dan `.next/types`) hanya apabila merupakan direktori reguler di bawah `.next`. Generated `routes.d.ts`/`validator.ts` bebas dari marker truncation terdahulu dan `tsc --noEmit` exit 0.

## Closure checkpoint — 26 Oktober 2026

- `npm test` completed with 42 PASS, 0 FAIL, and 1 SKIP after adding a source-level cache policy regression for four private API routes. `npm run qa:check` and `npm run typecheck` also exited 0.
- The isolated Webpack build was retried with only an allowlisted loopback/placeholder environment. It failed with `EPERM` while Next created temporary output under `.qa-isolated-build-*`; its generated workspace was removed by the runner. No build success is claimed and prior standalone smoke evidence is not promoted to this artifact.
- A fresh npm registry audit could not run because `registry.npmjs.org` failed DNS resolution (`ENOTFOUND`). The earlier zero-advisory result remains historical evidence only.
- No production preflight or production request was repeated, and no production data, configuration, Auth, Storage, payment, email, migration, or account state was changed in this checkpoint. F-SEC-003 remains OPEN pending approved deployment and retest.

## Build recovery — 27 Oktober 2026

- Root cause for the prior isolated-build `EPERM` was reproduced with a minimal Next 16.4.3 fixture containing the same dynamic route shape (`/api/products/[slug]`): inside the restricted runner, Next failed with `spawn EPERM`; outside that sandbox, the same fixture completed with exit code 0. The original application build was then run through the same isolated-copy/allowlisted-environment runner outside the restricted subprocess sandbox and also completed with exit code 0.
- Successful command: `npm run qa:build:isolated:webpack` from `apps/web`. It used a new generated workspace, the repository dependency tree/lockfile, no `.env*` files, loopback Supabase URL, placeholder publishable key, and empty server secret. It completed compilation, TypeScript, 48 static pages, trace collection, final optimization, and cleanup.
- During static generation, the homepage logged that its Supabase server secret was unavailable. This was the intended placeholder condition; the page’s fallback completed and Next exited 0. It is not a production CMS or database runtime PASS.
- No deployment or production read-only request was made during build recovery. F-SEC-003 remains **OPEN**.

### Local gate execution note

- `npm test` invoked inside the restricted runner failed before assertions because the Node test runner could not spawn its per-file workers (`spawn EPERM`, 14 harness files). The identical command outside that restriction exited 0 with **42 PASS, 0 FAIL, 1 SKIP**. This is recorded as a runner limitation, not an application test failure.
- `npm run qa:check`, `npm run lint` (0 errors, 6 existing `<img>` warnings), and `npm run typecheck` all exited 0 after build recovery.
