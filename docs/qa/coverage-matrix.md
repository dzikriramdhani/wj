# Matriks Traceability QA

Tanggal status: 24 Oktober 2026 (follow-up full-scale). PASS hanya berarti tes tercatat benar-benar dijalankan. Kode sumber atau mock tidak dihitung sebagai runtime PASS.

| Kebutuhan bisnis/keamanan | Implementasi yang ditemukan | Tes yang ada | Hasil eksekusi / bukti | Status runtime |
|---|---|---|---|---|
| Guard database tes tidak boleh mengarah ke Supabase produksi/remote | `apps/web/scripts/qa/local-test-target.mjs`, CLI `assert-local-test-target.mjs` | 8 kasus guard termasuk marker, project/link ref, remote host, port/DB mismatch, identity, environment variable tambahan | 8 PASS: `apps/web/test/qa/local-test-target.test.mjs`; hanya identitas sintetis | PASS unit; koneksi DB BLOCKED |
| Registrasi/login divalidasi server-side | `src/lib/validators.ts`, route `/api/auth/*` | Schema accepts/rejects synthetic data; `role: super_admin` dari payload tidak lolos sebagai output schema | PASS unit; tidak memanggil route/Auth | BLOCKED runtime |
| Redirect Auth hanya internal/allowlist | `src/lib/app-url.ts` | Tes URL callback | PASS pada suite Node sebelumnya dan suite final | PASS unit; Auth runtime BLOCKED |
| Reset password dan rate limit lokal | `src/lib/reset-password.ts`, `reset-security.ts`, `password-reset-rate-limit-core.ts` | Password policy, response policy, HMAC identifiers | PASS pada suite Node sebelumnya dan suite final | PASS unit; Supabase RPC BLOCKED |
| Product schema, stok, harga server authority | `src/lib/validators.ts`, katalog/checkout API, SQL commerce migrations | Schema menolak harga/stok negatif dan dimensi invalid; tidak menguji otoritas harga checkout | PASS unit; checkout belum dijalankan | BLOCKED runtime |
| RFQ organisasi, quantity, attachments, idempotency | Validator, `/api/rfq/*`, migrations 003/038 | Schema positive + organization/quantity/deadline/contact negatif; signature tests | PASS unit; tidak membuktikan DB authorization/idempotency | BLOCKED runtime |
| Quotation/revision/expiry/acceptance dan atomic B2B order | RPC/migrations 003/013/040 | Tidak ada DB integration tests | Belum dijalankan | BLOCKED |
| Retail cart/checkout, inventory race, webhook replay | API/RPC commerce migrations 005/007/008/009/039/040 | Tidak ada checkout/concurrency integration tests | Belum dijalankan | BLOCKED |
| Anonymous direct page/API authorization | `/admin`, `/super-admin`, private profile/order, admin search, Super Admin CMS | Live GET tanpa cookie; local built-app harness; Playwright public-page suite | Production: dashboard 307 ke login, API privat 401/403; body hanya field `error`. Local: enam HTTP checks dan tiga browser tests PASS | PASS terbatas untuk anonymous; role account masih BLOCKED |
| Production Supabase preflight | Confirmed project ref/HTTPS hostname, Auth health, REST, Storage | Dedicated production target guard + read-only runner | 2026-10-24 20:48:53 +07:00; ref/URL unit guard PASS; DNS `ENOTFOUND`, runner stopped before HTTP; no API key/cookie | BLOCKED live config/schema inspection |
| Authenticated role matrix dan IDOR | Server role helpers, route handlers, RLS migrations | Belum ada identity/tenant harness | User A/B, Admin, Super Admin, session revoked, dan cross-tenant belum dijalankan | BLOCKED |
| Private API cache policy | `src/lib/api-response.ts`, profile/order/admin search/CMS routes | Helper unit + local standalone GET smoke | Pada checkpoint perbaikan cache, 36 unit tests PASS termasuk `privateJson`; suite final setelah production-guard tests berjumlah 37 PASS; 4 API respons lokal mengirim `private, no-store`; live pre-fix menunjukkan default `public` pada respons penolakan | PASS lokal; production retest menunggu deploy |
| Privileged Admin dashboard read ordering | Admin and Super Admin server pages use service-role clients | Static source-order regression + anonymous local Playwright | Page role/MFA guard now precedes each service client; two dashboard redirects PASS | PASS source/local anonymous; authenticated DB runtime BLOCKED |
| RLS semua tabel/bucket dan RPC grants | 53 tabel public RLS declarations; policies di migration sources | Tidak ada test terhadap local DB | Tidak dijalankan; tabel-per-tabel di `rls-coverage.md` | BLOCKED |
| Upload file tidak percaya MIME client | `src/lib/upload-validation.ts` dan 5 route upload | Signature PDF/JPEG/PNG/WebP/AVIF, spoof/truncated case | PASS unit; Storage belum diuji | BLOCKED runtime |
| CMS authorization/draft/publish/XSS/cache | Super Admin routes dan migrations 035/036 | Tidak ada test API/UI/DB | Belum dijalankan | BLOCKED |
| Payment signature/idempotency/state transitions | Midtrans handlers/RPC | Tidak ada sandbox atau webhook integration test | Belum dijalankan; tanpa request pembayaran | BLOCKED |
| E2E alur B2B/retail lintas role | App Router UI/API | Playwright 1.58.2; tiga anonymous smoke tests | Homepage+katalog dan redirect direct `/admin`, `/super-admin` lulus pada standalone local build. Tidak ada login/akun/DB/transaksi | PASS subset; role/B2B/retail NOT IMPLEMENTED / BLOCKED |
| Build production | Next.js 16.3.6 | `npm run build -- --webpack` dengan Supabase loopback dan kredensial eksternal kosong | Build optimized berhasil; 48 halaman statis dibuat. CMS ISR gagal mengambil data tanpa secret lokal, tetapi build tetap selesai | PASS build; data SSR/ISR runtime BLOCKED |
| Security scanner/ZAP dan dependency freshness | npm audit/lint/typecheck | `npm audit` cache dan `npm view` | Audit offline melaporkan 0 advisories dari metadata lokal; registry freshness gagal `ENOTCACHED`; ZAP tidak tersedia | BLOCKED untuk audit terkini/ZAP |
| Performance/accessibility | Next App Router | Playwright 1.58.2 hanya untuk anonymous smoke; Lighthouse tidak terpasang | Header/network smoke saja; tidak ada LCP/INP/CLS, responsive, keyboard, atau accessibility measurement | NOT IMPLEMENTED |

## Inventaris tes pada fase ini

- Suite Node final: `npm test` PASS, 37 PASS, 0 FAIL, 1 SKIP.
- `npm run qa:local-http` memberi 6 PASS dan `npm run test:e2e:local` memberi 3 PASS pada standalone build lokal tanpa autentikasi database; bukan bukti database/RLS/role runtime. Production read-only HTTP: 10 route statuses, 4 error-only response-shape assertions, dan 4 unsupported-method checks PASS.
- `npm run qa:check`, `npm run typecheck`, `npm run lint` PASS; lint memiliki 6 warning `<img>`. `npm run build -- --webpack` PASS dengan target service loopback dan credential placeholders.
- `production-test-target.test.mjs`: 5 guard tests PASS untuk exact project/hostname, dedicated QA config, marker/approval, anon-only key validation, mutation owner+namespace gates, dan staging isolation. Production preflight runtime BLOCKED sebelum HTTP karena DNS tidak resolve; lihat `production-qa.md`.
- `npm run qa:db:guard` BLOCKED dengan alasan linked-project metadata menunjuk project production; tidak membaca `.env.test.local`, tidak konek DB, dan tidak memulai migration/test.
- Build/HTTP observasi, unit tests, local runtime, dan live production read-only dicatat terpisah. Tidak ada DB integration, RLS, checkout/payment, concurrency, authenticated Playwright, ZAP, atau Lighthouse PASS.

Rincian jalur dan role tetap pada `feature-inventory.md`, `role-permission-matrix.md`, `business-workflows.md`, `rls-coverage.md`, `e2e-results.md`, dan `concurrency-results.md`.

## Follow-up run aktual — 24 Oktober 2026

| Requirement | Latest evidence | Latest status |
|---|---|---|
| Current unit/regression baseline | `npm test`: 37 PASS, 0 FAIL, 1 SKIP (38 total), exit 0 | PASS |
| Current lint and QA guard | `npm run qa:check` exit 0; `npm run lint` exit 0, 6 warnings | PASS |
| Current source TypeScript gate | `npm run typecheck` fails parsing ignored `.next/dev/types/*`; temporary TSC source-only config excluding generated Next types passes | FAIL root gate; PASS source subset; Next route types NOT VERIFIED |
| Local unauthorized API/cache checks | Isolated standalone GET test, 6 assertions | PASS 6/6 |
| Anonymous local browser routes | Isolated standalone Playwright, 3 assertions | PASS 3/3 |
| Live storefront and Supabase preflight | DNS for both target hostnames and `example.com` failed; production runner sent no HTTP; browser tool could not open routes | BLOCKED |
| Live Auth/RLS/Storage and role matrix | No DB/Auth QA identity; linked project guard refuses production; no live preflight connection | BLOCKED |
| Current dependency audit | npm registry DNS `ENOTFOUND` | BLOCKED |
| Current clean production build | Not run in repo due `.env.local` auto-load risk; isolated-copy build harness failed before compilation due dependency links | BLOCKED |

The local checks above do not prove authenticated role, database, payment, or business workflow behavior. An initial `next start` browser attempt may have auto-loaded `.env.local`; it is excluded from evidence and documented in `production-qa.md`. The isolated standalone E2E rerun passed without env files or production credentials.

## Follow-up evidence — 26 Oktober 2026

| Requirement | Latest evidence | Latest status |
|---|---|---|
| Generated Next route-type check | Isolated no-`.env*` copy: `npm run typecheck` (`prepare-next-typecheck → next typegen → tsc --noEmit`) exit 0 | PASS in isolation; repository run INCONCLUSIVE due runner timeout |
| Supabase production identity/read-only reachability | Exact project ref and hostname resolved to four public addresses; three unauthenticated GETs returned 401, 401, 400 | PASS, read-only only |
| Website public reachability/security headers | Seven anonymous HEAD requests: public pages/API 200; Admin/Super Admin redirects 307; CSP/HSTS/nosniff/frame/referrer/permissions headers present | PASS, anonymous scope only |
| Production private API denial | GET profile/admin search/super-admin CMS: 401/403/403 without response bodies | PASS for anonymous denial only |
| Private API cache policy on deployed website | Same three private API denials returned `Cache-Control: public, max-age=0, must-revalidate` | FAIL — F-SEC-003 deployment/runtime mismatch |
| Production role/RLS/tenant/payment/RFQ workflows | No QA identities or isolated database fixtures | BLOCKED |

| Current dependency vulnerability gate | `npm audit --audit-level=high --package-lock-only` after Next 16.4.3, Nodemailer 10.2.1, Zod 4.6.6 | PASS — 0 vulnerabilities |
| Current full source type check | `next typegen` generated current `.next/types`; `tsc --noEmit` exit 0 | PASS |

## Checkpoint — 26 Oktober 2026 (latest)

| Requirement | Latest evidence | Status |
|---|---|---|
| Private API cache policy source regression | `test/qa/private-api-cache-policy.test.mjs` plus helper unit test; four private routes use `privateJson()` | PASS for source/unit only |
| Full type check | `npm run typecheck` (`prepare-next-typecheck`, `next typegen`, `tsc --noEmit`) exit 0 | PASS |
| Node regression suite | `npm test`: 42 PASS, 0 FAIL, 1 SKIP | PASS; skipped Supabase recovery test remains isolated-environment blocked |
| Isolated clean production build | `npm run qa:build:isolated:webpack` reached optimized compilation, then failed to create temporary Next output directory with `EPERM` | FAIL / environment-build blocker; no application assertion failed |
| Production F-SEC-003 closure | No deployment or post-deploy retest performed | BLOCKED / OPEN |
| Current dependency vulnerability gate | `npm audit --audit-level=high --package-lock-only` completed against the registry | PASS — 0 vulnerabilities |

The current build failure occurred inside a temporary QA directory that was safely removed by the runner. A direct filesystem probe could create and remove the same nested path, so the failure is not evidence of a general workspace write denial. It must be reproduced in a clean CI/Windows environment before treating it as an application build defect.

## Build and CI checkpoint — 27 Oktober 2026

| Requirement | Latest evidence | Status |
|---|---|---|
| Isolated application production build | `npm run qa:build:isolated:webpack`, new copy, allowlisted loopback environment, exit 0 | PASS local build |
| Prior `EPERM` diagnosis | Minimal route probe: sandbox `spawn EPERM`; equivalent out-of-sandbox probe exit 0 | PASS diagnosis — runner limitation, not source defect |
| CI workflow definition | Workflow has `npm ci`, test, QA syntax, lint, typecheck, audit, placeholder build, Chromium, local HTTP and anonymous Playwright steps | PASS static inspection |
| CI execution for current dirty working tree | Trigger only supports push/PR; no commit/push/PR was authorized | BLOCKED |
| Local database integration/RLS | `npm run qa:db:guard` refused linked production metadata before any env-file read or connection | BLOCKED safely |
| Node unit/regression suite | Restricted runner cannot spawn Node test workers; identical out-of-sandbox invocation: 42 PASS, 0 FAIL, 1 SKIP | PASS outside restricted runner; sandbox limitation documented |
| Lint and typecheck | `npm run lint` exit 0 (6 warnings); `npm run typecheck` exit 0 | PASS |

## CI and database readiness — 27 Oktober 2026

| Requirement | Evidence | Status |
|---|---|---|
| Current change CI run | No `workflow_dispatch`; no `act`/Docker; dirty local `main` must not be pushed without authorization | BLOCKED |
| Historical GitHub Web CI | Previous remote Web CI runs are visible as successful; they do not contain current uncommitted audit changes | PASS historical only |
| Disposable local Supabase | Docker absent; ports 54321/54322 closed; production link rejected by guard | BLOCKED |
| Local PostgreSQL 5432 | Service/port present but identity and disposal not proven; no connection attempted | NOT ELIGIBLE / BLOCKED |
| Runtime RBAC/RLS/commerce tests | Fixture/cleanup matrix documented in `rls-coverage.md`; no target has passed guard | BLOCKED |

## CI execution — 27 Oktober 2026

| Requirement | Execution evidence | Status |
|---|---|---|
| Web CI run for QA commit `1e3d48d` | [Run 40525092311](https://github.com/dzikriramdhani/wj/actions/runs/40525092311): setup, `npm ci`, tests, QA check, lint, typecheck, audit, and placeholder build passed | PARTIAL PASS |
| Chromium/browser gates | Installation failed before smoke tests: Playwright 1.58.2 does not support Ubuntu 26.04 | FAIL — fixed in workflow; rerun pending |

## Final CI and production read-only checkpoint — 27 Oktober 2026

| Requirement | Execution evidence | Status |
|---|---|---|
| Web CI regression run | [Run 40525479676](https://github.com/dzikriramdhani/wj/actions/runs/40525479676) for `7d0a830`: one `web` job completed all configured gates | PASS |
| Production Supabase identity/read-only reachability | Authorized public preflight: DNS public only; health/REST/Storage responses 401/401/400; no key/cookie/body/write | PASS — read-only only |
| Deployed private cache denial path | Anonymous GET profile/Admin/CMS/order: 401/403/403/401 with `private, no-store`; protected dashboards redirect no-store | PASS — denial/redirect path |
| Authenticated private cache success path | No owned QA account/session exists | BLOCKED; F-SEC-003 remains OPEN |
| Production RBAC/RLS/workflow mutation tests | No disposable target or namespaced fixture adapter | BLOCKED |

## Final hardening checkpoint — 27 Oktober 2026

| Requirement | Execution evidence | Status |
|---|---|---|
| Private JSON source cache policy | 27 route static regressions plus helper unit test; authenticated success/cache isolation requires QA identities | PASS — source/unit only |
| Extended private-route deployment retest | SHA `c1a8f77` deployment reports success, but its direct Vercel URL is SSO-gated; cookie-free canonical `GET /api/quotations` denied 401 with `private, no-store`; body discarded | PASS — current canonical anonymous denial; exact-SHA runtime mapping NOT VERIFIED |
| F-SEC-005 active/history pattern inventory | No high-confidence active value match outside intentional guard fixture; no provider-side audit available | PARTIAL / rotation BLOCKED |
| Local DB target verification | `qa:db:guard` rejected production link before env read/connection | BLOCKED safely |
| Internal worker methods | Three mutation-capable worker routes are POST-only; three scheduler workflows use five explicit POST calls; static regressions and Node test suite; canonical cookie-free GET returns 405 for each worker | PASS — source/unit and current canonical method denial; deployed POST worker not invoked; exact-SHA mapping NOT VERIFIED |
| Product/lookbook/RFQ upload compensation | Best-effort cleanup accepts only successful paths recorded by current request; no empty/wildcard cleanup; metadata commit precedes non-fatal audit failure | PASS — unit/source only; Storage runtime BLOCKED |
| CMS asset anonymous denial | Cookie-free, bodyless canonical POST was denied 403 with `private, no-store`; response body discarded | PASS — deployed canonical denial only; authenticated upload BLOCKED |
| Provider credential inventory | GitHub metadata lists staging repository and production environment credential entries; values never read | PARTIAL — rotation/audit BLOCKED |
