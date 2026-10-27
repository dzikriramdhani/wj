# Laporan Performance, Responsive, dan Accessibility

## Checkpoint — 27 Oktober 2026

Build Webpack terisolasi dengan Next 16.4.3 gagal dengan `EPERM` saat membuat output sementara. Karena tidak ada artefak build baru, tidak ada Lighthouse, Web Vitals, browser timing, ataupun ukuran bundle yang diukur pada checkpoint ini. Semua target LCP/INP/CLS tetap **NOT MEASURED**.

## Build recovery update — 27 Oktober 2026

The clean isolated Webpack build now completes with exit 0. This establishes buildability only; no Lighthouse/LHCI, Web Vitals, browser timing, bundle-budget, responsive, or accessibility measurement was run. LCP, INP, and CLS remain **NOT MEASURED**.

## Status

Pengukuran Lighthouse/Web Vitals **BLOCKED**: Playwright Test tersedia untuk tiga anonymous local smoke checks, tetapi Lighthouse/LHCI belum terpasang dan npm registry offline; Docker tidak tersedia; tidak ada akun fixture; dan tidak ada data RUM yang diberikan. Public HTTP GET berhasil tetapi hanya status/header diperiksa. Tidak ada angka LCP/INP/CLS yang diklaim.

## Bukti yang tersedia

- ESLint PASS dengan enam warning penggunaan `<img>`: satu di cart, empat di checkout, satu di halaman payment. Ini kandidat optimasi gambar/LCP; belum ada pengukuran untuk menetapkan dampak.
- Source memakai Next.js App Router dan asset gambar melalui Storage. Ukuran gambar nyata, responsive behavior, cache headers, dan layout shift belum diukur.
- Production public routes `/` and `/products` returned HTTP 200. Root response carried CSP, HSTS, frame, MIME, referrer, and permissions headers. Ini bukan Lighthouse atau RUM dan tidak membuktikan metric performa.
- Local production build compiled successfully and generated 48 static pages. A sandboxed static ISR fetch had no local Supabase server credential and logged an expected CMS data-fetch error; build still completed. SSR content freshness and DB latency remain unmeasured.
- Three headless Playwright checks passed on the local standalone build for homepage/catalog rendering and anonymous admin/super-admin redirects. The browser run blocks external avatar image requests; it is not a visual, responsive, accessibility, or timing audit.
- Target awal proyek: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. Tidak ada hasil lab maupun data pengguna nyata untuk dibandingkan.

## Checks belum dijalankan

RFQ, cart/checkout, account/dashboard, authenticated Admin/Super Admin CMS, viewport mobile/desktop, keyboard, label form, loading/error states, Core Web Vitals, API latency, and database query timing belum diukur. Browser inspection was stopped after a pre-existing login session exposed a private account view; no artifacts were retained.

Production-authorized preflight terbaru gagal sebelum request karena DNS tidak resolve. Tidak ada endpoint timing baru, database query latency, atau production performance measurement yang dicatat.

## Langkah berikutnya

Jalankan Lighthouse desktop/mobile terhadap deployment test lokal yang aman; simpan trace dan output lengkap. Pisahkan hasil lab dari RUM. Tinjau warning `<img>` setelah metrik mengidentifikasi gambar/halaman yang berdampak, lalu ulangi pengukuran.

## Rerun — 24 Oktober 2026

Tidak ada metrik production terbaru: DNS untuk `wj-wine.vercel.app` gagal sebelum HTTP. Local anonymous Playwright rerun (3 tes) menguji route/status/heading saja, bukan timing, visual breakpoint, keyboard, contrast, atau accessibility. LCP/INP/CLS tetap **NOT MEASURED**. Lighthouse/LHCI tidak tersedia dan npm registry tidak resolve; pemasangan tidak dicoba ulang. Build production baru **BLOCKED** karena environment aman yang mengecualikan `.env.local` belum dapat dibangun dengan dependency copy yang tersedia. Hasil build terdahulu bukan pengukuran performa rerun.
