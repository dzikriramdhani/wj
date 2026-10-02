import type { Metadata } from 'next';
import './globals.css';
import SmoothScroll from '@/components/SmoothScroll';
import SiteShell from './SiteShell';

export const metadata: Metadata = {
  title: 'Wina Jaya — Produsen Kain Tekstil Presisi Tinggi',
  description:
    'Produksi kain premium terintegrasi sejak 1994. Melayani kebutuhan garmen ekspor berskala besar hingga pesanan fleksibel konveksi dan tailor lokal.',
  keywords:
    'kain tekstil, produsen kain, supplier kain, kain katun, kain polyester, kain rayon, kain denim, grosir kain, pabrik kain bandung, custom dyeing, tech-pack',
  openGraph: {
    title: 'Wina Jaya — Tekstil Presisi Tinggi',
    description:
      'Produksi kain premium terintegrasi sejak 1994. Melayani industri garmen ekspor & tailor lokal.',
    type: 'website',
    locale: 'id_ID',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <SmoothScroll>
          <SiteShell paymentsSandbox={process.env.MIDTRANS_IS_PRODUCTION !== 'true'}>
            {children}
          </SiteShell>
        </SmoothScroll>
      </body>
    </html>
  );
}
