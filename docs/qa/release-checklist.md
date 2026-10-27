# Release Quality Gate

## Otomatis pada CI

Workflow `.github/workflows/ci.yml` sekarang menjalankan:

1. `npm ci` memakai `apps/web/package-lock.json`.
2. `npm test` (Node built-in tests).
3. `npm run qa:check` (syntax checks untuk guard, local server, HTTP smoke, dan Playwright specs).
4. `npm run lint`.
5. `npm run typecheck`.
6. `npm audit --audit-level=high`.
7. `npm run build` dengan placeholder Supabase loopback.
8. Install Chromium dan jalankan local HTTP serta `npm run test:e2e:local`.

CI workflow belum dijalankan pada branch audit ini. `npm audit` pada runner memerlukan registry dan harus memblokir high/critical yang belum diselesaikan/diterima. Workflow menjalankan dependency install, Node tests, QA script syntax checks, lint, TypeScript, npm audit, build dengan Supabase loopback placeholders, lalu memasang Chromium dan menjalankan local anonymous HTTP+Playwright smoke terhadap standalone build. Workflow belum mempunyai DB/RLS, authenticated roles, ZAP, atau Lighthouse job. Tidak ada laporan CI runtime.

`npm test` mencakup unit tests untuk fail-closed test-target guard. Pada sandbox Windows, command standar berakhir `spawn EPERM` saat Node test runner meluncurkan worker; suite yang sama lulus melalui single-process mode. `npm run test:integration`/`npm run qa:db:guard` berhenti karena metadata Supabase CLI menunjuk project production; tidak membaca `.env.test.local`, membuka koneksi, atau meluncurkan runner.

## Blocker sebelum release

- [ ] Semua test unit/integration kritis lulus pada CI.
- [ ] Build production lulus pada runner CI (local optimized build sudah PASS dengan target eksternal dinonaktifkan).
- [ ] RLS/authorization diuji untuk User A/B, Admin, dan Super Admin dengan data sintetis terisolasi (saat ini BLOCKED).
- [ ] Checkout, harga/stok, payment webhook/replay, RFQ/quotation dan fulfillment lulus di sandbox lokal/staging.
- [ ] Audit dependency terkini tidak menyisakan critical/high tanpa exception terdokumentasi.
- [ ] Jalankan Playwright E2E untuk role dan workflow; artefak harus menyensor session, email, dan data pelanggan.
- [ ] Jalankan ZAP baseline terhadap test deployment yang disetujui.
- [ ] Jalankan Lighthouse desktop/mobile dan accessibility keyboard checks; bedakan lab dan RUM.
- [ ] Secret tidak masuk browser bundle/log/artefak; tidak ada migration destruktif tak disetujui.

## Status per audit

- Final Node suite setelah production target guard: `npm test` PASS, 37 PASS, 0 FAIL, 1 SKIP.
- `qa:check`, `typecheck`, lint lulus; lint memiliki enam warning `<img>`. `npm run build -- --webpack` berhasil. CI belum dijalankan.
- Local standalone HTTP gate: 6 PASS; Playwright anonymous browser smoke: 3 PASS. Live production GET: 10 page/API status checks, 4 response-shape checks, 4 method-gate checks PASS. Tidak ada credential/cookie pada harness HTTP/E2E.
- Production QA runner sudah fail-closed dengan mode local/staging/production-authorized dan mutation gate. Live Supabase preflight BLOCKED sebelum HTTP karena DNS `ENOTFOUND`; tidak ada request/write ke project pada run ini.
- npm audit offline melaporkan 0 cached advisories, tetapi audit registry fresh BLOCKED (`ENOTCACHED`). Playwright 1.58.2 terpasang dari cache; Vitest/Testing Library/ZAP/Lighthouse/k6 tidak terpasang.
- RLS, authenticated roles, checkout/payment, RFQ/quotation, Storage, concurrency, full workflow browser E2E, ZAP, Lighthouse, dan CI runtime: BLOCKED atau NOT IMPLEMENTED; lihat laporan masing-masing.
- Tidak ada migration, seed, database reset, pembayaran, email, atau Auth/Storage/data mutation ke production. Satu browser UI yang ternyata memiliki sesi aktif ditutup tanpa menyimpan artefak.

## Release hold

Jangan release berdasarkan audit ini. Cache policy privat diperbaiki di working tree tetapi belum ter-deploy; retest production harus dilakukan setelah deployment. Release tetap tertahan sampai RLS/cross-tenant, checkout/payment, RFQ/quotation, concurrency, required CI, serta security/performance checks tervalidasi pada target test terisolasi.

## Baseline terbaru — 24 Oktober 2026, 21:26 WIB

- `npm test`: 37 PASS, 0 FAIL, 1 SKIP; `qa:check`: PASS; lint: PASS dengan 6 warning.
- `npm run typecheck`: FAIL pada generated `.next/dev/types` yang malformed. TSC source-only dengan temporary config dan tanpa generated Next route declarations: PASS; full Next route-type gate tetap belum lulus.
- `npm run qa:local-http`: 6/6 PASS; `npm run test:e2e:local`: 3/3 PASS pada isolated standalone runner.
- DNS untuk website production, project Supabase, dan resolver pembanding gagal; production preflight berhenti sebelum HTTP. Tidak ada live website GET baru pada rerun.
- Dependency audit terkini BLOCKED (`registry.npmjs.org` ENOTFOUND). CI tidak dijalankan. Production build baru tidak dijalankan di repo karena `.env.local` dapat dimuat otomatis; isolated-copy build BLOCKED sebelum kompilasi karena dependency symlink/junction tidak terjaga.
- RLS/authenticated RBAC, checkout/payment, RFQ, concurrency, ZAP, Lighthouse/accessibility, dan post-deploy cache retest tetap BLOCKED/NOT IMPLEMENTED.

**Release verdict tetap HOLD.** Tidak ada production write, migration, payment, email, account, Storage, atau configuration mutation yang dilakukan. Catatan penyimpangan test harness E2E ada di `production-qa.md` dan `security-findings.md`.

## Follow-up — 26 Oktober 2026

- Typecheck generated route declarations berhasil pada workspace isolasi tanpa environment file. Command repository belum memiliki exit code karena batas runner saat typegen, sehingga gate full typecheck belum dapat dicentang PASS untuk workspace utama.
- Production public/read-only preflight kini berhasil untuk Supabase dan website. Header keamanan hadir pada route yang diperiksa dan dashboard anonim redirect aman ke login.
- F-SEC-003 tetap release blocker: production private API denial mengirim cache publik, sementara source working tree mengatur `private, no-store`. Deploy dan retest authenticated diperlukan.
- Build isolated mencapai tahap optimasi tetapi tidak memperoleh exit code sebelum batas runner. CI, audit dependency terkini, RLS, cross-tenant, checkout/payment, RFQ/quotation, concurrency, ZAP, Lighthouse, accessibility, dan E2E beridentitas QA belum memenuhi gate.

**Release verdict: HOLD.**

## Final hardening checkpoint — 27 Oktober 2026

- [x] Source hardening extends private JSON no-store policy to 26 private routes; static/helper regressions: 65 pass, 1 skipped.
- [ ] SHA `c1a8f77` deployment reports success, but the direct deployment URL is Vercel SSO-gated; the current canonical quotation denial path is 401 with `private, no-store`, but exact-SHA runtime mapping is not verified. Authenticated success and cross-user cache tests still require two owned QA identities.
- [ ] Official secret-store/provider access is required to rotate F-SEC-005 categories and review access logs. Repository scans cannot substitute for provider audit.
- [ ] Local/disposable database, QA owner accounts, fixture ledger, cleanup adapter, mail sink, and payment sandbox are required before write-capable RBAC/RLS/commerce tests.
- [x] Source hardening: internal reservation, operations, and email workers are POST-only, non-cacheable, and official schedulers explicitly use POST. Runtime verification is intentionally deferred because calling workers would process production state/outbox.
- [ ] F-DATA-001 has narrow source compensation for product/lookbook upload failures; Storage runtime, other upload flows, retention, and reconciliation remain unverified.
- [ ] F-SEC-002 remains OPEN: rate limiting is process-local and its trusted-ingress boundary cannot be verified from repository/provider metadata alone.

**Release verdict remains HOLD.**

## Latest closure checkpoint — 26 Oktober 2026

- [x] `npm test` completed: 42 PASS, 0 FAIL, 1 SKIP.
- [x] `npm run qa:check` completed.
- [x] `npm run typecheck` completed after Next route-type generation.
- [x] Cache-header source regression added for four private API routes.
- [ ] Isolated clean build: Webpack build failed with `EPERM` while creating temporary `.next/server/app/api/products/[slug]`; investigate on a clean runner and obtain a successful exit code.
- [x] Fresh dependency audit: `npm audit --audit-level=high --package-lock-only` returned 0 vulnerabilities on 27 Oktober 2026.
- [ ] F-SEC-003 production closure: deploy via the approved delivery path, then retest unauthenticated and QA-authenticated private responses for `private, no-store`.
- [ ] All role/RLS, transactional commerce, payment, RFQ, concurrency, authenticated E2E, ZAP, Lighthouse/accessibility, and CI gates remain blocked or unimplemented as listed above.

No production deployment or mutation occurred in this checkpoint. **Release verdict remains HOLD.**

## Build-recovery and CI checkpoint — 27 Oktober 2026

- [x] Isolated Webpack production build: exit 0 using a new secret-free workspace and loopback placeholders.
- [x] Build `EPERM` diagnosis: controlled probe shows restricted-runner process spawning is the cause; application build completes outside that restriction.
- [x] CI workflow static review: expected local-only build and anonymous smoke gates are present; no destructive or production-secret step found.
- [ ] CI current-run evidence: current source is uncommitted and workflow only triggers on push/PR. Do not claim remote CI PASS until an authorized branch/PR runs it.
- [ ] Database QA readiness: Docker/local Supabase unavailable; guard rejects production link before any connection. No RLS/RBAC/transaction fixtures may run yet.
- [ ] F-SEC-003: still open pending approved deployment and header retest.
- [ ] F-SEC-005: rotate and audit all credentials previously present in the environment template; source template remediation alone does not close exposure.
- [x] Local post-recovery gates: `npm test` outside restricted runner (42 pass, 1 skipped), `qa:check`, lint (6 warnings), typecheck, audit, and isolated build completed successfully.
- [ ] Local HTTP/browser smoke for the new artifact and remote CI evidence remain pending; the isolated build output is intentionally cleaned after verification.

## Next-stage readiness — 27 Oktober 2026

- [x] Runtime RBAC/RLS, commerce, payment, Storage, CMS, and MFA fixture/assertion/cleanup plan documented; every case remains blocked until `qa:db:guard` passes.
- [ ] Disposable local or operator-provisioned QA stack, isolated Auth/mail sink, and synthetic fixture ledger required before integration tests.
- [ ] Authorized audit branch/PR required to create a remote Web CI run for this dirty working tree; no push or PR was created.
- [ ] F-SEC-002, F-DATA-001, and F-SEC-003 remain OPEN pending their respective runtime/deployment evidence.

**Release verdict remains HOLD.**

## CI execution — 27 Oktober 2026

Web CI run `40525092311` for commit `1e3d48d` was executed and failed only at Chromium installation. `npm ci`, Node tests, QA syntax checks, lint, typecheck, dependency audit, and the placeholder production build all completed first. Failed log evidence: the `ubuntu-latest` runner resolved to Ubuntu 26.04, which Playwright 1.58.2 does not support for Chromium installation. The workflow now pins `ubuntu-24.04`, the supported image for the locked Playwright version; browser smoke gates remain required and must be rerun by the follow-up CI commit.

## CI regression and production read-only retest — 27 Oktober 2026

- [x] Web CI [40525479676](https://github.com/dzikriramdhani/wj/actions/runs/40525479676) passed on `7d0a830`: install, tests, QA check, lint, typecheck, audit, placeholder build, Chromium, local HTTP, anonymous Playwright, and cleanup.
- [x] Production Supabase public preflight passed with the confirmed target and GET-only behavior.
- [x] Deployed anonymous private denial/redirect cache headers now use no-store.
- [ ] F-SEC-003 remains open until an owned synthetic QA identity verifies a successful private response header without exposing data.
- [ ] RLS/RBAC, organization isolation, RFQ, checkout/payment, concurrency, Storage, MFA, and authenticated E2E remain blocked; do not infer them from CI or anonymous read-only results.
- [ ] F-SEC-005 provider-side credential rotation and audit remain required.

**Release verdict remains HOLD.**

## Dependency and typecheck update — 26 Oktober 2026

- Dependency gate is now PASS in the working tree: Next 16.4.3, Nodemailer 10.2.1, and Zod 4.6.6 yield 0 high/critical advisories in a fresh npm audit.
- Generated Next route types are regenerated before TypeScript checking. `next typegen` and `tsc --noEmit` both completed successfully after the patch.
- These fixes have not been deployed or verified against the production build. F-SEC-003, production role/RLS, checkout/payment, B2B workflow, concurrency, CI, browser QA identities, build completion, and performance/accessibility gates still prevent release.

**Release verdict: HOLD.**
