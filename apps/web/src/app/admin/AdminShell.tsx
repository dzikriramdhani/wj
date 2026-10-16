'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Box,
  ChevronRight,
  ClipboardList,
  Images,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import styles from './layout.module.css';

type PortalKind = 'admin' | 'super-admin';
type NavItem = { name: string; path: string; icon: React.ElementType };
type NavGroup = { label: string; items: NavItem[] };

const portalConfig: Record<PortalKind, {
  title: string;
  roleLabel: string;
  groups: NavGroup[];
}> = {
  admin: {
    title: 'Admin',
    roleLabel: 'Administrator platform',
    groups: [
      { label: 'Workspace', items: [{ name: 'Dashboard', path: '/admin', icon: LayoutDashboard }] },
      { label: 'Commerce', items: [
        { name: 'Produk & katalog', path: '/admin/products', icon: Box },
        { name: 'Lookbook', path: '/admin/lookbook', icon: Images },
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
    title: 'Super Admin',
    roleLabel: 'Super Admin · MFA',
    groups: [
      { label: 'Platform', items: [{ name: 'Pengguna & role', path: '/super-admin', icon: LockKeyhole }] },
      { label: 'Workspace', items: [{ name: 'Operasi Admin', path: '/admin', icon: Settings2 }] },
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
  const navItems = config.groups.flatMap((group) => group.items);
  const currentPage = navItems.find((item) => item.path === pathname)
    ?? navItems.find((item) => item.path !== '/admin' && item.path !== '/super-admin' && pathname.startsWith(item.path));
  const initials = userName.trim().slice(0, 2).toUpperCase() || 'WJ';

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
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <Link href={portal === 'super-admin' ? '/super-admin' : '/admin'} className={styles.brand} aria-label="Wina Jaya admin">
          <span className={styles.brandMark}>WJ</span>
          <span className={styles.brandText}><strong>WINA JAYA</strong><small>Admin workspace</small></span>
        </Link>

        <nav className={styles.nav} aria-label="Navigasi admin">
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
                    className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setSidebarOpen(false)}
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
            <span className={styles.avatar}>{initials}</span>
            <span className={styles.userDetails}><strong>{userName}</strong><small>{config.roleLabel}</small></span>
          </div>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout} aria-label="Keluar">
            <LogOut size={16} aria-hidden="true" /><span>Keluar</span>
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button className={styles.menuToggle} type="button" onClick={() => setSidebarOpen(true)} aria-label="Buka menu">
              <Menu size={19} />
            </button>
            <div className={styles.breadcrumb}>
              <span>{config.title}</span><ChevronRight size={13} aria-hidden="true" /><strong>{currentPage?.name ?? config.title}</strong>
            </div>
          </div>
          <div className={styles.topBarMeta}>WINA JAYA</div>
        </header>
        <div className={styles.contentArea}>{children}</div>
      </main>
    </div>
  );
}
