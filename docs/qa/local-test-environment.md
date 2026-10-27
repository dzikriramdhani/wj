# Lingkungan Tes Lokal Terisolasi

## Status saat audit ini

**PASS terbatas untuk local app HTTP dan anonymous browser smoke; BLOCKED untuk database/RLS/role Auth.** Standalone production build berhasil. `qa:local-http` memeriksa enam GET tanpa cookie pada loopback, dan Playwright menjalankan tiga browser smoke terhadap homepage/katalog serta redirect dashboard anonim. Tidak ada database disposable/identity yang dapat diverifikasi, sehingga tidak ada migration, seed, fixture, atau reset.

- Node.js 22.23.3 dan npm 11.6.1 tersedia; project menggunakan npm dan `apps/web/package-lock.json`.
- `psql` 18.4 tersedia. Windows service `postgresql-x64-18` berstatus berjalan dan `pg_isready` melaporkan `127.0.0.1:5432` menerima koneksi, tetapi `psql -w` ditolak karena tidak ada password. Identity/disposability database belum diverifikasi; service tidak diubah atau dipakai sebagai target tes. Port Supabase `54321` dan `54322` tidak merespons.
- Docker CLI tidak ditemukan. Supabase CLI 2.118.0 terpasang dan versinya diverifikasi dengan `SUPABASE_TELEMETRY_DISABLED=1`. Tidak ada local Supabase stack.
- `apps/web/.env.test.local` tidak ada. `apps/web/.env.local` ada; isi file itu tidak dibaca. Runner baru tidak membaca file `.env.local` atau mewarisi environment desktop.
- Metadata `supabase/.temp/project-ref` diperiksa secara programatis oleh guard tanpa menampilkan nilainya; guard menyimpulkan metadata link menunjuk ke project produksi yang dilarang, lalu berhenti sebelum membaca `.env.test.local`, menghubungi database, atau memulai tes. File metadata tidak diubah/dihapus.
- Registry npm berada pada mode `only-if-cached`; `npm view @playwright/test version` gagal `ENOTCACHED`. `@playwright/test` 1.58.2 dipasang offline dari tarball cache lokal; `npm ls`/`npx playwright --version` memverifikasi paket. Browser Chromium 1.61.1 yang tersedia di cache dipakai eksplisit untuk smoke lokal karena revision pasangan 1.58.2 tidak tersedia. CI memasang Chromium yang cocok. Vitest, Testing Library, ZAP, Lighthouse/LHCI, dan k6 tidak dipasang karena registry offline dan belum ada target terisolasi yang memerlukannya.
- `supabase/config.toml` menyatakan `project_id = "winajaya"`, Postgres major 17, serta seed default nonaktif. Auth `site_url` yang dikonfigurasi adalah domain storefront; jangan memakai config ini untuk browser login test sebelum local redirect override diverifikasi.
- Ada 37 migration SQL dengan numeric filename prefix dan tidak ada prefix duplikat. Pengurutan nama diperiksa secara statis; urutan aplikasi, status migration history, function/grant/constraint/index runtime belum diverifikasi karena tidak ada database lokal yang aman.
- REA MCP menjawab pemeriksaan status dan memiliki provider aktif, tetapi tidak ada target analisis terikat. Kapabilitas yang tersedia tidak meningkatkan pemetaan source repository; source, migrasi, dan tes diperiksa langsung.

Supabase project reference yang terhubung adalah **PRODUCTION**. Guard lokal tetap menolak seluruh target remote untuk tes DB/mutation; `npm run qa:db:guard` berhenti sebelum membaca `.env.test.local`, membuat koneksi, atau menjalankan migration. Izin production pada fase ini dipakai hanya untuk GET read-only ke halaman/API aplikasi, tanpa cookie. Tidak ada SQL/RPC/Storage/Auth/payment/email mutation ke project production.

## Isolated QA readiness checkpoint — 27 Oktober 2026

- Docker CLI tidak tersedia dan `supabase status` tidak dapat membuktikan stack lokal. Service PostgreSQL lokal yang berjalan tidak dianggap disposable; guard menerima hanya target Supabase loopback yang cocok pada port `54322` dan identity query yang sesuai.
- Alternatif yang didukung adalah project Supabase QA terpisah milik organisasi, dengan mail sink dan payment sandbox. Target tersebut memerlukan mode target terpisah; guard lokal yang ada tidak boleh diubah untuk menerima production.
- Fixture wajib: QA User A, QA User B, QA Admin, QA Super Admin, Organization A, dan Organization B. Ledger harus mencatat platform role terpisah dari role membership, ID fixture, namespace run, Storage path, idempotency key, dan status cleanup.
- RLS wajib memakai JWT user asli. Service-role hanya boleh dipakai untuk setup/cleanup fixture yang tercatat, bukan bukti policy user.
- F-SEC-003 memerlukan dua akun QA: setiap akun meminta response private yang berhasil, assertion hanya merekam status/header dan boolean ownership, lalu urutan dibalik dan diikuti anonymous request. Jangan menyimpan body, cookie, atau token.
- `npm run qa:db:guard` dieksekusi kembali dari `apps/web` dan memblokir metadata link production sebelum membaca environment test atau membuka koneksi. Ini adalah **PASS guard / BLOCKED integration**, bukan bukti database runtime.

Production target kini memiliki runner terpisah dan tidak mengendurkan guard lokal. Hasil preflight terbaru serta mode staging/production ada di [production-qa.md](production-qa.md). Runner lokal tetap menolak metadata link production; runner production memakai target ref dan hostname exact serta flag izin terpisah.

## Pengaman yang ditambahkan

- `scripts/qa/local-test-target.mjs` menolak konfigurasi tanpa `TEST_ENVIRONMENT=local`, project marker `local`, project id repo `winajaya`, serta URL server/browser yang sama pada `127.0.0.1:54321` dan `DATABASE_URL` lokal ke database `postgres` pada port `54322`. Ia membandingkan project ID dengan `supabase/config.toml` dan memeriksa link metadata Supabase CLI; project production yang diketahui atau remote tak dikenal ditolak sebelum `.env.test.local` dibaca.
- Resolusi DNS harus menghasilkan alamat loopback saja. Host remote, port/database berbeda, nilai yang berisi project reference produksi, URL API dengan kredensial/query, identity Postgres berbeda, dan environment variable tambahan ditolak.
- `scripts/qa/assert-local-test-target.mjs` hanya membaca `.env.test.local` jika file regular (bukan symlink), lalu menjalankan query identitas read-only melalui `psql`: nama database, alamat server, dan port. Ia tidak membaca `.env.local`, tidak menampilkan password, dan tidak memulai tes bila pemeriksaan gagal.
- `scripts/qa/run-local-integration.mjs` melakukan preflight yang sama dan hanya meneruskan enam variabel identitas target ke proses tes. Environment desktop dan kredensial/provider lain tidak diwariskan.
- Pengujian guard adalah unit test dengan identitas lokal sintetis; itu **bukan** bukti koneksi atau integritas database runtime.
- `scripts/qa/local-http-smoke.mjs` hanya menerima marker `QA_LOCAL_APP_MARKER=local` dan base URL persis `http://127.0.0.1:3100/`; ia hanya melakukan GET untuk empat API privat dan dua dashboard, memeriksa 401/403/307, response error-only, dan `private, no-store`. Tidak mewarisi cookie.
- `scripts/qa/start-local-standalone.mjs` hanya menerima marker dan URL loopback tetap, menolak standalone output yang memuat `.env*`, memastikan port 3100 kosong, serta menjalankan proses dengan allowlist environment dan Supabase loopback placeholders. Playwright config menolak target selain loopback port 3100. Browser berjalan headless tanpa traces/screenshots/video dan memblokir image optimization requests agar tidak menghubungi layanan avatar eksternal.
- Build lokal dijalankan dengan URL Supabase loopback dan key/provider placeholders kosong. Next mencatat `.env.local` dan `.env` sebagai file environment yang ditemukan (isinya tidak ditampilkan atau dibaca manual); Next standalone kemudian membuat salinan `.next/standalone/.env`. Metadata membuktikan salinan itu dibuat saat build dan cocok metadata dengan `.env` sumber, sehingga hanya salinan generated tersebut dihapus. Source `.env` tidak diubah. Hindari mengemas standalone build tanpa meninjau file environment yang mungkin disalin.

## Persiapan yang dibutuhkan untuk membuka integrasi

1. Untuk tes database, gunakan target PostgreSQL disposable yang dikelola untuk QA dan sediakan kredensial lokal melalui `.env.test.local`; jangan mencoba memakai service `postgresql-x64-18` sampai owner membuktikan identity dan data disposal.
2. Jika memilih Supabase CLI, gunakan runtime/container yang disetujui. Docker saat ini tidak tersedia, sehingga `supabase start` belum dijalankan.
3. Jangan mengubah `supabase/.temp/project-ref` di checkout ini. Guard untuk tes DB wajib tetap fail-closed pada linked project production; siapkan checkout test terpisah dengan identitas lokal terverifikasi.
4. Verifikasi port dan data directory sebelum start. Jangan mencetak `supabase status` mentah karena output dapat memuat JWT/API keys. Jangan gunakan `--linked`, `db push`, atau `db reset`.
5. Override Auth redirect/site URL agar hanya loopback sebelum browser tests. Jangan mengirim email; gunakan mailbox lokal atau Auth fixture tanpa email.
6. Buat `.env.test.local` dari `test/test-environment.env.example`; ganti password hanya dengan password local Supabase. Template tidak berisi API key atau kredensial provider.
7. Dari `apps/web`, jalankan `npm run qa:db:guard`, lalu tes. Guard wajib lulus sebelum runner dapat dimulai.

## Perintah

Jalankan dari `apps/web`:

```powershell
Copy-Item test/test-environment.env.example .env.test.local
# Isi password yang dibuat oleh stack Supabase LOCAL; jangan menyalin dari environment lain.
npm run qa:db:guard
npm test
npm run test:integration
```

Untuk smoke API pada standalone build lokal yang sudah berjalan di port 3100:

```powershell
$env:QA_LOCAL_APP_MARKER = 'local'
$env:QA_LOCAL_APP_URL = 'http://127.0.0.1:3100/'
npm run qa:local-http
```

Browser smoke pada build lokal (tanpa database/Auth):

```powershell
$env:QA_LOCAL_APP_MARKER = 'local'
$env:QA_LOCAL_APP_URL = 'http://127.0.0.1:3100/'
npm run test:e2e:local
```

`test:e2e:local` memakai browser Playwright yang terpasang. Pada mesin audit ini, browser cache dapat dipilih dengan `QA_LOCAL_CHROMIUM_EXECUTABLE` setelah memastikan path berada di `%LOCALAPPDATA%\ms-playwright`. Artefak screenshot/trace/video dimatikan.

Harness hanya melakukan GET tanpa cookie dan menolak hostname/port lain. Jalankan server dengan environment uji yang Supabase-nya loopback (`127.0.0.1:54321`) dan key/provider credentials kosong; jangan mewarisi nilai production.

`qa:db:guard` dan `test:integration` gagal tertutup bila project link, file, marker, endpoint, identity Postgres, atau koneksi tidak valid. Saat ini guard berhenti lebih awal karena link mengarah ke project production; `.env.test.local` tetap tidak dibaca dan sengaja belum dibuat. `npm run qa:local-http` menguji built app lokal tanpa DB; `npm run test:e2e:local` memerlukan standalone app yang sama pada loopback, marker local, dan Playwright Chromium. E2E hanya memvalidasi public pages/anonymous redirects, bukan login atau role runtime.

Untuk menghentikan stack lokal yang telah diverifikasi, jalankan dari checkout khusus: `supabase stop --project-id winajaya`. Perintah tersebut mempertahankan volume lokal; tidak memakai `--all` atau `--no-backup`. Tidak ada reset command karena reset menghapus state database dan belum ada database disposable yang dapat dibuktikan di mesin ini. Menurut [workflow resmi Supabase](https://supabase.com/docs/guides/local-development/cli-workflows), `supabase start` menerapkan migration/seed, `supabase stop` mempertahankan data, dan `supabase db reset` menghapus state lokal sebelum menerapkan ulang migration. [Referensi CLI](https://supabase.com/docs/reference/cli/global-flags) menunjukkan output `supabase status` menyertakan JWT secret dan anon/service keys; jangan tampilkan output itu tanpa redaksi.

Tidak ada `db reset`/truncate/teardown umum yang disediakan. Belum ada seed fixture maupun teardown selektif yang dapat dibuktikan aman. Reset hanya boleh dipertimbangkan pada instance baru yang disposable, setelah verifikasi operator dan identity; untuk data tes, teardown harus menghapus hanya synthetic IDs milik fixture tersebut. Supabase `db reset` tidak boleh dijalankan pada database yang pernah menyimpan data pengguna.

## Fixture yang direncanakan (belum dibuat)

Setelah database lokal tersedia, buat User A, User B, Admin, Super Admin (MFA lokal bila didukung), Organization A dan B, memberships terpisah, produk/varian/stok synthetic, RFQ/quotation/order dan objek Storage dengan prefiks fixture ID. Seluruh fixture harus memiliki owner/run ID agar cleanup selektif; tidak ada akun/email sungguhan, dokumen pelanggan, email eksternal, atau payment provider.

**Status seed, verifikasi role database, migration runtime, teardown, RLS, dan storage fixture: BLOCKED.**

## Build-isolation checkpoint — 26 Oktober 2026

`npm run qa:build:isolated:webpack` copied the app to a generated `.qa-isolated-build-*` directory, excluded `.env*`, lockfile duplicate, output/cache/test directories, and used only loopback Supabase placeholders. The process reached the optimized Next 16.4.3 Webpack compilation but failed with `EPERM` when creating a temporary `.next/server/app/api/products/[slug]` directory. The runner removed its generated directory in `finally`; a separate create/remove probe for the same nested directory succeeded. Therefore clean-build status is **FAIL/BLOCKED**, not PASS, and no old standalone artifact is used as evidence for the current dependency set.

## Build recovery and DB readiness — 27 Oktober 2026

`npm run qa:build:probe:webpack` creates a minimal, secret-free Next fixture with the same dynamic route shape and uses the same isolated runner. It failed inside the restricted runner at worker spawn (`EPERM`) but passed outside that restriction. The full `npm run qa:build:isolated:webpack` then passed outside the restriction with exit 0, using a new temporary copy and only loopback/placeholders; its workspace was removed after completion. This establishes that the previous build issue was a runner subprocess restriction, not a source or local Supabase target failure.

Database readiness is unchanged: Docker is unavailable, Supabase ports 54321/54322 are closed, and `npm run qa:db:guard` rejects the linked production project before reading an environment file or attempting a connection. A local/disposable stack and synthetic fixture ledger remain prerequisites for all RBAC/RLS and transaction testing.

## CI and disposable-target discovery — 27 Oktober 2026

- The only CI workflow trigger is `push` to `main` or `pull_request`; it has no `workflow_dispatch`. `act` and Docker are not installed, so there is no available local GitHub Actions runner. The working tree is dirty on `main` with no staged changes; creating a remote CI run for these changes requires an authorized audit branch/commit/PR and was not attempted.
- `psql` and a Windows PostgreSQL 18 service are present, and only port 5432 is listening. This does **not** establish that its database, data directory, credentials, or contents are disposable. It is excluded from QA. Supabase CLI is discoverable, but no local stack is running and no CLI stack/migration command was used.
- Viable options: (1) Docker Desktop or an equivalent approved container runtime, then a separate local Supabase checkout/stack at the guarded ports; or (2) an operator-provisioned disposable PostgreSQL/Supabase QA instance with loopback/private network identity, non-production project ID, local Auth redirect/mail sink, and a verified data directory. Both options require a fresh test-only environment file and successful guard before migrations, seeds, or fixtures.
