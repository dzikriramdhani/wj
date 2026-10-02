'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './layout.module.css';

type PortalKind = 'admin' | 'super-admin';

const portalConfig: Record<PortalKind, {
  title: string;
  roleLabel: string;
  navItems: Array<{ name: string; path: string; icon: string }>;
}> = {
  admin: {
    title: 'WJ Admin',
    roleLabel: 'Administrator Platform',
    navItems: [
      { name: 'Dashboard', path: '/admin', icon: '🏠' },
      { name: 'Produk & Katalog', path: '/admin/products', icon: '📦' },
      { name: 'Lookbook', path: '/admin/lookbook', icon: '🖼️' },
      { name: 'Pesanan & Pembayaran', path: '/admin/orders', icon: '🧾' },
      { name: 'RFQ & B2B', path: '/admin/rfq', icon: '📋' },
      { name: 'Customer', path: '/admin/customers', icon: '👥' },
      { name: 'Operasi', path: '/admin/operations', icon: '📈' },
      { name: 'Governance', path: '/admin/governance', icon: '🛡️' },
    ],
  },
  'super-admin': {
    title: 'WJ Super Admin',
    roleLabel: 'Super Admin · MFA',
    navItems: [
      { name: 'Pengguna & Role', path: '/super-admin', icon: '🔐' },
      { name: 'Operasi Admin', path: '/admin', icon: '⚙️' },
    ],
  },
};

export default function AdminLayout({
  children,
  portal = 'admin',
  userName = 'Pengguna',
}: {
  children: React.ReactNode;
  portal?: PortalKind;
  userName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const config = portalConfig[portal];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Close sidebar on route change on mobile
  useEffect(() => {
    const timer = window.setTimeout(() => setSidebarOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const getBreadcrumb = () => {
    const current = config.navItems.find((item) =>
      (item.path === '/admin' || item.path === '/super-admin') ? pathname === item.path : pathname.startsWith(item.path),
    );
    return current?.name ?? config.title;
  };

  return (
    <div className={styles.adminLayout}>
      <div className={`${styles.overlay} ${sidebarOpen ? styles.overlayOpen : ''}`} onClick={() => setSidebarOpen(false)} />
      
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logoArea}>
          <h1 className={styles.logoText}>{config.title}</h1>
        </div>
        
        <nav className={styles.nav}>
          {config.navItems.map((item) => {
            const isActive = (item.path === '/admin' || item.path === '/super-admin')
              ? pathname === item.path
              : pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className={styles.userInfo}>
          <div className={styles.userDetails}>
            <p className={styles.userName}>{userName}</p>
            <span className={styles.userRole}>{config.roleLabel}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className={styles.menuToggle} onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <div className={styles.breadcrumb}>{getBreadcrumb()}</div>
          </div>
          <div className={styles.topBarUser}>{userName}</div>
        </header>
        
        <div className={styles.contentArea}>
          {children}
        </div>
      </main>
    </div>
  );
}
