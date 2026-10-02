'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';
import { useCart } from '@/lib/cart-context';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Product', href: '/products' },
  { label: 'Custom Product', href: '/rfq/new' },
  { label: 'Contact', href: '/contact' },
];

export default function Navbar({ offsetTop = 0 }: { offsetTop?: number }) {
  const { items } = useCart();
  const pathname = usePathname();
  const isHome = pathname === '/';
  
  const [scrolled, setScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [account, setAccount] = useState<{ signedIn: boolean; defaultPortal: string; label: string } | null>(null);
  const [currentDate, setCurrentDate] = useState('24/01');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      setCurrentDate(`${day}/${month}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setScrolled(currentScrollY > 20);
      
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setIsHidden(true);
      } else if (currentScrollY < lastScrollY) {
        setIsHidden(false);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/access', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session unavailable');
        return response.json();
      })
      .then((result) => {
        if (active && result.data) setAccount(result.data);
      })
      .catch(() => {
        if (active) setAccount({ signedIn: false, defaultPortal: '/login', label: 'Login' });
      });
    return () => { active = false; };
  }, []);

  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  const accountHref = account?.signedIn ? account.defaultPortal : `/login?redirectTo=${encodeURIComponent(pathname)}`;
  const accountLabel = account?.signedIn ? account.label : 'Login';

  return (
    <>
      <nav
        className={`${styles.navbar} ${isHome && scrolled ? styles.scrolled : ''} ${!isHome ? styles.notHome : ''} ${isHidden ? styles.hidden : ''}`}
        style={offsetTop ? { top: offsetTop } : undefined}
      >
        <div className={styles.navbarInner}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoMark}>WJ</span>
          </Link>

          <div className={styles.centerBadge}>
            {currentDate}
          </div>

          <div className={styles.navRight}>
            <button
              className={`${styles.menuBtn} ${menuOpen ? styles.open : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <span className={styles.menuLine} />
              <span className={styles.menuLine} />
              <span className={styles.menuLine} />
            </button>
          </div>
        </div>
      </nav>

      {/* Side Slide-out Menu */}
      <div className={`${styles.sideMenu} ${menuOpen ? styles.open : ''}`}>
        <div className={styles.sideMenuOverlay} onClick={() => setMenuOpen(false)}></div>
        
        <div className={styles.sideMenuContent}>
          <div className={styles.sideMenuHeader}>
            <button className={styles.closeBtn} onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
          </div>
          
          <div className={styles.sideMenuLinks}>
            {navItems.map((item, index) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className={styles.sideMenuLink} 
                onClick={() => setMenuOpen(false)}
                style={{ '--stagger-idx': index } as React.CSSProperties}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className={styles.sideMenuFooter}>
            <Link 
              href="/checkout" 
              className={styles.sideMenuFooterLink} 
              onClick={() => setMenuOpen(false)}
              style={{ '--stagger-idx': navItems.length } as React.CSSProperties}
            >
              Cart ({items.length})
            </Link>
            <Link 
              href={accountHref} 
              className={styles.sideMenuFooterLink} 
              onClick={() => setMenuOpen(false)}
              style={{ '--stagger-idx': navItems.length + 1 } as React.CSSProperties}
            >
              {accountLabel}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
