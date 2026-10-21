import { z } from 'zod';

const assetPathSchema = z.string().max(240).refine(
  (value) => value === '' || /^home\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/.test(value),
  'Path gambar tidak valid.',
);

const lineText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const homeContentSchema = z.object({
  schemaVersion: z.literal(1),
  hero: z.object({
    title: lineText(180),
    imagePath: assetPathSchema,
  }).strict(),
  tagline: lineText(500),
  catalog: z.object({
    title: lineText(100),
    linkLabel: lineText(60),
    productSlugs: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120)).max(8),
  }).strict().refine((value) => new Set(value.productSlugs).size === value.productSlugs.length, 'Produk unggulan tidak boleh duplikat.'),
  trusted: z.object({
    title: lineText(100),
    cards: z.array(z.object({
      name: lineText(80),
      username: lineText(100),
      body: lineText(280),
    }).strict()).min(3).max(12),
  }).strict(),
  about: z.object({
    title: lineText(120),
    body: lineText(900),
    imagePath: assetPathSchema,
  }).strict(),
  certifications: z.object({
    title: lineText(100),
    items: z.array(z.object({
      name: lineText(80),
      description: lineText(240),
    }).strict()).min(1).max(8),
  }).strict(),
  cta: z.object({
    title: lineText(180),
    description: lineText(700),
    buttonLabel: lineText(80),
    buttonHref: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/).max(240),
  }).strict(),
  seo: z.object({
    title: lineText(90),
    description: lineText(240),
  }).strict(),
}).strict();

export type HomeContent = z.infer<typeof homeContentSchema>;

export const defaultHomeContent: HomeContent = {
  schemaVersion: 1,
  hero: { title: 'Tekstil presisi tinggi\nUntuk industri &\nkreasi', imagePath: '' },
  tagline: 'Produksi kain premium terintegrasi sejak 1994.\nMelayani kebutuhan garmen ekspor berskala besar\nhingga pesanan fleksibel konveksi dan tailor lokal',
  catalog: { title: 'Katalog\nUnggulan', linkLabel: 'Semua Katalog', productSlugs: [] },
  trusted: {
    title: 'Dipercaya oleh\nBrand',
    cards: [
      { name: 'Jack', username: '@jack', body: "I've never seen anything like this before. It's amazing. I love it." },
      { name: 'Jill', username: '@jill', body: "I've never seen anything like this before. It's amazing. I love it." },
      { name: 'John', username: '@john', body: "I'm at a loss for words. This is amazing. I love it." },
      { name: 'Jane', username: '@jane', body: 'This completely changed the way I work. Absolutely incredible.' },
      { name: 'Jenny', username: '@jenny', body: 'The quality is unmatched. I highly recommend this to everyone.' },
      { name: 'James', username: '@james', body: 'Superb experience from start to finish. Exceeded expectations.' },
    ],
  },
  about: {
    title: 'Pabrik tekstil\nterintegrasi\nsejak 1995',
    body: 'PT. Wina Jaya Textile memulai perjalanannya dari sebuah pabrik tenun skala menengah di Bandung. Kini, dengan luas fasilitas 500.000 meter/bulan lebih dari 15.000 m², kami bangga menjadi salah satu produsen kain tekstil terdepan di Indonesia yang dipercaya oleh lebih dari 350 klien aktif dari berbagai skala bisnis.',
    imagePath: '',
  },
  certifications: {
    title: 'Sertifikasi Standar',
    items: [
      { name: 'ISO 9001:2015', description: 'Sistem Manajemen Mutu berstandar internasional, menjamin konsistensi produksi.' },
      { name: 'OEKO-TEX®', description: 'Sertifikasi keamanan tekstil bebas zat berbahaya, aman untuk kulit sensitif.' },
      { name: 'GOTS', description: 'Global Organic Textile Standard untuk tanggung jawab lingkungan & sosial.' },
    ],
  },
  cta: {
    title: 'Siap untuk produksi\nSkala masal atau\nCustom dyeing\nPantone?',
    description: 'Kirimkan lembar spesifikasi (tech-pack) Anda. Tim engineer lab tekstil kami memproses kalkulasi yield, formulasi lab-dip dalam 72 jam kerja, serta estimasi kapasitas slot mesin tanpa biaya konsultasi.',
    buttonLabel: 'Pesan swatch sample',
    buttonHref: '/rfq/new',
  },
  seo: {
    title: 'Wina Jaya — Produsen Kain Tekstil Presisi Tinggi',
    description: 'Produksi kain premium terintegrasi sejak 1994. Melayani kebutuhan garmen ekspor berskala besar hingga pesanan fleksibel konveksi dan tailor lokal.',
  },
};

export function getHomeAssetUrl(path: string) {
  if (!path || !process.env.NEXT_PUBLIC_SUPABASE_URL) return '';
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/brand-assets/${encodedPath}`;
}
