'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import { companyInfo } from '@/lib/mock-data';

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('');
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) {
        setStatus(result.error ?? 'Pesan belum dapat dikirim.');
        return;
      }
      setFormData({ name: '', email: '', subject: '', message: '' });
      setStatus(result.message ?? 'Pesan Anda berhasil dikirim.');
    } catch {
      setStatus('Koneksi ke server terputus. Coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.main}>
      {/* 1. Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            Hubungi<br/>
            Wina Jaya
          </h1>
        </div>
      </section>

      {/* 2. Content Layout */}
      <section className={styles.contentSection}>
        <div className={styles.layout}>
          {/* Info Column (Left) */}
          <div className={styles.infoCol}>
            <div className={styles.infoIntro}>
              <h2 className={styles.infoHeading}>Mari Diskusi</h2>
              <p className={styles.infoDesc}>Tim sales dan engineer tekstil kami siap membantu dari tahap ideasi material hingga eksekusi produksi massal.</p>
            </div>

            <div className={styles.infoBlock}>
              <h3 className={styles.infoTitle}>Informasi Kontak</h3>
              <ul className={styles.infoList}>
                <li>
                  <span className={styles.infoIcon}>E</span>
                  <span>sales@winajaya.co.id</span>
                </li>
                <li>
                  <span className={styles.infoIcon}>W</span>
                  <span>{companyInfo.whatsapp}</span>
                </li>
                <li>
                  <span className={styles.infoIcon}>T</span>
                  <span>{companyInfo.phone}</span>
                </li>
              </ul>
            </div>

            <div className={styles.infoBlock}>
              <h3 className={styles.infoTitle}>Alamat Pabrik &amp; Lab</h3>
              <p className={styles.addressText}>{companyInfo.address}</p>
            </div>

            <div className={styles.infoBlock}>
              <h3 className={styles.infoTitle}>Jam Operasional</h3>
              <ul className={styles.timeList}>
                <li>
                  <span className={styles.timeLabel}>Senin - Jumat</span>
                  <span className={styles.timeValue}>08:00 - 17:00 WIB</span>
                </li>
                <li>
                  <span className={styles.timeLabel}>Sabtu</span>
                  <span className={styles.timeValue}>08:00 - 12:00 WIB</span>
                </li>
                <li className={styles.timeClosed}>
                  <span className={styles.timeLabel}>Minggu &amp; Libur</span>
                  <span className={styles.timeValue}>Tutup</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Form Column (Right) */}
          <div className={styles.formCol}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <h3 className={styles.formSectionTitle}>Kirim Pesan</h3>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="nama">Nama Lengkap *</label>
                  <input type="text" id="nama" className={styles.input} value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} required />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="email">Email *</label>
                  <input type="email" id="email" className={styles.input} value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} required />
                </div>
                
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label htmlFor="subjek">Subjek / Topik Utama *</label>
                  <input type="text" id="subjek" className={styles.input} value={formData.subject} onChange={(event) => setFormData((current) => ({ ...current, subject: event.target.value }))} required />
                </div>
                
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label htmlFor="pesan">Pesan Anda *</label>
                  <textarea id="pesan" rows={5} className={styles.textarea} value={formData.message} onChange={(event) => setFormData((current) => ({ ...current, message: event.target.value }))} required />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
                  {isSubmitting ? 'Mengirim...' : 'Kirim Pesan'}
                </button>
                {status && <p className={styles.formStatus} role="status">{status}</p>}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 3. Map Break */}
      <section className={styles.mapSection}>
        <div className={styles.mapPlaceholder}>
          <p className={styles.mapText}>COORDINATES: -6.9175° S, 107.6191° E — BANDUNG, INDONESIA</p>
        </div>
      </section>
    </div>
  );
}
