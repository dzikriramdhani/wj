'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import styles from './page.module.css';

const contactEmail = 'adminwinajaya@gmail.com';
const contactWhatsapp = '+62 838 5076 2579';
const contactWhatsappNumber = '6283850762579';
const factoryAddress = 'Kp. Elos, Jl. Raya Cicalengka - Majalaya, RT.04/RW.01, Cijagra, Kec. Paseh, Kabupaten Bandung, Jawa Barat 40383';
const mapLocation = 'XQ9M+35 Cijagra, Kabupaten Bandung, Jawa Barat';

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
                  <span className={styles.infoIcon} aria-hidden="true">
                    <Image src="https://cdn.simpleicons.org/gmail/111111" alt="" width={18} height={18} unoptimized />
                  </span>
                  <a className={styles.contactLink} href={`mailto:${contactEmail}`}>{contactEmail}</a>
                </li>
                <li>
                  <span className={styles.infoIcon} aria-hidden="true">
                    <Image src="https://cdn.simpleicons.org/whatsapp/111111" alt="" width={18} height={18} unoptimized />
                  </span>
                  <a className={styles.contactLink} href={`https://wa.me/${contactWhatsappNumber}`} target="_blank" rel="noreferrer">{contactWhatsapp}</a>
                </li>
              </ul>
            </div>

            <div className={styles.infoBlock}>
              <h3 className={styles.infoTitle}>Alamat Pabrik &amp; Lab</h3>
              <p className={styles.addressText}>{factoryAddress}</p>
            </div>

            <div className={styles.infoBlock}>
              <h3 className={styles.infoTitle}>Jam Operasional</h3>
              <ul className={styles.timeList}>
                <li>
                  <span className={styles.timeLabel}>Senin–Jumat</span>
                  <span className={styles.timeValue}>07.00–16.30</span>
                </li>
                <li>
                  <span className={styles.timeLabel}>Sabtu</span>
                  <span className={styles.timeValue}>07.00–15.30</span>
                </li>
                <li className={styles.timeClosed}>
                  <span className={styles.timeLabel}>Minggu</span>
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
          <iframe
            className={styles.mapFrame}
            title="Peta lokasi pabrik Wina Jaya"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapLocation)}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <p className={styles.mapText}>{mapLocation}</p>
        </div>
      </section>
    </div>
  );
}
