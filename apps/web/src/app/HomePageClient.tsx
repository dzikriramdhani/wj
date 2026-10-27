'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Fragment, useRef, useState, useEffect } from 'react';
import styles from './page.module.css';
import { products } from '@/lib/mock-data';
import { getHomeAssetUrl, type HomeContent } from '@/lib/home-content';
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

function Lines({ value }: { value: string }) {
  return <>{value.split(/\r?\n/).map((line, index) => <Fragment key={`${index}-${line}`}>{index > 0 && <br />}{line}</Fragment>)}</>;
}

export default function HomePageClient({ initialContent }: { initialContent: HomeContent }) {
  const homeContent = initialContent;
  const [featuredProducts, setFeaturedProducts] = useState(
    process.env.NEXT_PUBLIC_SUPABASE_URL ? [] : products.slice(0, 8),
  );
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);

  useEffect(() => {
    let active = true;
    const productRequest = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? fetch('/api/products?limit=50').then(async (response) => response.ok ? await response.json() as { products?: Product[] } : null).catch(() => null)
      : Promise.resolve({ products });

    productRequest.then((productResult) => {
      if (!active) return;
      const catalogProducts = productResult?.products ?? (process.env.NEXT_PUBLIC_SUPABASE_URL ? [] : products);
      const bySlug = new Map(catalogProducts.map((product) => [product.slug, product]));
      const selected = initialContent.catalog.productSlugs.length
        ? initialContent.catalog.productSlugs.flatMap((slug) => bySlug.has(slug) ? [bySlug.get(slug)!] : [])
        : catalogProducts.slice(0, 8);
      setFeaturedProducts(selected);
    });

    return () => { active = false; };
  }, [initialContent]);

  // Older published CMS payloads may not have the logo field yet.
  const savedTrustedLogos = homeContent.trusted?.logos;
  const trustedLogos = Array.isArray(savedTrustedLogos)
    ? savedTrustedLogos.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : [];
  const trustedRows = [0, 1, 2].map((column) => trustedLogos.filter((_, index) => index % 3 === column));
  const renderTrustRow = (row: HomeContent['trusted']['logos'], column: number, reverse = false) => (
    <div className={`${styles.marqueeTrack} ${reverse ? styles.reverse : ''}`}>
      {[...row, ...row].map((logoPath, index) => (
        getHomeAssetUrl(logoPath) ? <div className={styles.marqueeLogo} key={`${column}-${logoPath}-${index}`}>
          <Image src={getHomeAssetUrl(logoPath)} alt="" fill sizes="(max-width: 767px) 34vw, 15vw" />
        </div> : null
      ))}
    </div>
  );

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
        <div className={styles.heroBg} style={homeContent.hero.imagePath ? { backgroundImage: `url("${getHomeAssetUrl(homeContent.hero.imagePath)}")` } : undefined} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            <Lines value={homeContent.hero.title} />
          </h1>
        </div>
      </section>

      {/* ---- TAGLINE ROW ---- */}
      <div className={styles.taglineRow}>
        <div className={styles.taglineInner}>
          <p className={styles.taglineText}><Lines value={homeContent.tagline} /></p>
        </div>
      </div>

      {/* ---- CONTENT WRAPPER (Covers Hero on Scroll) ---- */}
      <div className={styles.bottomWrapper}>
        {/* ---- CATALOG SECTION ---- */}
      <section className={styles.catalogSection} ref={sectionRef}>
        <div className={styles.catalogSticky}>
          <div className={styles.catalogInner}>
            <div className={styles.catalogHeader}>
              <h2 className={styles.catalogTitle}><Lines value={homeContent.catalog.title} /></h2>
              <Link href="/products" className={styles.catalogLink}>{homeContent.catalog.linkLabel}</Link>
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
                    {product.images?.[0]
                      ? <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 767px) 60vw, (max-width: 1023px) 32vw, 24vw" className={styles.productImage} />
                      : <div
                          className={styles.productImagePlaceholder}
                          style={{ background: categoryGradients[product.category] || categoryGradients.Katun }}
                        />}
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
      {trustedLogos.length > 0 && <section className={styles.trustedSection}>
        <div className={styles.trustedInner}>
          <div className={styles.trustedLeft}>
            <h2 className={styles.trustedTitle}><Lines value={homeContent.trusted.title} /></h2>
          </div>

          <div className={styles.marqueeContainer}>
            <div className={styles.marqueeOverlayTop} />
            <div className={styles.marqueeCol}>{renderTrustRow(trustedRows[0], 0)}</div>
            <div className={styles.marqueeCol}>{renderTrustRow(trustedRows[1], 1, true)}</div>
            <div className={styles.marqueeCol}>{renderTrustRow(trustedRows[2], 2)}</div>
            <div className={styles.marqueeOverlayBottom} />
          </div>
        </div>
      </section>}

      {/* ---- INJECTED ABOUT SECTION ---- */}
      <section className={styles.aboutHeroSection}>
        <h1 className={styles.aboutHeroTitle}><Lines value={homeContent.about.title} /></h1>
      </section>

      <section className={styles.aboutIntroSection}>
        <div className={styles.aboutIntroInner}>
          <p className={styles.aboutIntroText}>{homeContent.about.body}</p>
        </div>
      </section>

      <section className={styles.aboutImageBreakSection}>
        <div className={styles.aboutImageBreakPlaceholder} style={homeContent.about.imagePath ? { backgroundImage: `url("${getHomeAssetUrl(homeContent.about.imagePath)}")`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined} />
      </section>

      <section className={styles.certSection}>
        <div className={styles.certHeader}>
          <h2 className={styles.certTitle}>{homeContent.certifications.title}</h2>
        </div>
        <div className={styles.certGrid}>
          {homeContent.certifications.items.map((item) => <div className={styles.certCard} key={item.name}><h4 className={styles.certName}>{item.name}</h4><p className={styles.certDesc}>{item.description}</p></div>)}
        </div>
      </section>

        {/* ---- FOOTER WRAPPER ---- */}
        <div className={styles.footerWrapper}>
          {/* ---- CTA SECTION ---- */}
        <section className={styles.ctaSection}>
          <span className={styles.ctaWatermark} aria-hidden="true">Wina<br />Jaya</span>
          <div className={styles.ctaInner}>
            <div className={styles.ctaLeft}>
              <h2 className={styles.ctaTitle}><Lines value={homeContent.cta.title} /></h2>
              <p className={styles.ctaDesc}>{homeContent.cta.description}</p>
            </div>
            <div className={styles.ctaRight}>
              <Link href={homeContent.cta.buttonHref} className={styles.ctaBtn}>
                {homeContent.cta.buttonLabel}
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
                © 2026 PT Wina Jaya. Seluruh hak cipta dilindungi hukum.
              </p>
            </div>
          </div>
          </footer>
        </div>
      </div>
    </>
  );
}
