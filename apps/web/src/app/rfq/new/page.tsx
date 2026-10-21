'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

const fallbackFabricCategories = [
  'Katun (Combed, Carded, dll)',
  'Polyester',
  'Rayon',
  'Denim',
  'Spandex / Jersey',
];

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
  const [fabricCategories, setFabricCategories] = useState<string[]>(fallbackFabricCategories);
  const requestRef = useRef<{ body: string; key: string } | null>(null);
  const selectedFabricCategory = formData.jenisKain === 'lainnya'
    ? 'Lainnya / Custom'
    : formData.jenisKain;
  const minimumTargetDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const previewRows = [
    ['Nama lengkap', formData.nama],
    ['Perusahaan / brand', formData.perusahaan],
    ['Email', formData.email],
    ['Nomor WhatsApp', formData.telepon],
    ['Kategori kain', selectedFabricCategory],
    ['Estimasi volume', formData.jumlah],
    ['Target tanggal selesai', formData.deadline ? new Date(`${formData.deadline}T12:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }) : ''],
    ['Warna / Pantone', formData.warna],
    ['Gramasi', formData.gramasi ? `${formData.gramasi} GSM` : ''],
    ['Catatan tambahan', formData.catatan],
    ['Lampiran', attachments.map((file) => file.name).join(', ')],
  ] as const;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/products?limit=1', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Kategori katalog belum dapat dimuat.');
        return response.json();
      })
      .then((result) => {
        const categories = (result.categories ?? []).map((category: { name: string }) => category.name).filter(Boolean);
        if (categories.length) setFabricCategories(categories);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

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
      deadline: formData.deadline ? new Date(`${formData.deadline}T23:59:59+07:00`).toISOString() : undefined,
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

  if (!organizationIdParam) {
    return (
      <div className={styles.main}>
        <div className={styles.heroSection}>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>Permintaan B2B</h1>
            <p className={styles.introText}>RFQ hanya tersedia untuk anggota perusahaan yang sudah terverifikasi.</p>
          </div>
        </div>
        <div className={styles.successWrapper}>
          <h2 className={styles.successHeading}>Pilih perusahaan terverifikasi</h2>
          <p className={styles.successDesc}>Buka Portal Bisnis untuk membuat perusahaan dan mengirim dokumen verifikasi. Setelah status perusahaan terverifikasi, ajukan RFQ dari perusahaan tersebut.</p>
          <Link href="/business" className={styles.btnPrimary}>Buka Portal Bisnis</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.main}>
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            Custom Dyeing<br/>
            &amp; Sourcing
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
                      {fabricCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                      <option value="lainnya">Lainnya / Custom</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="jumlah">Estimasi Volume (Meter/Yard/Kg) *</label>
                    <input type="text" id="jumlah" name="jumlah" required value={formData.jumlah} onChange={handleChange} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="deadline">Target Tanggal Selesai (Opsional)</label>
                    <input type="date" id="deadline" name="deadline" min={minimumTargetDate} value={formData.deadline} onChange={handleChange} className={styles.input} />
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
            <section className={styles.previewCard} aria-live="polite" aria-label="Pratinjau permintaan RFQ">
              <h3 className={styles.previewTitle}>Pratinjau Permintaan</h3>
              <p className={styles.previewDescription}>Ringkasan ini diperbarui mengikuti isian formulir Anda.</p>
              <dl className={styles.previewList}>
                {previewRows.map(([label, value]) => (
                  <div className={styles.previewRow} key={label}>
                    <dt className={styles.previewLabel}>{label}</dt>
                    <dd className={styles.previewValue}>{value.trim() || 'Belum diisi'}</dd>
                  </div>
                ))}
              </dl>
            </section>
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
