'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';
import styles from './page.module.css';
import { products, companyInfo } from '@/lib/mock-data';
import type { Product } from '@/types';
import { formatRupiah } from '@/lib/routing-logic';

const categoryGradients: Record<string, string> = {
  Katun: 'linear-gradient(135deg, #d4c5a9 0%, #c8b896 50%, #bfad85 100%)',
  Polyester: 'linear-gradient(135deg, #b8c9d4 0%, #9fb8c8 50%, #8aacc0 100%)',
  Rayon: 'linear-gradient(135deg, #d4b8c0 0%, #c8a0b0 50%, #bc8ea0 100%)',
  Denim: 'linear-gradient(135deg, #3a5068 0%, #2e4057 50%, #243348 100%)',
  Linen: 'linear-gradient(135deg, #c8c0a8 0%, #bcb49a 50%, #b0a88c 100%)',
  Spandex: 'linear-gradient(135deg, #383838 0%, #282828 50%, #1a1a1a 100%)',
};

const reviews = [
  {
    name: "Jack",
    username: "@jack",
    body: "I've never seen anything like this before. It's amazing. I love it.",
    img: "https://avatar.vercel.sh/jack",
  },
  {
    name: "Jill",
    username: "@jill",
    body: "I don't know what to say. I'm speechless. This is amazing.",
    img: "https://avatar.vercel.sh/jill",
  },
  {
    name: "John",
    username: "@john",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/john",
  },
  {
    name: "Jane",
    username: "@jane",
    body: "This completely changed the way I work. Absolutely incredible.",
    img: "https://avatar.vercel.sh/jane",
  },
  {
    name: "Jenny",
    username: "@jenny",
    body: "The quality is unmatched. I highly recommend this to everyone.",
    img: "https://avatar.vercel.sh/jenny",
  },
  {
    name: "James",
    username: "@james",
    body: "Superb experience from start to finish. Exceeded expectations.",
    img: "https://avatar.vercel.sh/james",
  }
];

const firstRow = reviews.slice(0, 2);
const secondRow = reviews.slice(2, 4);
const thirdRow = reviews.slice(4, 6);

const ReviewCard = ({ img, name, username, body }: { img: string, name: string, username: string, body: string }) => {
  return (
    <figure className={styles.reviewCard}>
      <div className={styles.reviewHeader}>
        <Image className={styles.reviewAvatar} width={32} height={32} alt="" src={img} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <figcaption className={styles.reviewName}>{name}</figcaption>
          <p className={styles.reviewUsername}>{username}</p>
        </div>
      </div>
      <blockquote className={styles.reviewBody}>{body}</blockquote>
    </figure>
  );
};

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState(
    process.env.NEXT_PUBLIC_SUPABASE_URL ? [] : products.slice(0, 8),
  );
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    let active = true;
    fetch('/api/products?limit=8')
      .then(async (response) => {
        if (!response.ok) throw new Error('Catalog unavailable');
        return response.json();
      })
      .then((result) => {
        if (active) setFeaturedProducts((result.products ?? []) as Product[]);
      })
      .catch(() => {
        if (active) setFeaturedProducts([]);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!trackRef.current || !sectionRef.current) return;

    const updateMaxScroll = () => {
      if (trackRef.current && sectionRef.current) {
        // We add 32px (var(--space-xl)) to the scroll distance so the last card's 
        // right edge aligns perfectly with the "Semua Katalog" text.
        const ms = trackRef.current.scrollWidth - window.innerWidth + 32;
        setMaxScroll(ms > 0 ? ms : 0);
        // Add a 300px scroll buffer at the end so it stays still for a moment
        // when the last card is visible, before scrolling down.
        sectionRef.current.style.height = `${window.innerHeight + (ms > 0 ? ms : 0) + 300}px`;
      }
    };

    updateMaxScroll();

    const observer = new ResizeObserver(() => {
      updateMaxScroll();
    });
    
    observer.observe(trackRef.current);
    observer.observe(document.body);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      
      const { top, height } = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      if (top <= 0) {
        const scrollableDistance = height - windowHeight;
        let progress = Math.abs(top) / scrollableDistance;
        progress = Math.max(0, Math.min(progress, 1));
        setScrollProgress(progress);
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* ---- HERO ---- */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Tekstil presisi tinggi
            <br />
            Untuk industri &amp;
            <br />
            kreasi
          </h1>
        </div>
      </section>

      {/* ---- TAGLINE ROW ---- */}
      <div className={styles.taglineRow}>
        <div className={styles.taglineInner}>
          <p className={styles.taglineText}>
            Produksi kain premium terintegrasi sejak 1994.
            <br />
            Melayani kebutuhan garmen ekspor berskala besar
            <br />
            hingga pesanan fleksibel konveksi dan tailor lokal
          </p>
        </div>
      </div>

      {/* ---- CONTENT WRAPPER (Covers Hero on Scroll) ---- */}
      <div className={styles.bottomWrapper}>
        {/* ---- CATALOG SECTION ---- */}
      <section className={styles.catalogSection} ref={sectionRef}>
        <div className={styles.catalogSticky}>
          <div className={styles.catalogInner}>
            <div className={styles.catalogHeader}>
              <h2 className={styles.catalogTitle}>
                Katalog
                <br />
                Unggulan
              </h2>
              <Link href="/products" className={styles.catalogLink}>
                Semua Katalog
              </Link>
            </div>

            <div 
              className={styles.productGrid} 
              ref={trackRef}
              style={{ transform: `translateX(-${scrollProgress * maxScroll}px)` }}
            >
              {featuredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className={styles.productCard}
                >
                  <div className={styles.productImageWrap}>
                    <div
                      className={styles.productImagePlaceholder}
                      style={{
                        background: categoryGradients[product.category] || categoryGradients.Katun,
                      }}
                    />
                  </div>
                  <div>
                    <h3 className={styles.productName}>{product.name}</h3>
                    <p className={styles.productMeta}>
                      {product.composition}
                      {' '}•{' '}
                      Lebar {product.widthCm} cm&nbsp;• Anti-Pilling
                      <br />
                      {product.gsm} GSM
                    </p>
                    <div className={styles.productFooter}>
                      <span className={styles.productPrice}>
                        {product.isCustomOnly ? 'Hubungi untuk harga' : `${formatRupiah(product.pricePerMeter)}/m`}
                      </span>
                      <span className={styles.productArrow}>→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- TRUSTED SECTION ---- */}
      <section className={styles.trustedSection}>
        <div className={styles.trustedInner}>
          <div className={styles.trustedLeft}>
            <h2 className={styles.trustedTitle}>
              Dipercaya oleh
              <br />
              Brand
            </h2>
          </div>

          <div className={styles.marqueeContainer}>
            <div className={styles.marqueeOverlayTop} />
            
            {/* Column 1 */}
            <div className={styles.marqueeCol}>
              <div className={styles.marqueeTrack}>
                {firstRow.map((review) => <ReviewCard key={`c1-a-${review.username}`} {...review} />)}
                {firstRow.map((review) => <ReviewCard key={`c1-b-${review.username}`} {...review} />)}
              </div>
            </div>

            {/* Column 2 (Reverse) */}
            <div className={styles.marqueeCol}>
              <div className={`${styles.marqueeTrack} ${styles.reverse}`}>
                {secondRow.map((review) => <ReviewCard key={`c2-a-${review.username}`} {...review} />)}
                {secondRow.map((review) => <ReviewCard key={`c2-b-${review.username}`} {...review} />)}
              </div>
            </div>

            {/* Column 3 */}
            <div className={styles.marqueeCol}>
              <div className={styles.marqueeTrack}>
                {thirdRow.map((review) => <ReviewCard key={`c3-a-${review.username}`} {...review} />)}
                {thirdRow.map((review) => <ReviewCard key={`c3-b-${review.username}`} {...review} />)}
              </div>
            </div>

            <div className={styles.marqueeOverlayBottom} />
          </div>
        </div>
      </section>

      {/* ---- INJECTED ABOUT SECTION ---- */}
      <section className={styles.aboutHeroSection}>
        <h1 className={styles.aboutHeroTitle}>
          Pabrik tekstil<br/>
          terintegrasi<br/>
          sejak {companyInfo.founded}
        </h1>
      </section>

      <section className={styles.aboutIntroSection}>
        <div className={styles.aboutIntroInner}>
          <p className={styles.aboutIntroText}>
            PT. Wina Jaya Textile memulai perjalanannya dari sebuah pabrik tenun skala menengah di Bandung. Kini, dengan luas fasilitas {companyInfo.capacity} lebih dari 15.000 m², kami bangga menjadi salah satu produsen kain tekstil terdepan di Indonesia yang dipercaya oleh lebih dari {companyInfo.totalClients} klien aktif dari berbagai skala bisnis.
          </p>
        </div>
      </section>

      <section className={styles.aboutImageBreakSection}>
        <div className={styles.aboutImageBreakPlaceholder} />
      </section>

      <section className={styles.certSection}>
        <div className={styles.certHeader}>
          <h2 className={styles.certTitle}>Sertifikasi Standar</h2>
        </div>
        <div className={styles.certGrid}>
          <div className={styles.certCard}>
            <h4 className={styles.certName}>ISO 9001:2015</h4>
            <p className={styles.certDesc}>Sistem Manajemen Mutu berstandar internasional, menjamin konsistensi produksi.</p>
          </div>
          <div className={styles.certCard}>
            <h4 className={styles.certName}>OEKO-TEX®</h4>
            <p className={styles.certDesc}>Sertifikasi keamanan tekstil bebas zat berbahaya, aman untuk kulit sensitif.</p>
          </div>
          <div className={styles.certCard}>
            <h4 className={styles.certName}>GOTS</h4>
            <p className={styles.certDesc}>Global Organic Textile Standard untuk tanggung jawab lingkungan &amp; sosial.</p>
          </div>
        </div>
      </section>

        {/* ---- FOOTER WRAPPER ---- */}
        <div className={styles.footerWrapper}>
          {/* ---- CTA SECTION ---- */}
        <section className={styles.ctaSection}>
          <span className={styles.ctaWatermark}>
            Wina<br />Jaya
          </span>
          <div className={styles.ctaInner}>
            <div className={styles.ctaLeft}>
              <h2 className={styles.ctaTitle}>
                Siap untuk produksi
                <br />
                Skala masal atau
                <br />
                Custom dyeing
                <br />
                Pantone?
              </h2>
              <p className={styles.ctaDesc}>
                Kirimkan lembar spesifikasi (tech-pack) Anda. Tim engineer
                <br />
                lab tekstil kami memproses kalkulasi yield, formulasi lab-dip
                <br />
                dalam 72 jam kerja, serta estimasi kapasitas slot mesin tanpa
                <br />
                biaya konsultasi.
              </p>
            </div>
            <div className={styles.ctaRight}>
              <Link href="/rfq/new" className={styles.ctaBtn}>
                Pesan swatch sample
                <span className={styles.ctaBtnArrow}>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ---- FOOTER ---- */}
        <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <p className={styles.footerBrandName}>Wina jaya</p>
              <p className={styles.footerBrandSub}>EST. BANDUNG TEXTILE DISTRICT / INDONESIA</p>
              <p className={styles.footerBrandDesc}>
                Industrial textile manufacturing combining
                heavy-duty weaving, certified sustainable
                finishing, and high-performance streetwear
                substrate engineering.
              </p>
            </div>

            <div>
              <p className={styles.footerColTitle}>Direktori</p>
              <div className={styles.footerLinks}>
                <Link href="/" className={styles.footerLink}>Home Index</Link>
                <Link href="/products" className={styles.footerLink}>Katalog Tekstil</Link>
                <Link href="/rfq/new" className={styles.footerLink}>Permintaan RFQ</Link>
                <Link href="/contact" className={styles.footerLink}>Kontak &amp; Lab</Link>
                <Link href="/products?custom=1" className={styles.footerLink}>Sourcing</Link>
              </div>
            </div>

            <div>
              <p className={styles.footerColTitle}>Technical dispatch</p>
              <p className={styles.footerDispatchText}>
                Buletin material teknis bulanan mengenai riset
                GSM, ketersediaan benang combed, dan kuota
                produksi pabrik.
              </p>
              <form className={styles.footerDispatchForm} onSubmit={(e) => e.preventDefault()}>
                <input type="email" placeholder="Alamat email..." className={styles.footerDispatchInput} required />
                <button type="submit" className={styles.footerDispatchBtn}>→</button>
              </form>
            </div>
          </div>

            <div className={styles.footerBottom}>
              <p className={styles.footerCopyright}>
                © 2026 PT WINA JAYA. SELURUH HAK CIPTA DILINDUNGI HUKUM.
              </p>
            </div>
          </div>
          </footer>
        </div>
      </div>
    </>
  );
}
