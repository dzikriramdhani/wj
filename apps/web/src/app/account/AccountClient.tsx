'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { formatDate, getRFQStatusInfo } from '@/lib/routing-logic';
import type { RFQStatus } from '@/types';
import MfaSetup from './MfaSetup';

export default function AccountPage({
  user,
  rfqs,
  notifications,
  workspaceLinks,
  mfaRequired,
  mfaContinueTo,
  mfaRequirement,
}: {
  user: { name: string; email: string; phone: string; company: string; memberSince: string };
  rfqs: Array<{ id: string; status: RFQStatus; createdAt: string; qtyRequested: number; productName: string }>;
  notifications: Array<{ id: string; title: string; body: string; linkPath: string | null; readAt: string | null; createdAt: string }>;
  workspaceLinks: Array<{ href: string; label: string }>;
  mfaRequired: boolean;
  mfaContinueTo: string;
  mfaRequirement: 'Admin' | 'Super Admin';
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(user);
  const [activeTab, setActiveTab] = useState<'profil' | 'rfq' | 'notifikasi'>('profil');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ fullName: user.name, phone: user.phone === '-' ? '' : user.phone });
  const [profileStatus, setProfileStatus] = useState('');

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
      const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileDraft) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setProfileStatus(result.error ?? 'Profil belum dapat diperbarui.');
      setProfile((current) => ({ ...current, name: profileDraft.fullName, phone: profileDraft.phone || '-' }));
      setEditingProfile(false);
    } catch {
      setProfileStatus('Koneksi ke server terputus. Coba kembali.');
    }
  };

  return (
    <div className={styles.main}>
      {/* Hero */}
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <div className={styles.breadcrumb}>
            <Link href="/">Beranda</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span>Akun</span>
          </div>
          <div className={styles.heroRow}>
            <h1 className={styles.heroTitle}>Akun Saya</h1>
            <button className={styles.logoutBtn} onClick={handleLogout}>Keluar</button>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className={styles.contentSection}>
        <div className={styles.layout}>
          {/* Sidebar: Profile */}
          <div className={styles.profileCol}>
            <div className={styles.avatar}>{profile.name.charAt(0)}</div>
            <h2 className={styles.userName}>{profile.name}</h2>
            <p className={styles.userEmail}>{profile.email}</p>

            <div className={styles.profileDetails}>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>Telepon</span>
                <span className={styles.profileValue}>{profile.phone}</span>
              </div>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>Perusahaan</span>
                <span className={styles.profileValue}>{profile.company}</span>
              </div>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>Bergabung</span>
                <span className={styles.profileValue}>{formatDate(profile.memberSince)}</span>
              </div>
            </div>

            <button className={styles.editBtn} onClick={() => { setProfileDraft({ fullName: profile.name, phone: profile.phone === '-' ? '' : profile.phone }); setProfileStatus(''); setEditingProfile((value) => !value); }}>Edit Profil</button>
            {editingProfile && <form className={styles.profileForm} onSubmit={saveProfile}>
              <label>Nama<input value={profileDraft.fullName} onChange={(event) => setProfileDraft((current) => ({ ...current, fullName: event.target.value }))} required /></label>
              <label>Telepon<input value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
              {profileStatus && <p role="status">{profileStatus}</p>}
              <button type="submit" className={styles.editBtn}>Simpan</button>
            </form>}
            {mfaRequired && <MfaSetup continueTo={mfaContinueTo} requirement={mfaRequirement} />}
          </div>

          {/* Main Content */}
          <div className={styles.mainCol}>
            {/* Tabs */}
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${activeTab === 'profil' ? styles.activeTab : ''}`} onClick={() => setActiveTab('profil')}>
                Overview
              </button>
              <button className={`${styles.tab} ${activeTab === 'rfq' ? styles.activeTab : ''}`} onClick={() => setActiveTab('rfq')}>
                Riwayat RFQ
              </button>
              <button className={`${styles.tab} ${activeTab === 'notifikasi' ? styles.activeTab : ''}`} onClick={() => setActiveTab('notifikasi')}>
                Notifikasi{notifications.some((notification) => !notification.readAt) ? ` (${notifications.filter((notification) => !notification.readAt).length})` : ''}
              </button>
            </div>

            {/* Tab: Overview */}
            {activeTab === 'profil' && (
              <div className={styles.tabContent}>
                <div className={styles.statsRow}>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{rfqs.length}</span>
                    <span className={styles.statLabel}>Total RFQ</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{rfqs.filter(r => r.status === 'SUBMITTED').length}</span>
                    <span className={styles.statLabel}>Pending</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{rfqs.filter(r => r.status === 'QUOTED').length}</span>
                    <span className={styles.statLabel}>Quoted</span>
                  </div>
                </div>

                <div className={styles.quickActions}>
                  <h3 className={styles.sectionTitle}>Aksi Cepat</h3>
                  <div className={styles.actionGrid}>
                    {workspaceLinks.map((workspace) => (
                      <Link href={workspace.href} className={styles.actionCard} key={workspace.href}>
                        <span className={styles.actionLabel}>{workspace.label}</span>
                        <span className={styles.actionArrow}>&rarr;</span>
                      </Link>
                    ))}
                    <Link href="/rfq/new" className={styles.actionCard}>
                      <span className={styles.actionLabel}>Buat RFQ Baru</span>
                      <span className={styles.actionArrow}>&rarr;</span>
                    </Link>
                    <Link href="/products" className={styles.actionCard}>
                      <span className={styles.actionLabel}>Lihat Katalog</span>
                      <span className={styles.actionArrow}>&rarr;</span>
                    </Link>
                    <Link href="/business" className={styles.actionCard}>
                      <span className={styles.actionLabel}>Portal Perusahaan</span>
                      <span className={styles.actionArrow}>&rarr;</span>
                    </Link>
                    <Link href="/privacy" className={styles.actionCard}>
                      <span className={styles.actionLabel}>Privasi Data</span>
                      <span className={styles.actionArrow}>&rarr;</span>
                    </Link>
                    <Link href="/contact" className={styles.actionCard}>
                      <span className={styles.actionLabel}>Hubungi Tim</span>
                      <span className={styles.actionArrow}>&rarr;</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: RFQ History */}
            {activeTab === 'rfq' && (
              <div className={styles.tabContent}>
                <div className={styles.rfqHeader}>
                  <h3 className={styles.sectionTitle}>Riwayat Penawaran</h3>
                  <Link href="/rfq/new" className={styles.newRfqBtn}>+ RFQ Baru</Link>
                </div>
                
                {rfqs.length > 0 ? (
                  <div className={styles.rfqList}>
                    {rfqs.map(rfq => {
                      const statusInfo = getRFQStatusInfo(rfq.status);
                      return (
                        <div key={rfq.id} className={styles.rfqItem}>
                          <div className={styles.rfqMain}>
                            <div className={styles.rfqId}>{rfq.id.toUpperCase()}</div>
                            <div className={styles.rfqProduct}>{rfq.productName}</div>
                            <div className={styles.rfqMeta}>
                              <span>{rfq.qtyRequested.toLocaleString('id-ID')} meter</span>
                              <span className={styles.rfqDot}>·</span>
                              <span>{formatDate(rfq.createdAt)}</span>
                            </div>
                          </div>
                          <div className={styles.rfqRight}>
                            <span className={styles.rfqStatus}>{statusInfo.label}</span>
                            <button className={styles.rfqDetailBtn}>Detail &rarr;</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <p>Belum ada riwayat penawaran.</p>
                    <Link href="/rfq/new" className={styles.newRfqBtn}>Ajukan Sekarang</Link>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notifikasi' && (
              <div className={styles.tabContent}>
                <h3 className={styles.sectionTitle}>Notifikasi</h3>
                {notifications.length ? <div className={styles.rfqList}>{notifications.map((notification) => (
                  <Link key={notification.id} href={notification.linkPath ?? '/account'} className={styles.actionCard}>
                    <span><strong>{notification.title}</strong><small className={styles.notificationBody}>{notification.body}</small></span>
                    <span className={styles.notificationTime}>{formatDate(notification.createdAt)}</span>
                  </Link>
                ))}</div> : <div className={styles.emptyState}><p>Belum ada notifikasi.</p></div>}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
