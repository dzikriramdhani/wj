'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

const contactEmail = 'adminwinajaya@gmail.com';
const contactWhatsapp = '+62 838 5076 2579';
const contactWhatsappNumber = '6283850762579';
const factoryAddress = 'Kp. Elos, Jl. Raya Cicalengka - Majalaya, RT.04/RW.01, Cijagra, Kec. Paseh, Kabupaten Bandung, Jawa Barat 40383';

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', subject: '', company: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('');
    try {
      const { company, ...messageData } = formData;
      const message = company.trim()
        ? `Perusahaan: ${company.trim()}\n\n${formData.message}`
        : formData.message;
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...messageData, message }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) {
        setStatus(result.error ?? 'Pesan belum dapat dikirim.');
        return;
      }
      setFormData({ name: '', subject: '', company: '', email: '', message: '' });
      setStatus(result.message ?? 'Pesan Anda berhasil dikirim.');
    } catch {
      setStatus('Koneksi ke server terputus. Coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.main}>
      <section className={styles.contactSection} aria-labelledby="contact-title">
        <div className={styles.contactLayout}>
          <div className={styles.lead}>
            <h1 id="contact-title" className={styles.heroTitle}>Mari berkolaborasi</h1>
            <a className={styles.emailLink} href={`mailto:${contactEmail}`}>{contactEmail}</a>
            <a className={`${styles.whatsappLink} ${styles.mobileWhatsapp}`} href={`https://wa.me/${contactWhatsappNumber}`} target="_blank" rel="noreferrer">
              {contactWhatsapp}
            </a>
          </div>

          <div className={styles.formCol}>
            <form onSubmit={handleSubmit}>
              <h2 className={styles.formSectionTitle}>Kirim pesan</h2>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="nama">Nama</label>
                  <input
                    type="text"
                    id="nama"
                    name="name"
                    className={styles.input}
                    placeholder="Nama lengkap"
                    autoComplete="name"
                    maxLength={120}
                    minLength={2}
                    value={formData.name}
                    onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="subjek">Subjek</label>
                  <select
                    id="subjek"
                    name="subject"
                    className={`${styles.input} ${styles.select}`}
                    value={formData.subject}
                    onChange={(event) => setFormData((current) => ({ ...current, subject: event.target.value }))}
                    required
                  >
                    <option value="" disabled>Pilih topik</option>
                    <option value="Katalog dan material">Katalog dan material</option>
                    <option value="Produksi dan custom dyeing">Produksi dan custom dyeing</option>
                    <option value="Kerja sama bisnis">Kerja sama bisnis</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="perusahaan">Perusahaan</label>
                  <input
                    type="text"
                    id="perusahaan"
                    name="company"
                    className={styles.input}
                    placeholder="Nama perusahaan (opsional)"
                    autoComplete="organization"
                    maxLength={200}
                    value={formData.company}
                    onChange={(event) => setFormData((current) => ({ ...current, company: event.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className={styles.input}
                    placeholder="Alamat email"
                    autoComplete="email"
                    maxLength={254}
                    value={formData.email}
                    onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label htmlFor="pesan">Pesan</label>
                  <textarea
                    id="pesan"
                    name="message"
                    rows={3}
                    maxLength={4700}
                    className={styles.textarea}
                    placeholder="Ceritakan kebutuhan Anda"
                    minLength={10}
                    value={formData.message}
                    onChange={(event) => setFormData((current) => ({ ...current, message: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
                  <span>{isSubmitting ? 'Mengirim...' : 'Kirim pesan'}</span>
                  <svg className={styles.submitArrow} viewBox="0 0 22 16" fill="none" aria-hidden="true">
                    <path d="M1 8h19m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.25" />
                  </svg>
                </button>
                {status && <p className={styles.formStatus} role="status">{status}</p>}
              </div>
            </form>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailsColumn}>
              <div className={`${styles.infoBlock} ${styles.desktopWhatsapp}`}>
                <span className={styles.infoTitle}>WhatsApp</span>
                <a className={styles.whatsappLink} href={`https://wa.me/${contactWhatsappNumber}`} target="_blank" rel="noreferrer">
                  {contactWhatsapp}
                </a>
              </div>
              <div className={styles.infoBlock}>
                <span className={styles.infoTitle}>Jam operasional</span>
                <p className={styles.hoursText}>Senin–Jumat · 07.00–16.30</p>
                <p className={styles.hoursText}>Sabtu 07.00–15.30 · Minggu tutup</p>
              </div>
            </div>

            <div className={`${styles.detailsColumn} ${styles.factoryColumn}`}>
              <div className={styles.infoBlock}>
                <span className={styles.infoTitle}>Pabrik &amp; lab</span>
                <p className={styles.addressText}>{factoryAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
