import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerGrid}>
          {/* Brand Column */}
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.footerLogo}>
              <span className={styles.footerLogoIcon}>WJ</span>
              <span className={styles.footerLogoText}>Wina Jaya</span>
            </Link>
            <p className={styles.footerDesc}>
              Produsen kain tekstil terpercaya sejak 1995. Melayani kebutuhan kain dari retail
              hingga volume besar dengan kualitas terbaik dan harga kompetitif.
            </p>
            <div className={styles.footerCerts}>
              <span className={styles.certBadge}>ISO 9001:2015</span>
              <span className={styles.certBadge}>OEKO-TEX</span>
              <span className={styles.certBadge}>GOTS</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className={styles.footerSection}>
            <h4>Navigasi</h4>
            <ul className={styles.footerLinks}>
              <li>
                <Link href="/" className={styles.footerLink}>
                  Beranda
                </Link>
              </li>
              <li>
                <Link href="/about" className={styles.footerLink}>
                  Tentang Kami
                </Link>
              </li>
              <li>
                <Link href="/products" className={styles.footerLink}>
                  Katalog Produk
                </Link>
              </li>
              <li>
                <Link href="/rfq/new" className={styles.footerLink}>
                  Ajukan Penawaran
                </Link>
              </li>
              <li>
                <Link href="/contact" className={styles.footerLink}>
                  Hubungi Kami
                </Link>
              </li>
            </ul>
          </div>

          {/* Products */}
          <div className={styles.footerSection}>
            <h4>Produk</h4>
            <ul className={styles.footerLinks}>
              <li>
                <Link href="/products?category=Katun" className={styles.footerLink}>
                  Kain Katun
                </Link>
              </li>
              <li>
                <Link href="/products?category=Polyester" className={styles.footerLink}>
                  Kain Polyester
                </Link>
              </li>
              <li>
                <Link href="/products?category=Rayon" className={styles.footerLink}>
                  Kain Rayon
                </Link>
              </li>
              <li>
                <Link href="/products?category=Denim" className={styles.footerLink}>
                  Kain Denim
                </Link>
              </li>
              <li>
                <Link href="/products?category=Linen" className={styles.footerLink}>
                  Kain Linen
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className={styles.footerSection}>
            <h4>Hubungi Kami</h4>
            <div className={styles.contactItem}>
              <span className={styles.contactIcon}>📍</span>
              <span>
                Jl. Raya Industri Tekstil No. 88,
                <br />
                Bandung, Jawa Barat 40553
              </span>
            </div>
            <div className={styles.contactItem}>
              <span className={styles.contactIcon}>📞</span>
              <span>+62 22 7234 5678</span>
            </div>
            <div className={styles.contactItem}>
              <span className={styles.contactIcon}>💬</span>
              <span>+62 812 3456 7890 (WhatsApp)</span>
            </div>
            <div className={styles.contactItem}>
              <span className={styles.contactIcon}>✉️</span>
              <span>info@winajaya.co.id</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.footerBottom}>
          <p className={styles.footerCopyright}>
            © {currentYear} PT. Wina Jaya Textile. Hak cipta dilindungi.
          </p>
          <ul className={styles.footerBottomLinks}>
            <li>
              <Link href="/legal/privacy" className={styles.footerBottomLink}>
                Kebijakan Privasi
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className={styles.footerBottomLink}>
                Syarat & Ketentuan
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
