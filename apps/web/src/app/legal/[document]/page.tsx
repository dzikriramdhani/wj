import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

const documents = {
  privacy: {
    title: 'Kebijakan Privasi',
    lead: 'Cara PT Wina Jaya Textile memproses data yang Anda kirim melalui situs ini.',
    sections: [
      ['Data yang dikumpulkan', 'Kami menyimpan data akun, permintaan penawaran, pesanan, dan pesan kontak yang Anda berikan untuk melayani transaksi dan komunikasi bisnis.'],
      ['Penggunaan data', 'Data digunakan untuk memproses pesanan, menanggapi RFQ, mengirim pembaruan transaksi, dan memenuhi kewajiban hukum.'],
      ['Penyimpanan dan akses', 'Akses data dibatasi berdasarkan peran kerja. Anda dapat meminta pembaruan data akun melalui halaman Akun.'],
    ],
  },
  terms: {
    title: 'Syarat & Ketentuan',
    lead: 'Ketentuan penggunaan situs dan layanan pemesanan PT Wina Jaya Textile.',
    sections: [
      ['Akun dan informasi', 'Anda bertanggung jawab menjaga keamanan kredensial akun dan memberikan informasi yang benar saat mendaftar atau memesan.'],
      ['Ketersediaan produk', 'Stok, harga, dan ongkos kirim ditampilkan saat transaksi. Pesanan tunduk pada ketersediaan stok dan verifikasi pembayaran.'],
      ['Permintaan penawaran', 'RFQ bersifat permintaan awal. Harga dan waktu produksi final mengikuti penawaran yang disetujui kedua pihak.'],
    ],
  },
} as const;

export default async function LegalDocumentPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  const content = documents[document as keyof typeof documents];
  if (!content) notFound();
  return <main className={styles.main}><article className={styles.article}>
    <Link href="/" className={styles.back}>← Kembali ke beranda</Link>
    <p className={styles.eyebrow}>WINA JAYA TEXTILE</p><h1>{content.title}</h1><p className={styles.lead}>{content.lead}</p>
    {content.sections.map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}
    <p className={styles.updated}>Terakhir diperbarui: 29 September 2026.</p>
  </article></main>;
}
