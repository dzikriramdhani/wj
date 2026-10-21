'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Box,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  UsersRound,
  UserRound,
} from 'lucide-react';
import styles from './layout.module.css';

type PortalKind = 'admin' | 'super-admin';
type NavItem = { name: string; path: string; icon: React.ElementType };
type NavGroup = { label: string; items: NavItem[] };

const portalConfig: Record<PortalKind, {
  groups: NavGroup[];
}> = {
  admin: {
    groups: [
      { label: 'Workspace', items: [{ name: 'Dashboard', path: '/admin', icon: LayoutDashboard }] },
      { label: 'Commerce', items: [
        { name: 'Produk & katalog', path: '/admin/products', icon: Box },
        { name: 'Pesanan', path: '/admin/orders', icon: ClipboardList },
        { name: 'RFQ & B2B', path: '/admin/rfq', icon: UsersRound },
        { name: 'Customer', path: '/admin/customers', icon: UsersRound },
      ] },
      { label: 'Platform', items: [
        { name: 'Operasi', path: '/admin/operations', icon: Activity },
        { name: 'Governance', path: '/admin/governance', icon: ShieldCheck },
      ] },
    ],
  },
  'super-admin': {
    groups: [
      { label: 'Platform', items: [{ name: 'Pengguna & role', path: '/super-admin', icon: LockKeyhole }] },
      { label: 'Workspace', items: [{ name: 'Operasi Admin', path: '/admin', icon: Settings2 }] },
      { label: 'Konten', items: [{ name: 'Konten Beranda', path: '/super-admin/content/home', icon: FileText }] },
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
  const [sidebarOpenPath, setSidebarOpenPath] = useState<string | null>(null);
  const sidebarOpen = sidebarOpenPath === pathname;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const config = portalConfig[portal];
  const normalizedName = userName.trim().toLowerCase();
  const displayName = normalizedName ? `${normalizedName[0].toUpperCase()}${normalizedName.slice(1)}` : 'Pengguna';

  const toggleSidebar = () => {
    if (window.matchMedia('(max-width: 760px)').matches) {
      setSidebarOpenPath((current) => current === pathname ? null : pathname);
      return;
    }
    setSidebarCollapsed((current) => !current);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className={styles.adminLayout}>
      <button
        type="button"
        aria-label="Tutup menu"
        className={`${styles.overlay} ${sidebarOpen ? styles.overlayOpen : ''}`}
        onClick={() => setSidebarOpenPath(null)}
      />

      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <Link href={portal === 'super-admin' ? '/super-admin' : '/admin'} className={styles.brand} aria-label="Wina Jaya admin">
          <span className={styles.brandMark}>WJ</span>
          <span className={styles.brandText}>Wina Jaya</span>
        </Link>

        <nav className={styles.nav} aria-label="Navigasi admin" data-lenis-prevent>
          {config.groups.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.items.map((item) => {
                const isActive = item.path === '/admin' || item.path === '/super-admin'
                  ? pathname === item.path
                  : pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    title={item.name}
                    className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setSidebarOpenPath(null)}
                  >
                    <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                    <span>{item.name}</span>
                    {isActive && <span className={styles.activeMark} aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.profile}>
            <span className={styles.avatar}><UserRound size={16} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className={styles.userDetails}><strong>{displayName}</strong></span>
          </div>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout} aria-label="Keluar">
            <LogOut size={16} aria-hidden="true" /><span>Keluar</span>
          </button>
        </div>
      </aside>

      <main className={`${styles.mainContent} ${sidebarCollapsed ? styles.mainContentCollapsed : ''}`}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button className={styles.menuToggle} type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Perluas menu' : 'Ciutkan menu'} title={sidebarCollapsed ? 'Perluas menu' : 'Ciutkan menu'}>
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </header>
        <div className={styles.contentArea} data-lenis-prevent>{children}</div>
      </main>
    </div>
  );
}
