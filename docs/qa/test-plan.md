# Rencana dan Hasil Tes

Tanggal audit: 24 Oktober 2026. Gunakan label PASS hanya untuk tes yang benar-benar dijalankan.

## Tool inventory

| Tool | Versi/status | Hasil verifikasi |
|---|---|---|
| Node.js / npm | 22.23.3 / 11.6.1 | Tersedia; project meminta Node >=22. |
| Next.js / React | 16.3.6 / 19.2.8 | Terpasang di `apps/web/node_modules`. |
| TypeScript / ESLint | 5.9.3 / 9.39.5 | Terpasang. |
| npm lockfile | `apps/web/package-lock.json` | Package manager yang benar adalah npm. |
| Node `node:test` | Bawaan Node | Tes unit dijalankan tanpa dependency baru. |
| `psql` | 18.4 | Tersedia; guard memakai query identity read-only jika target local lolos. |
| Docker | Tidak tersedia | Supabase lokal tidak dapat dijalankan. |
| Local PostgreSQL | `pg_isready` accepts 5432; psql 18.4 | `psql -w` meminta password; identity/disposability tidak diketahui, sehingga tidak dipakai. Ports 54321/54322 no response. |
| Local Supabase guard | Existing fail-closed scripts | Synthetic unit cases pass; live DB runner stops because project link metadata is production. |
| Production/staging target guards | Dedicated `production-test-target.mjs` | Exact production ref/hostname + explicit marker/approval and separate staging allowlist; mutation mode requires run namespace and confirmed owner. Live preflight DNS blocked before HTTP. |
| Playwright Test | 1.58.2 | Dipasang dari tarball cache npm lokal; `npx playwright --version` PASS. Tiga browser smoke PASS dengan Chromium 1.61.1 yang sudah ada pada cache; CI akan memasang browser pasangan. |
| Vitest, Testing Library/user-event | Tidak terpasang | npm registry offline; unit suite tetap menggunakan Node `node:test`. |
| Supabase CLI | 2.118.0 | Version verified with `SUPABASE_TELEMETRY_DISABLED=1`; no `start`/`status`/mutation command executed. |
| Docker/local Supabase | Docker tidak ditemukan | Database integration fixture tidak tersedia. |
| ZAP, Lighthouse/LHCI, k6 | Tidak terpasang | Tidak dipasang karena akses registry/proxy terblokir; tidak ada scan eksternal/load test. |
| REA MCP | Tools tersedia | Source repository dianalisis langsung; tidak ada artifact target yang memerlukan REA. Tidak ada hasil REA yang diklaim sebagai runtime evidence. |

## Perintah dan hasil

| Perintah / pemeriksaan | Hasil |
|---|---|
| `node_modules/.bin/tsc.cmd -p tsconfig.test.json` | PASS |
| `node --experimental-test-isolation=none --test .test-build/test/*.test.js .test-build/test/integration/*.test.js test/qa/*.test.mjs` | PASS: 36; FAIL: 0; SKIP: 1. Termasuk cache-header, page-authorization, production-target, dan staging guard tests; tidak terhubung ke DB. |
| `npm test` | PASS: 37 tests passed, 0 failed, 1 skipped. |
| `npm run lint` | PASS; 0 error, 6 warning `@next/next/no-img-element` pada cart/checkout/payment. |
| `npm run typecheck` | PASS |
| `npm run qa:check` | PASS; syntax-check guard, local standalone runner, HTTP smoke, Playwright config, dan specs. |
| Production target unit tests | PASS: 5 guard tests for exact target, dedicated config, public-key restrictions, approval/mutation gates, and staging separation; no production access. |
| `npm run qa:production:preflight` (2026-10-24 20:48:53 +07:00) | BLOCKED before HTTP: Supabase hostname DNS `ENOTFOUND`; no GET sent. |
| `npm run qa:production:mutations` without synthetic mutation approval (2026-10-24 20:49:06 +07:00) | BLOCKED by required `QA_ALLOW_SYNTHETIC_MUTATIONS=true`; no network request or write sent. |
| `npm run qa:local-http` | PASS: 6 unauthenticated GET checks on standalone local app; 4 APIs return private no-store, 2 dashboards redirect to login. |
| `npm run test:e2e:local` | PASS: 3 anonymous browser checks on local standalone build: homepage/catalog render and admin/super-admin direct navigation redirect to login. No database/Auth roles. |
| `npm run qa:db:guard` | BLOCKED; CLI link metadata mengarah ke project production. Tidak membaca `.env.test.local` atau menghubungi DB. |
| `npm run test:integration` | BLOCKED pada project-link guard sebelum test env/DB/test runner. |
| `npm audit --omit=dev --audit-level=high` | 0 advisories dilaporkan dari cache lokal; `npm view` fresh registry gagal `ENOTCACHED`. Status audit terkini **BLOCKED**, bukan PASS. |
| `npm run build -- --webpack` | PASS optimized build, 48 static pages; Supabase loopback dan external credential placeholders. ISR data fetch CMS tidak tersedia tanpa local secret, tetapi build selesai. Generated standalone `.env` copy was removed after checking its path/metadata. |
| Production HTTP GET (no cookie) | PASS limited: 5 page statuses, 5 API statuses; 4 negative bodies have `error` only; 4 unsupported methods return 405. No DB/provider operations. |
| RBAC API/UI authenticated roles, database RLS, checkout, RFQ, payment sandbox | BLOCKED — no isolated DB/accounts. |
| Authenticated Playwright workflows, ZAP baseline, Lighthouse, k6 | BLOCKED/NOT IMPLEMENTED — DB fixture unavailable; scanners/metrics tools unavailable and registry offline. Anonymous Playwright subset is PASS as listed above. |

## Cakupan tes unit yang ada

- Auth callback URL, URL scheme, redirect internal.
- Password recovery policy dan rate-limit response/HMAC.
- Reset-route headers dan Sentry sanitization.
- RFQ Zod schema mewajibkan organization ID.
- Signature file PDF/JPEG/PNG/WebP/AVIF dan penolakan MIME yang dipalsukan.
- Validasi schema registrasi/login, penghapusan field `role` yang tidak dikenal dari output schema, batas harga/stok/dimensi produk, dan kasus negatif RFQ.
- Test-target guard lokal: marker/project id, host remote/production ref, port dan database identity, variable tambahan, serta server identity sintetis.

## Prioritas berikutnya setelah test environment siap

1. Buat local Supabase/DB disposable dan fixtures User A, User B, Admin, Super Admin dengan tenant terpisah; pastikan seed hanya data sintetis.
2. Tambahkan API handler tests untuk 401/403/404, method, role tampering, RLS/IDOR, file privacy, role revoke, dan MFA.
3. Perluas Playwright dengan login fixture yang hanya berjalan pada local/staging khusus, tanpa fallback ke production.
4. Tambahkan cross-role workflow RFQ → quotation → bulk order dan retail checkout → payment webhook sandbox → fulfillment.
5. Tambahkan concurrency/idempotency tests menggunakan DB transaksi/worker lokal.
6. Setelah UI server aman berjalan lokal, jalankan Lighthouse desktop/mobile; jangan menganggap angka satu kali sebagai RUM.
7. Jalankan ZAP baseline hanya pada deployment test yang diotorisasi; jangan mengaktifkan active/destructive scan.

## Baseline ulang — 24 Oktober 2026, 21:26 WIB

| Command/check | Environment dan actual result | Status |
|---|---|---|
| `npm test` | `apps/web`, Node 22.23.3; 38 total, 37 PASS, 0 FAIL, 1 SKIP; exit 0 | PASS |
| `npm run qa:check` | QA scripts/spec syntax; exit 0 | PASS |
| `npm run lint` | ESLint 9.39.5; exit 0, 0 errors, 6 existing `<img>` warnings | PASS |
| `npm run typecheck` | Exit 1: parser errors in ignored/generated `.next/dev/types/routes.d.ts` (stray `/`, `nterface`) and `.next/dev/types/validator.ts` (extra declaration close); source files tidak diedit | FAIL command; source typecheck NOT VERIFIED |
| Temporary source-only TypeScript check | TSC with temporary config extending `tsconfig.json`, including `src/**/*.ts`, `src/**/*.tsx`, `next.config.ts`, excluding generated Next types (`.next` and `next-env.d.ts`); exit 0; temporary config removed | PASS source subset; Next route types NOT VERIFIED |
| `npm audit --audit-level=high` | Registry request failed `ENOTFOUND registry.npmjs.org`; no fresh advisory result | BLOCKED |
| `npm run qa:production:preflight` | Exact authorized production ref/HTTPS URL; DNS failed before HTTP, no request sent | BLOCKED |
| `npm run qa:db:guard`, `npm run test:integration` | Both stopped on linked production project metadata before DB connection/migration | BLOCKED |
| `npm run qa:local-http` | Isolated standalone loopback app, anonymous GET only; six assertions passed | PASS 6/6 |
| `npm run test:e2e:local` | Isolated standalone app; public home/catalog and anonymous `/admin`, `/super-admin`; browser from Playwright cache; artifacts disabled | PASS 3/3 |
| Production storefront GET inspection | DNS for Supabase, Vercel, and `example.com` failed; browser tool could not open public URLs; no HTTP request was sent | BLOCKED |
| Production build | In-repository build intentionally not run because Next may load existing `.env.local`; isolated copy attempt failed before compilation due dependency junction/symlink resolution | BLOCKED; prior build result is historical only |

Safety deviation: an initial browser retry used `next start` directly and may have allowed Next to auto-load `.env.local`. No values were read/printed and only anonymous page GETs were navigated; whether a backend read occurred cannot be confirmed. That run is excluded. The server was stopped and the full E2E was repeated through the env-safe standalone runner, which passed 3/3. Detail: `production-qa.md`.
