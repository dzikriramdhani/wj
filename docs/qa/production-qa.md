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

## Authorized production read-only and CI execution — 27 Oktober 2026

- Commit `1e3d48d5747e27e7211f5ecee5c66f942ad1392d` was pushed normally to `main`. Its Web CI run `40525092311` executed all non-browser gates successfully, then failed at Chromium installation because the `ubuntu-latest` image had moved to Ubuntu 26.04, unsupported by the locked Playwright 1.58.2.
- The smallest regression fix pinned the runner to `ubuntu-24.04`; commit `7d0a8303013cf00e54ba12290dc76ee6759e54cb` was pushed normally. Web CI run `40525479676` completed successfully: dependency install, Node tests, QA syntax, lint, typecheck, dependency audit, loopback-placeholder build, Chromium install, standalone startup, local HTTP guards, anonymous Playwright smoke, and cleanup all passed.
- Production Supabase preflight was executed in `production-authorized` mode with the confirmed project reference/HTTPS hostname and no API key, cookie, body read, database connection, or mutation. DNS resolved four public addresses; `GET /auth/v1/health`, `/rest/v1/`, and `/storage/v1/bucket` returned 401, 401, and 400 respectively without redirect.
- Production storefront cache retest used anonymous GET only, cancelled every response body, and logged status/`Cache-Control`/redirect only. `/api/account/profile` returned 401 `private, no-store`; Admin search and Super Admin CMS returned 403 `private, no-store`; synthetic-invalid order UUID returned 401 `private, no-store`; `/admin` and `/super-admin` returned 307 to login with no-store. No user data, cookie, token, or write was accessed.
- Authenticated private-success cache behavior, RBAC/RLS, cross-tenant, Storage, RFQ, checkout, payment, concurrency, MFA, and browser workflows remain blocked by the absence of an owned QA fixture and a disposable database. No production mutation was attempted.

## Final cache-hardening deployment verification — 27 Oktober 2026

- Commit `c1a8f77ee7fb6c0d9339fe2b18e056ad5a1a4489` was pushed normally to `main`. Its Web CI run `40529798955` completed successfully for the exact SHA: install, Node tests, QA checks, lint, typecheck, audit, local-placeholder build, Chromium, standalone startup, HTTP guards, anonymous Playwright smoke, and cleanup.
- GitHub deployment metadata reports a successful Vercel Production deployment for that same SHA. The generated deployment URL redirected to Vercel SSO with `Cache-Control: no-store, max-age=0`, so this access path cannot prove that the canonical production host is serving the exact SHA.
- A cookie-free, body-discarding `GET /api/quotations` on the current canonical production site returned 401 with `Cache-Control: private, no-store`. This is anonymous-denial evidence for the current public target, not exact-SHA runtime proof; it is not authenticated-success, cross-user cache, RBAC/RLS, or workflow evidence.
- No production data, Auth account, Storage object, database connection, payment, email, configuration, migration, or deployment configuration was changed by this verification. F-SEC-003 remains **PARTIALLY REMEDIATED / OPEN** until two owned QA identities can safely prove success and cache isolation.

## Provider inventory and non-destructive hardening — 27 Oktober 2026

- Official GitHub access can list secret metadata but not values. It confirmed staging repository credential entries and a production-environment scheduler credential entry. Production scheduler workflows invoke reservation expiry, operations, and email outbox; matching runtime/Vercel secret-store access and a rollback-tested replacement are unavailable, so F-SEC-005 rotation and provider log audit remain **BLOCKED**.
- Source audit found the three scheduler-triggered worker routes accepted GET and were called as GET by the checked-in workflows. The source fix converts them to POST-only, applies private no-store JSON responses, and changes official workflows to explicit POST. No production worker was invoked because it could mutate reservations or send queued email.
- Product/lookbook upload paths gained request-scoped, best-effort compensation for objects already uploaded before a failure. No storage object or database row was created, read, or deleted during this source/unit test work.

## Worker method deployment verification — 27 Oktober 2026

- Commit `e51fefb12c0d9d06a724ce53903d4c6696f5a328` was pushed normally to `main`. Its Web CI run `40533995887` completed successfully for the exact source SHA, including test, QA syntax, lint, typecheck, dependency audit, placeholder build, Chromium, local HTTP guards, and anonymous browser smoke.
- GitHub reports a successful Vercel Production deployment record for the same SHA. As with earlier deploy records, its direct URL is SSO-gated, so canonical-host-to-exact-SHA mapping cannot be proven from this path.
- Cookie-free GET requests, with all response bodies discarded, to the three current canonical internal worker endpoints each returned `405 Method Not Allowed`. No authorization header, worker POST, email, database request, Storage operation, or other state mutation was performed. These results prove current canonical GET denial only; successful authorized POST behavior remains deliberately untested because it would mutate production reservations or outbox state.

## Supabase provider identity boundary — 27 Oktober 2026

- The official Supabase CLI authenticated locally and its project-list metadata confirmed that the known production project reference is visible to the current account. No database connection, table inspection, Auth query, Storage listing, or mutation was made.
- The CLI’s secret-list help describes listing all project secrets but does not promise that secret values are redacted. It was deliberately not executed: inventory convenience does not override the rule against reading production secret values. Consequently provider-side secret rotation, consumer migration, and audit-log review remain **BLOCKED** pending an official redacted inventory/rotation workflow.

## Credential and QA readiness follow-up — 27 Oktober 2026

- Credential consumers and safe replacement order are documented in [credential-rotation-runbook.md](credential-rotation-runbook.md). The runbook is an operator procedure, not rotation evidence; no provider secret value, Vercel environment listing, Auth identity, database row, Storage object, or production mutation was accessed.
- Docker remains unavailable, and the correctly invoked database guard rejected the linked production metadata before opening a database connection. An isolated QA project, controlled mail sink, payment sandbox, two QA users, role fixtures, and exact-ID cleanup ledger remain required for authenticated cache, RLS, cross-tenant, commerce, and Storage runtime tests.

## Upload lifecycle and CMS denial verification — 27 Oktober 2026

- Commit `3c1178a6ef53d9a03e6546240e00cdabb15a6b2f` passed Web CI run `40538007645`: install, Node regression, QA syntax, lint, typecheck, high-severity dependency audit, local-placeholder build, Chromium, isolated HTTP guards, anonymous browser smoke, and cleanup.
- A canonical production request used `POST` with no cookie, authorization header, or body to the Super Admin CMS asset route. It returned 403 with `Cache-Control: private, no-store`; the response body was discarded. The route therefore did not reach form parsing, upload, or an authenticated action.
- This is only current canonical anonymous-denial evidence. Direct Vercel deployment URLs remain SSO-gated, exact-SHA mapping is not proven, and authenticated success/cache-isolation plus Storage runtime remain **BLOCKED**.
