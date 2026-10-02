'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

function RFQFormContent() {
  const searchParams = useSearchParams();
  const productIdParam = searchParams?.get('productId');
  const organizationIdParam = searchParams?.get('organizationId');
  
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    telepon: '',
    perusahaan: '',
    produkDiminati: '',
    jenisKain: '',
    jumlah: '',
    warna: '',
    motif: '',
    gramasi: '',
    deadline: '',
    catatan: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const requestRef = useRef<{ body: string; key: string } | null>(null);

  useEffect(() => {
    if (productIdParam) {
      const timer = window.setTimeout(() => setFormData(prev => ({ ...prev, produkDiminati: productIdParam })), 0);
      return () => window.clearTimeout(timer);
    }
  }, [productIdParam]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = Number(formData.jumlah.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('Masukkan jumlah pesanan yang valid.');
      return;
    }

    const body = {
      productId: formData.produkDiminati || undefined,
      organizationId: organizationIdParam || undefined,
      qtyRequested: quantity,
      specDetails: {
        nama: formData.nama,
        email: formData.email,
        telepon: formData.telepon,
        perusahaan: formData.perusahaan,
        jenisKain: formData.jenisKain,
        warna: formData.warna,
        motif: formData.motif,
        gramasiTarget: formData.gramasi ? Number(formData.gramasi) : undefined,
        catatan: formData.catatan,
      },
      attachments: [],
    };
    const bodyString = JSON.stringify(body);
    const requestKey = requestRef.current?.body === bodyString
      ? requestRef.current.key
      : crypto.randomUUID();
    requestRef.current = { body: bodyString, key: requestKey };

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/rfq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestKey,
        },
        body: bodyString,
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error ?? 'Permintaan belum dapat dikirim.');
        return;
      }
      if (attachments.length) {
        const upload = new FormData();
        attachments.forEach((file) => upload.append('files', file));
        const uploadResponse = await fetch(`/api/rfq/${encodeURIComponent(result.rfq.id)}/attachments`, { method: 'POST', body: upload });
        if (!uploadResponse.ok) {
          const uploadResult = await uploadResponse.json().catch(() => ({})) as { error?: string };
          alert(uploadResult.error ?? 'RFQ tersimpan, tetapi lampiran belum dapat diunggah.');
        }
      }
      setIsSuccess(true);
      window.scrollTo(0, 0);
    } catch {
      alert('Tidak dapat terhubung ke layanan RFQ. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={styles.main}>
        <div className={styles.heroSection}>
          <div className={styles.heroInner}>
             <h1 className={styles.heroTitle}>Berhasil<br/>Dikirim</h1>
             <p className={styles.introText}>Tim engineer kami akan segera mengontak Anda.</p>
          </div>
        </div>
        <div className={styles.successWrapper}>
           <div className={styles.successIcon}>✓</div>
           <h2 className={styles.successHeading}>Penawaran Diproses</h2>
           <p className={styles.successDesc}>
             Tim Wina Jaya akan me-review detail pesanan Anda dan memberikan estimasi harga terbaik. 
             Mohon tunggu balasan kami via Email atau WhatsApp dalam 1x24 jam.
           </p>
           <Link href="/" className={styles.btnPrimary}>Kembali ke Beranda</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.main}>
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            Custom<br/>
            Dyeing &amp;<br/>
            Sourcing
          </h1>
        </div>
      </section>

      <section className={styles.contentSection}>
        <div className={styles.layout}>
          {/* Main Form */}
          <div className={styles.formCol}>
            <div className={styles.formIntro}>
              <h2 className={styles.formHeading}>Formulir Permintaan (RFQ)</h2>
              <p className={styles.formDesc}>Isi detail teknis spesifikasi kain yang Anda butuhkan. Kosongkan bagian yang tidak relevan dengan pesanan Anda.</p>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Informasi Kontak</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="nama">Nama Lengkap *</label>
                    <input type="text" id="nama" name="nama" required value={formData.nama} onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="perusahaan">Nama Perusahaan / Brand *</label>
                    <input type="text" id="perusahaan" name="perusahaan" required value={formData.perusahaan} onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="email">Email *</label>
                    <input type="email" id="email" name="email" required value={formData.email} onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="telepon">Nomor WhatsApp *</label>
                    <input type="tel" id="telepon" name="telepon" required value={formData.telepon} onChange={handleChange} className={styles.input} />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Spesifikasi Teknis</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="jenisKain">Kategori Kain *</label>
                    <select id="jenisKain" name="jenisKain" required value={formData.jenisKain} onChange={handleChange} className={styles.input}>
                      <option value="">Pilih Kategori...</option>
                      <option value="katun">Katun (Combed, Carded, dll)</option>
                      <option value="polyester">Polyester</option>
                      <option value="rayon">Rayon</option>
                      <option value="denim">Denim</option>
                      <option value="spandex">Spandex / Jersey</option>
                      <option value="lainnya">Lainnya / Custom</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="jumlah">Estimasi Volume (Meter/Yard/Kg) *</label>
                    <input type="text" id="jumlah" name="jumlah" required value={formData.jumlah} onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="warna">Kode Warna / Pantone (Opsional)</label>
                    <input type="text" id="warna" name="warna" value={formData.warna} onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="gramasi">Gramasi (GSM) (Opsional)</label>
                    <input type="text" id="gramasi" name="gramasi" value={formData.gramasi} onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label htmlFor="catatan">Catatan / Detail Tambahan</label>
                    <textarea id="catatan" name="catatan" rows={4} value={formData.catatan} onChange={handleChange} className={styles.textarea}></textarea>
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label htmlFor="attachments">Lampiran tech-pack (PDF, JPG, PNG, atau WebP; maks. 20 MB per file)</label>
                    <input id="attachments" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className={styles.input} onChange={(event) => setAttachments(Array.from(event.target.files ?? []).slice(0, 5))} />
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
                  {isSubmitting ? 'Memproses...' : 'Kirim Tech-Pack'}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar */}
          <div className={styles.sidebarCol}>
            <div className={styles.sidebarBlock}>
              <h3 className={styles.sidebarTitle}>Kontak Langsung</h3>
              <ul className={styles.sidebarList}>
                <li><span className={styles.sidebarIcon}>E</span> sales@winajaya.co.id</li>
                <li><span className={styles.sidebarIcon}>W</span> +62 812 3456 7890</li>
                <li><span className={styles.sidebarIcon}>T</span> (022) 1234567</li>
              </ul>
            </div>

            <div className={styles.sidebarBlock}>
              <h3 className={styles.sidebarTitle}>Prosedur Produksi</h3>
              <div className={styles.processList}>
                <div className={styles.processItem}>
                  <div className={styles.processStep}>01</div>
                  <div className={styles.processInfo}>
                    <h4 className={styles.processTitle}>Konsultasi Spec</h4>
                    <p className={styles.processDesc}>Penentuan greige, gramasi, &amp; teknik dyeing.</p>
                  </div>
                </div>
                <div className={styles.processItem}>
                  <div className={styles.processStep}>02</div>
                  <div className={styles.processInfo}>
                    <h4 className={styles.processTitle}>Lab-dip &amp; Sample</h4>
                    <p className={styles.processDesc}>Pembuatan sampel warna dalam 72 jam.</p>
                  </div>
                </div>
                <div className={styles.processItem}>
                  <div className={styles.processStep}>03</div>
                  <div className={styles.processInfo}>
                    <h4 className={styles.processTitle}>Produksi Massal</h4>
                    <p className={styles.processDesc}>Proses tenun &amp; celup sesuai antrean mesin.</p>
                  </div>
                </div>
                <div className={styles.processItem}>
                  <div className={styles.processStep}>04</div>
                  <div className={styles.processInfo}>
                    <h4 className={styles.processTitle}>QC &amp; Pengiriman</h4>
                    <p className={styles.processDesc}>Inspeksi 4-point system sebelum dispatch.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function RFQPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh', padding: '200px 20px', textAlign: 'center'}}>Loading...</div>}>
      <RFQFormContent />
    </Suspense>
  );
}
