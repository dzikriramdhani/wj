'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { formatDate, getRFQStatusInfo } from '@/lib/routing-logic';
import type { RFQStatus } from '@/types';
import MfaSetup from './MfaSetup';

type AccountTab = 'overview' | 'profil' | 'orders' | 'rfq' | 'notifikasi';

export default function AccountPage({
  user,
  rfqs,
  orders,
  notifications,
  workspaceLinks,
  mfaRequired,
  mfaContinueTo,
  mfaRequirement,
  initialTab,
}: {
  user: { name: string; email: string; phone: string; company: string; memberSince: string };
  rfqs: Array<{ id: string; status: RFQStatus; createdAt: string; qtyRequested: number; productName: string }>;
  orders: Array<{ id: string; orderNumber: string; orderStatus: string; paymentStatus: string; totalAmount: number; createdAt: string }>;
  notifications: Array<{ id: string; title: string; body: string; linkPath: string | null; readAt: string | null; createdAt: string }>;
  workspaceLinks: Array<{ href: string; label: string }>;
  mfaRequired: boolean;
  mfaContinueTo: string;
  mfaRequirement: 'Admin' | 'Super Admin';
  initialTab: AccountTab;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(user);
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ fullName: user.name, phone: user.phone === '-' ? '' : user.phone });
  const [profileStatus, setProfileStatus] = useState('');
  const firstName = profile.name.trim().split(/\s+/)[0] || 'Pelanggan';
  const profileCompletion = Math.round(
    [profile.name, profile.email, profile.phone, profile.company].filter((value) => value && value !== '-').length / 4 * 100,
  );

  const changeTab = (tab: AccountTab) => {
    setActiveTab(tab);
    router.replace(tab === 'overview' ? '/account' : `/account?tab=${tab}`, { scroll: false });
  };

  const handleLogout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) {
      router.push('/login');
      router.refresh();
    } else {
      alert('Tidak dapat keluar dari akun. Silakan coba kembali.');
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileStatus('');
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileDraft),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setProfileStatus(result.error ?? 'Profil belum dapat diperbarui.');
      setProfile((current) => ({ ...current, name: profileDraft.fullName, phone: profileDraft.phone || '-' }));
      setEditingProfile(false);
    } catch {
      setProfileStatus('Koneksi ke server terputus. Coba kembali.');
    }
  };

  const navigation: Array<{ id: AccountTab; label: string }> = [
    { id: 'overview', label: 'Ringkasan' },
    { id: 'profil', label: 'Profil' },
    { id: 'orders', label: 'Pesanan' },
    { id: 'rfq', label: 'Riwayat RFQ' },
    { id: 'notifikasi', label: 'Notifikasi' },
  ];

  const renderOrder = (order: (typeof orders)[number], compact = false) => {
    const status = order.paymentStatus.toLowerCase();
    const paymentLabel = ['paid', 'capture', 'settlement', 'pending', 'expire', 'expired'].includes(status)
      ? null
      : status === 'cancel' || status === 'cancelled'
        ? 'Dibatalkan'
        : status === 'deny' || status === 'failure'
          ? 'Gagal'
          : status === 'refund' || status === 'partial_refund'
            ? 'Dikembalikan'
            : null;

    return (
      <Link className={styles.orderCard} href={`/payments/${encodeURIComponent(order.id)}`} key={order.id}>
        <div className={styles.orderInfoGrid}>
          <span className={styles.orderFieldLabel}>Tanggal pesanan</span>
          <span className={styles.orderFieldLabel}>Nomor pesanan</span>
          <span className={styles.orderFieldLabel}>Total pembayaran</span>
          <span>{formatDate(order.createdAt)}</span>
          <span>{order.orderNumber}</span>
          <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.totalAmount)}</span>
        </div>
        <span className={styles.orderCardEnd}>
          {paymentLabel && <span className={styles.rfqStatus}>{paymentLabel}</span>}
          <span className={styles.chevron} aria-hidden="true">›</span>
          {compact && <span className={styles.srOnly}>Buka pesanan {order.orderNumber}</span>}
        </span>
      </Link>
    );
  };

  return (
    <div className={styles.main}>
      <div className={styles.accountShell}>
        <aside className={styles.sidebar} aria-label="Navigasi akun">
          <h1 className={styles.sidebarTitle}>Akun</h1>
          <nav className={styles.navList}>
            {navigation.map((item) => (
              <button
                className={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : ''}`}
                key={item.id}
                type="button"
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => changeTab(item.id)}
              >
                <span>{item.label}</span>
                {item.id === 'notifikasi' && notifications.some((notification) => !notification.readAt) && (
                  <span className={styles.notificationCount}>{notifications.filter((notification) => !notification.readAt).length}</span>
                )}
              </button>
            ))}
            <button className={`${styles.navItem} ${styles.logoutNav}`} type="button" onClick={handleLogout}>
              Keluar
            </button>
          </nav>
        </aside>

        <section className={styles.content}>
          {activeTab === 'overview' && (
            <div className={styles.tabContent}>
              <header className={styles.overviewHeader}>
                <h2>Halo, {firstName}</h2>
                <p>Masuk sebagai: <strong>{profile.email}</strong></p>
              </header>

              <div className={styles.overviewBody}>
                <div className={styles.overviewStats}>
                  <div className={styles.overviewStat}>
                    <h3>Profil</h3>
                    <div className={styles.statLine}>
                      <strong>{profileCompletion}%</strong>
                      <span>Lengkap</span>
                    </div>
                  </div>
                  <div className={styles.overviewStat}>
                    <h3>Pesanan</h3>
                    <div className={styles.statLine}>
                      <strong>{orders.length}</strong>
                      <span>Tersimpan</span>
                    </div>
                  </div>
                </div>

                <section className={styles.recentOrders} aria-labelledby="recent-orders-title">
                  <h3 id="recent-orders-title">Pesanan terbaru</h3>
                  {orders.length ? (
                    <ul className={styles.orderList}>
                      {orders.slice(0, 5).map((order) => <li key={order.id}>{renderOrder(order, true)}</li>)}
                    </ul>
                  ) : (
                    <div className={styles.emptyState}>
                      <p>Belum ada pesanan.</p>
                      <Link href="/products" className={styles.outlineButton}>Lihat katalog</Link>
                    </div>
                  )}
                </section>

                <section className={styles.quickLinks} aria-labelledby="quick-links-title">
                  <h3 id="quick-links-title">Tautan akun</h3>
                  <div className={styles.quickLinkList}>
                    {workspaceLinks.map((workspace) => <Link href={workspace.href} key={workspace.href}>{workspace.label}<span aria-hidden="true">›</span></Link>)}
                    <Link href="/rfq/new">Buat RFQ baru<span aria-hidden="true">›</span></Link>
                    <Link href="/products">Lihat katalog<span aria-hidden="true">›</span></Link>
                    <Link href="/business">Portal perusahaan<span aria-hidden="true">›</span></Link>
                  </div>
                </section>
                {mfaRequired && <MfaSetup continueTo={mfaContinueTo} requirement={mfaRequirement} />}
              </div>
            </div>
          )}

          {activeTab === 'profil' && (
            <div className={styles.tabContent}>
              <header className={styles.pageHeader}>
                <h2>Profil</h2>
                <p>Lihat dan perbarui informasi akun Anda.</p>
              </header>
              <div className={styles.profileSections}>
                <section className={styles.profileSection}>
                  <div className={styles.profileSectionHead}><div><h3>Informasi akun</h3><p>Nama dan alamat email akun Anda.</p></div>
                    <button className={styles.outlineButton} type="button" onClick={() => { setProfileDraft({ fullName: profile.name, phone: profile.phone === '-' ? '' : profile.phone }); setProfileStatus(''); setEditingProfile((value) => !value); }}>{editingProfile ? 'Batal' : 'Edit'}</button>
                  </div>
                  {editingProfile ? (
                    <form className={styles.profileForm} onSubmit={saveProfile}>
                      <label>Nama lengkap<input value={profileDraft.fullName} onChange={(event) => setProfileDraft((current) => ({ ...current, fullName: event.target.value }))} required /></label>
                      <label>Email<input value={profile.email} readOnly /></label>
                      <label>No. WhatsApp<input value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
                      {profileStatus && <p role="status" className={styles.formStatus}>{profileStatus}</p>}
                      <button type="submit" className={styles.outlineButton}>Simpan perubahan</button>
                    </form>
                  ) : (
                    <dl className={styles.profileDetails}>
                      <div><dt>Nama lengkap</dt><dd>{profile.name}</dd></div>
                      <div><dt>Email</dt><dd>{profile.email}</dd></div>
                      <div><dt>No. WhatsApp</dt><dd>{profile.phone}</dd></div>
                      <div><dt>Perusahaan</dt><dd>{profile.company}</dd></div>
                      <div><dt>Bergabung sejak</dt><dd>{formatDate(profile.memberSince)}</dd></div>
                    </dl>
                  )}
                </section>
                {mfaRequired && <MfaSetup continueTo={mfaContinueTo} requirement={mfaRequirement} />}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className={styles.tabContent}>
              <header className={styles.pageHeader}>
                <h2>Pesanan</h2>
                <p>Lihat riwayat pesanan dan status pembayarannya.</p>
              </header>
              {orders.length ? <ul className={`${styles.orderList} ${styles.fullOrderList}`}>{orders.map((order) => <li key={order.id}>{renderOrder(order)}</li>)}</ul> : (
                <div className={styles.emptyState}><h3>Belum ada pesanan</h3><p>Pesanan Anda akan muncul di sini setelah checkout.</p><Link href="/products" className={styles.outlineButton}>Lanjut belanja</Link></div>
              )}
            </div>
          )}

          {activeTab === 'rfq' && (
            <div className={styles.tabContent}>
              <header className={styles.pageHeader}>
                <h2>Riwayat RFQ</h2>
                <p>Lihat status permintaan produk khusus Anda.</p>
                <Link href="/rfq/new" className={styles.outlineButton}>Buat RFQ baru</Link>
              </header>
              {rfqs.length ? <ul className={styles.recordList}>{rfqs.map((rfq) => {
                const statusInfo = getRFQStatusInfo(rfq.status);
                return <li className={styles.rfqRecord} key={rfq.id}>
                  <div><span className={styles.recordEyebrow}>{rfq.id.toUpperCase()}</span><h3>{rfq.productName}</h3><p>{rfq.qtyRequested.toLocaleString('id-ID')} meter · {formatDate(rfq.createdAt)}</p></div>
                  <div className={styles.recordActions}><span className={styles.rfqStatus}>{statusInfo.label}</span><button className={styles.outlineButton} type="button">Detail</button></div>
                </li>;
              })}</ul> : <div className={styles.emptyState}><h3>Belum ada permintaan RFQ</h3><p>Ajukan permintaan untuk kebutuhan kain khusus Anda.</p><Link href="/rfq/new" className={styles.outlineButton}>Ajukan RFQ</Link></div>}
            </div>
          )}

          {activeTab === 'notifikasi' && (
            <div className={styles.tabContent}>
              <header className={styles.pageHeader}><h2>Notifikasi</h2><p>Pembaruan terbaru mengenai akun Anda.</p></header>
              {notifications.length ? <ul className={styles.recordList}>{notifications.map((notification) => (
                <li key={notification.id}><Link href={notification.linkPath ?? '/account'} className={styles.notificationItem}>
                  <span><strong>{notification.title}</strong><small>{notification.body}</small></span>
                  <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                </Link></li>
              ))}</ul> : <div className={styles.emptyState}><h3>Belum ada notifikasi</h3><p>Notifikasi akun Anda akan ditampilkan di sini.</p></div>}
            </div>
          )}
        </section>
      </div>

      <footer className={styles.supportFooter}>
        <div><h2>Butuh bantuan?</h2><p>Tim Wina Jaya siap membantu pertanyaan tentang akun dan pesanan Anda.</p></div>
        <Link href="/contact">Hubungi kami<span aria-hidden="true">↗</span></Link>
      </footer>
    </div>
  );
}
