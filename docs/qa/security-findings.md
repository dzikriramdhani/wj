# Temuan Keamanan

Temuan berasal dari source/migration, tes lokal, dan observasi HTTP production read-only tanpa cookie. Tidak ada autentikasi role-specific, scan aktif, operasi mutasi production, atau pengujian terhadap provider eksternal.

## F-SEC-001 — Upload mempercayai MIME yang dikirim client

- **Severity:** Medium sebelum perbaikan; regresi source sudah diperbaiki.
- **Komponen:** Upload dokumen verifikasi, lampiran RFQ, gambar produk, lookbook, dan aset CMS.
- **Bukti:** Sebelumnya semua route hanya mencocokkan `file.type`, lalu mengirim nilai itu sebagai `contentType` ke Storage. MIME request dapat ditentukan client; pemeriksaan bucket juga memakai metadata MIME.
- **Dampak:** File dengan konten berbeda dapat disimpan memakai ekstensi/content-type yang dipercaya konsumen berikutnya.
- **Perbaikan:** Helper `src/lib/upload-validation.ts` memeriksa byte signature PDF, JPEG, PNG, WebP, atau AVIF sebelum upload pada kelima jalur. Jumlah file, MIME allowlist, batas ukuran dan authorization yang berlaku tetap digunakan.
- **Regression test:** `test/upload-validation.test.ts`.
- **Status:** PASS untuk helper unit; **belum** diuji melalui Supabase Storage. Signature check bukan pemindai malware atau validator penuh format/decoder.

## F-SEC-002 — Rate limit hanya berada di memori proses

- **Severity:** Medium (risiko operasional/security berdasarkan pola deployment serverless; perlu konfirmasi topology runtime).
- **Komponen:** `src/lib/rate-limit.ts` dan endpoint yang memanggil `checkRateLimit` (mis. RFQ, checkout, login/role sensitif).
- **Bukti:** Counter tersimpan dalam `Map` module-level dan identitas berasal dari header proxy request.
- **Reproduksi konseptual:** Kirim percobaan ke instance berbeda/restart; tiap proses dapat mempunyai counter kosong. Kepercayaan terhadap forwarded IP bergantung pada proxy yang benar-benar menghapus/menulis ulang header tersebut.
- **Dampak:** Batas permintaan dapat berbeda antar-instance atau di-reset saat cold start; brute-force/abuse tidak konsisten dibatasi.
- **Rekomendasi:** Rate limit shared yang transaksional (RPC/database/Redis/edge) dan hanya memakai client IP yang ditetapkan trusted ingress.
- **Regression test:** Belum ada distributed test.
- **Callsite inventory (27 Oktober 2026):** `checkRateLimit` dipanggil oleh login, register, contact, RFQ, order/checkout, payment QR retail/B2B, Midtrans initiation, kategori Admin, perubahan role Super Admin, dan organization membership. Password reset memakai RPC/HMAC guard terpisah.
- **Implementation proposal:** Pilih satu atomic shared backend approved by architecture (Supabase RPC/table with bounded retention, managed Redis, or edge provider). Define trusted ingress so the platform overwrites the client-IP header before application use; do not trust an arbitrary client-supplied `x-forwarded-for`. Add multi-instance/restart tests plus proxy-header tests in the isolated QA target before rollout.
- **Status:** OPEN; belum diverifikasi di production/staging dan tidak diubah karena shared storage dan deployment policy belum tersedia.

## F-SEC-003 — Response privat tidak selalu menetapkan cache `private, no-store`

- **Severity:** Medium (potensi disclosure pada cache bersama; belum ada bukti respons berisi data privat benar-benar disimpan/disajikan silang pengguna).
- **Komponen:** `/api/admin/search`, `/api/account/profile`, `/api/orders/[id]`, `/api/super-admin/content/home`.
- **Bukti sebelum perbaikan:** Production GET tanpa cookie menerima respons 401/403 dengan `Cache-Control: public, max-age=0, must-revalidate`. Source admin search mengembalikan hasil nama produk/SKU, organisasi/status, dan RFQ/status tanpa header cache privat pada success path. Beberapa response error route privat juga tidak memberi header eksplisit.
- **Risiko:** Jika deployment/cache layer mengubah kebijakan revalidation, data pencarian bisnis atau response berbasis sesi berisiko ditangani sebagai response publik. Cross-user cache exposure belum direproduksi.
- **Perbaikan:** `src/lib/api-response.ts` menambahkan `privateJson()` yang memaksa `Cache-Control: private, no-store`; dipakai pada semua response account profile, order detail, admin search, dan Super Admin CMS route.
- **Regression:** `test/api-response.test.ts` memastikan header `public` dari pemanggil ditimpa; `npm run qa:local-http` memverifikasi empat API 401/403 tanpa cookie di standalone build lokal.
- **Retest:** PASS local: 4 API mengirim `private, no-store`; dashboard route 307/no-store. Production belum di-deploy, jadi retest production pascaperbaikan BLOCKED.
- **Status:** FIXED IN WORKING TREE, belum ter-deploy; wajib retest setelah release.

## F-SEC-004 — Dashboard Admin memakai service role tanpa page-level authorization guard

- **Severity:** Medium (unsafe privileged-read ordering; kebocoran response kepada client belum dibuktikan).
- **Komponen:** `src/app/admin/page.tsx`, `src/app/super-admin/page.tsx`.
- **Bukti:** Source awal membuat service client dan mengirim query bisnis/daftar akun sebelum memeriksa role sendiri; pemeriksaan hanya ada di parent layout. Pada local browser run dengan konfigurasi Supabase publik tidak lengkap dan tanpa server secret, Next menjalankan page component dan mencatat kegagalan konstruksi service client saat route dashboard sedang diarahkan keluar oleh layout. Ini membuktikan eksekusi page-side tidak aman untuk diasumsikan menunggu layout. Tidak ada service key diberikan dan tidak ada data diakses.
- **Dampak:** Dengan service credentials aktif, render request yang tak berizin dapat memicu privileged reads sebelum guard di layout; response data yang bocor tidak direproduksi.
- **Perbaikan:** Kedua page sekarang memeriksa user, role platform dan MFA di dalam page sebelum `createServiceClient()` atau query dijalankan.
- **Regression:** `test/qa/privileged-page-order.test.mjs` memverifikasi urutan guard dan dua browser E2E anonymous memastikan direct dashboard navigation menuju login. Tes source-order bukan bukti RLS/database; service credential tetap tidak tersedia dalam smoke.
- **Status:** FIXED IN WORKING TREE; source-order suite dan local anonymous E2E PASS. Authenticated runtime verification BLOCKED sampai ada local Supabase/identity fixtures.

## F-DATA-001 — Upload multi-file dapat meninggalkan objek yatim

- **Severity:** Low/Medium, risiko konsistensi.
- **Komponen:** Dokumen verification bisnis, RFQ attachments, product image, lookbook, CMS asset.
- **Bukti:** Objek diunggah sebelum pembaruan metadata/record/audit. Gagal pada langkah berikutnya dapat meninggalkan objek Storage tanpa referensi bisnis yang lengkap.
- **Dampak:** Storage membengkak dan file orphan sulit ditelusuri; transaksi database tidak mencakup Storage.
- **Rekomendasi:** Catat upload intent/outbox, lakukan kompensasi idempotent pada objek yang dibuat permintaan tersebut, atau sediakan rekonsiliasi orphan berkala dengan retention yang disetujui.
- **Mitigasi source 27 Oktober 2026:** Product image, lookbook, dan RFQ attachment mencatat hanya path yang berhasil dibuat oleh request aktif. Jika metadata belum tersimpan ketika request gagal, kompensasi best-effort memanggil Storage `remove` hanya untuk daftar path tersebut. Kegagalan audit log setelah metadata RFQ/CMS asset berhasil tidak lagi memalsukan kegagalan upload yang sudah committed. Unit test membuktikan daftar kosong tidak dihapus, hanya path milik request diteruskan, dan kegagalan cleanup tidak melempar exception.
- **Regression:** `test/storage-compensation.test.ts` dan `test/qa/upload-lifecycle.test.mjs`; source suite terbaru: 78 PASS, 0 FAIL, 1 SKIP.
- **Batasan dan desain lanjutan:** Upload dokumen verification dan CMS asset masih dua tahap client-to-metadata; cleanup server tidak boleh menebak apakah path telah diklaim request berikutnya. Tambahkan upload-intent record (`run/request ID`, owner, bucket, path, expiry, claimed-at), claim secara atomik saat metadata ditulis, dan reconciliation hanya untuk intent kedaluwarsa yang belum claimed setelah retention yang disetujui. Audit setiap delete dan jangan gunakan wildcard/sweep pada Storage production.
- **Status:** PARTIALLY REMEDIATED IN SOURCE; runtime Storage evidence tetap BLOCKED.

## F-SEC-006 — Worker mutatif sebelumnya menerima GET

- **Severity:** Medium.
- **Komponen:** Endpoint internal expiry reservation, operasi, dan email outbox serta scheduler GitHub Actions.
- **Bukti:** Ketiga route mengekspor handler POST sebagai GET, sementara workflow scheduler memanggil URL tanpa method eksplisit (GET). Request GET berotorisasi dapat mengeksekusi perubahan reservation/outbox.
- **Perbaikan:** Route sekarang POST-only, response JSON internal memakai `private, no-store`, dan seluruh workflow scheduler resmi memakai `--request POST`. Dokumentasi scheduler staging diselaraskan. Regression test statis memeriksa method route dan jumlah POST pada tiap workflow.
- **Runtime evidence:** CI run `40533995887` passed for commit `e51fefb`. The matching Vercel deployment record reports success. Cookie-free GET requests to all three current canonical worker URLs returned 405 and bodies were discarded. The direct deployment URL is SSO-gated, so canonical exact-SHA mapping is not proven.
- **Status:** PARTIALLY REMEDIATED. Current canonical GET denial is verified; no worker production POST was invoked because that would process reservations or outbox/email data. Authorized scheduler runtime remains BLOCKED pending a safe non-mutating verification path.

## Kontrol statis yang terlihat (belum runtime-verified)

- Header global: CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy dan Permissions-Policy. CSP masih mengizinkan `unsafe-inline`; ini melemahkan pertahanan jika XSS ada, tetapi audit ini tidak menemukan bukti stored XSS yang dapat dieksekusi.
- Role dibaca dari database melalui server session; Super Admin/MFA gate ada di server layout/API. RLS mengisolasi org/file/order berdasarkan source migration.
- Webhook Midtrans memakai SHA-512 signature dan constant-time comparison; alur RPC/idempotency tetap perlu test replay pada DB sandbox.
- Production read-only GET menampilkan CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy, dan HSTS dua tahun; `X-Powered-By` tidak hadir. Ini observasi header, bukan hasil pemindaian lengkap.
- Sebelum perubahan, empat API privat di production memberi status 401/403 dan hanya body `{error: ...}` tanpa cookie. Empat GET pada route POST-only menerima 405.
- `npm audit --omit=dev --audit-level=high` melaporkan 0 advisories dari cache, tetapi `npm view` gagal `ENOTCACHED`; audit registry terkini **BLOCKED**, bukan clean.
- `.gitignore` mengecualikan `.env*`; pemeriksaan nama file Git tidak menemukan file environment tracked. Bounded pattern scan pada `apps/web/src` dan `supabase/migrations` tidak menemukan string berbentuk secret. Ini bukan secret scan penuh: isi `.env*` dan seluruh riwayat Git tidak dibaca.

## Cakupan yang belum diverifikasi

IDOR/BOLA lintas user/organisasi, session invalid/nonaktif, CSRF lintas browser, SQL abuse, XSS/runtime CMS, webhook replay, secret scan penuh, authenticated response cache after deployment, serta provider permissions memerlukan environment uji. Statusnya **BLOCKED**, bukan PASS.

## Kontrol fase lingkungan terisolasi

- Guard `apps/web/scripts/qa/local-test-target.mjs` hanya menerima marker `local`, project ID repo `winajaya`, URL browser/server loopback pada port local Supabase, database `postgres` pada port 54322, dan identity server aktual yang cocok dengan query `psql` read-only.
- Production project ref `qcgcpheeskkdcnxspbgx`, URL/host remote, nilai environment tambahan, dan identity DB yang tidak cocok ditolak. Runner integration membaca `.env.test.local` saja dan meneruskan allowlist target saja; tidak membaca `.env.local`.
- Delapan pengujian unit guard lulus pada konfigurasi/identity sintetis. Ini bukan bukti koneksi DB atau RLS runtime.
- Tidak ada ZAP, secret scan penuh, atau registry audit terkini dijalankan. Ketiadaan temuan scanner tidak disimpulkan sebagai aplikasi aman.

## Observasi production terbatas

Hanya GET halaman publik/protected pages dan API yang dilakukan memakai Node fetch tanpa cookies. Tidak ada request body, autentikasi, Storage, SQL, pembayaran, email, scan, atau mutation. Browser UI yang ternyata memiliki sesi aktif segera ditutup saat route privat tampil; tidak ada screenshot/trace atau nilai data disalin ke laporan.

Follow-up production-authorized: runner target baru memakai ref `qcgcpheeskkdcnxspbgx`, HTTPS hostname exact, marker dan approval eksplisit; unit guard 5/5 lulus. Hostname tidak resolve dari environment ini (domain pembanding juga tidak resolve), sehingga live preflight berhenti sebelum HTTP. Tidak ada key, credential, cookie, atau response body yang dibaca; ZAP/scanner tidak dijalankan.

## Rerun baseline — 24 Oktober 2026

- npm audit terkini dijalankan dengan `npm audit --audit-level=high`, tetapi registry `registry.npmjs.org` gagal DNS (`ENOTFOUND`); status audit fresh **BLOCKED**, bukan 0 vulnerability.
- Production target preflight berhenti sebelum HTTP karena DNS. Vercel target dan `example.com` juga gagal resolve. Tidak ada target layanan yang dinyatakan down berdasarkan kegagalan resolver.
- Local HTTP/E2E tetap menggunakan standalone runner; hasil terbaru 6/6 GET checks dan 3/3 anonymous browser checks PASS. Tidak ada RLS, Auth role, IDOR, Storage, payment, atau cross-tenant runtime test.
- Typecheck command gagal karena syntax rusak pada generated `.next/dev/types`; source finding belum dibuktikan. Tidak ada perubahan business logic pada rerun ini.
- Static source check terbaru: `checkRateLimit` memakai `Map` per proses dan identity dari `cf-connecting-ip`, lalu `x-forwarded-for`, lalu `unknown`; callsite ditemukan pada login, registrasi, contact, RFQ, checkout, Midtrans, payment QR, kategori Admin, role Super Admin, dan organisasi. Topology ingress tidak dapat dipastikan tanpa deployment observability; F-SEC-002 tetap OPEN.
- `privateJson()` ditemukan pada profile, order detail, Admin search, dan Super Admin home CMS. Local HTTP regresi memberi header privat pada empat API tanpa cookie; production retest setelah deploy masih BLOCKED.
- Bounded credential-pattern scan pada `apps/web/src`, QA scripts/tests, migrations, CI workflow, dan tracked diff tidak menampilkan/provider secret match pada diff. Lima pola DB URL hanya mengenai placeholder/template atau synthetic guard-test fixtures; nilai tidak ditampilkan. `gitleaks`, `trufflehog`, dan ZAP tidak terpasang, jadi ini bukan full secret/history scan.

### Catatan integritas environment QA

Dalam satu percobaan awal E2E, server dijalankan lewat `next start` langsung dari project root. File `.env.local` diketahui ada berdasarkan pemeriksaan keberadaan sebelumnya dan Next berpotensi memuat environment file otomatis. Nilainya tidak pernah dibaca atau ditampilkan manual, tidak ada secret pada output, dan hanya route anonim yang dikunjungi. Namun pemuatan environment dan kemungkinan backend read tidak dapat disangkal; percobaan tersebut dibatalkan sebagai bukti. Server dihentikan, tidak ada operasi write yang dijalankan, serta tidak ada trace/screenshot/video. Pengulangan valid memakai `scripts/qa/start-local-standalone.mjs`, yang menolak env files di standalone dan hanya meneruskan Supabase loopback placeholder. Catatan ini adalah penyimpangan proses QA, bukan vulnerability aplikasi yang terkonfirmasi.

## F-SEC-003 — Cache privat belum terverifikasi pada deployment

- **Severity:** Medium
- **Status:** OPEN / runtime deployment mismatch
- **Komponen:** `src/lib/api-response.ts`; API profile, Admin search, dan Super Admin CMS production
- **Bukti:** Pada 26 Oktober 2026, GET anonim tanpa cookie ke `/api/account/profile` (401), `/api/admin/search` (403), dan `/api/super-admin/content/home` (403) masing-masing mengembalikan `Cache-Control: public, max-age=0, must-revalidate`. Source working tree untuk tiga route memakai `privateJson()`, yang mengatur `Cache-Control: private, no-store`.
- **Dampak:** Respons penolakan yang diamati tidak memuat data privat karena body tidak dibaca. Namun cache publik pada endpoint yang dapat memberi data terautentikasi membuka risiko cache shared memperlakukan respons user sebagai cacheable bila perilaku yang sama berlaku untuk respons sukses.
- **Reproduksi aman:** Request GET tanpa credential, redirect dimatikan, body dibuang, dan hanya header nonrahasia dicatat.
- **Perbaikan:** Deploy perubahan `privateJson()` dan route terkait, lalu retest 401/403 serta respons sukses menggunakan akun QA terisolasi untuk memastikan `private, no-store` bertahan melewati platform CDN.
- **Regression evidence:** Unit `privateJson forces private no-store over caller cache directives` PASS; local HTTP regression sebelumnya PASS; deployment production belum memenuhi assertion header.

## Dependency vulnerability remediation — 26 Oktober 2026

- **Status:** RESOLVED in working tree; deployment verification pending
- **Initial evidence:** `npm audit --audit-level=high --package-lock-only` reported one Critical advisory group for Next 16.3.6 and High advisory groups for Nodemailer 7.0.13 and Zod 4.6.5.
- **Fix:** exact dependency updates to Next 16.4.3, Nodemailer 10.2.1, and Zod 4.6.6, with package lock regenerated by npm without force resolution.
- **Verification:** `npm ls next zod nodemailer --depth=0` confirmed the versions; a fresh audit reported `found 0 vulnerabilities`; unit suite 37 PASS/0 FAIL/1 SKIP, lint, and QA syntax check passed.
- **Residual risk:** Production deployment is still on an unverified artifact. The package changes do not close F-SEC-003 or prove production has received the patched dependencies.

## Verification update — 26 Oktober 2026 (latest)

- The cache-policy regression suite now includes `test/qa/private-api-cache-policy.test.mjs`. It verifies, by source inspection, that the shared helper overwrites a caller cache directive and that profile, order detail, Admin search, and Super Admin CMS routes import and return through `privateJson()`. `npm test` completed with **42 PASS, 0 FAIL, 1 SKIP**. This is source/unit evidence; it does not close the production deployment finding.
- A new registry audit attempt was **BLOCKED** by DNS resolution for `registry.npmjs.org` (`ENOTFOUND`). The earlier zero-vulnerability result remains historical execution evidence, but there is no newer registry-confirmed clean audit from this checkpoint.
- F-SEC-003 remains **OPEN** until the patched artifact is deployed and the specified production responses are retested. No production request, configuration, account, Storage object, payment, or data mutation was made during this update.

### Dependency audit retest — 27 Oktober 2026

`npm audit --audit-level=high --package-lock-only` completed against the registry and returned `found 0 vulnerabilities`. This confirms the current lockfile at the high/critical gate. It does not validate the deployed production artifact or close any application-level finding.

## CI and deployment verification — 27 Oktober 2026

Static review of `.github/workflows/ci.yml` confirms it uses placeholder loopback Supabase values for the build and contains no production credential injection, migration, reset, or deployment command. GitHub Actions is reachable and historical Web CI runs are visible, but the workflow is push/PR-triggered and the current changes are uncommitted on `main`; no CI run for this working tree was created. F-SEC-003 remains **OPEN** because no approved deployment or post-deployment cache-header retest occurred.

## F-SEC-005 — Credential material in an environment template

- **Severity:** Critical
- **Component:** `apps/web/.env.example` before the 27 Oktober 2026 remediation.
- **Evidence:** The untracked environment template contained non-placeholder credential material for several external/service integrations. Values are intentionally not repeated in this report, terminal output, artifacts, or commit.
- **Impact:** Anyone who accessed the template could potentially use exposed credentials, depending on their provider scope and current validity.
- **Remediation:** The template is replaced with named placeholders only. No secret value is committed.
- **Required operator action:** Revoke and rotate every credential that appeared in the prior template, update the approved secret store, audit provider logs for use, and invalidate any sessions or keys within scope. This cannot be automated safely from this repository.
- **Status:** Source remediation ready for commit; credential rotation and provider-side verification **OPEN**.

### F-SEC-003 post-deployment read-only checklist

After an approved deployment, make only cookie-free GET requests to `/api/account/profile`, `/api/admin/search?q=qa-cache-check`, `/api/super-admin/content/home`, and `/api/orders/<synthetic-invalid-uuid>`. Record only status and non-secret response headers. Assert `private, no-store` for private 401/403 responses and no-store on protected redirects. Do not read a successful private body, use a customer identifier, or close the finding until a separately authorized QA-authenticated retest also preserves the cache policy.

### Deployment retest — 27 Oktober 2026

- **Anonymous denial/redirect paths:** PASS. The deployed storefront returned `private, no-store` for profile (401), Admin search (403), Super Admin CMS (403), and a synthetic-invalid order identifier (401). Admin and Super Admin page redirects also retained no-store. Response bodies were cancelled without being read.
- **Status:** PARTIALLY REMEDIATED / **OPEN**. This confirms the deployed header fix for anonymous private paths, but not a successful authenticated private response. Close only after an owned synthetic QA identity proves the same policy on an allowed response.
- No production record, user, Storage object, payment, email, or configuration was changed during retest.

### Private-route source hardening — 27 Oktober 2026

- **Scope:** Source audit found 22 additional private JSON routes without an explicit cache policy, spanning RFQ, quotation, organization, verification, fulfillment, privileged product, payment-reconciliation, privacy, and role-management flows.
- **Fix:** Those JSON-only routes now use `privateJsonResponse`, which delegates every response to `privateJson()` and forces `Cache-Control: private, no-store`. The original four routes remain covered directly.
- **Regression evidence:** Static coverage now asserts helper use for all 27 private JSON routes, including CMS asset upload, and the helper unit test verifies the compatibility shape. Runtime evidence remains separate.
- **Deployment/denial evidence:** Commit `c1a8f77` has a successful Vercel Production deployment record and successful GitHub Actions run. Its direct deployment URL is Vercel SSO-gated, so the canonical runtime cannot be cryptographically or header-level mapped to that exact SHA from this access path. A cookie-free GET to the current canonical production quotation endpoint returned 401 with `Cache-Control: private, no-store`; the body was discarded. This is denial evidence for the current public target, not exact-SHA runtime proof.
- **Status:** PARTIALLY REMEDIATED / **OPEN**. Authenticated success and cross-user cache tests remain **BLOCKED** without owned synthetic identities.

### F-SEC-005 inventory update — 27 Oktober 2026

- Current workspace scan, excluding private local environment files and test artifacts, found no high-confidence credential value outside a purpose-built negative test fixture. History pattern scanning identified only QA guard code that recognizes publishable-key formats; it did not output a credential value.
- This does not prove the prior untracked template was never copied, nor does it provide provider audit logs. GitHub Actions secret stores, Supabase/Auth, payment, shipping, SMTP, and deployment secret stores could not be inventoried or rotated from the available repository-only access path.
- **Rotation/audit status:** **BLOCKED** pending official provider/secret-store access and audit-log scope. Sanitizing source does not close credential exposure.
- **Provider metadata recheck:** Official GitHub metadata access inventories two repository-level staging credential entries and one production-environment scheduler credential entry; values were never retrieved. Production worker and email-outbox workflows consume the environment scheduler credential; the staging worker consumes the two staging entries. Rotation cannot be safely performed from repository access alone because the matching Vercel/runtime consumers and rollback path are not available for verification.
- **Supabase boundary:** Official Supabase project-list metadata confirms account visibility of the known production project reference. The CLI secret-list command was not run because its documented behavior is to list all project secrets without an explicit redaction guarantee; no secret value was read. This confirms neither secret rotation nor provider audit and does not reduce F-SEC-005 severity.
