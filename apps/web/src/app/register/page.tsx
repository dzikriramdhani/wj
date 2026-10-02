'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');

  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    telepon: '',
    password: '',
    konfirmasiPassword: '',
  });
  const [agree, setAgree] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.konfirmasiPassword) {
      alert('Password dan konfirmasi tidak cocok!');
      return;
    }
    if (!agree) {
      alert('Anda harus menyetujui syarat & ketentuan.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.nama,
          email: formData.email,
          phone: formData.telepon,
          password: formData.password,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        alert(result.error ?? 'Pendaftaran gagal. Silakan coba kembali.');
        return;
      }

      alert(result.message ?? 'Pendaftaran berhasil. Silakan masuk.');
      router.push(`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`);
    } catch {
      alert('Tidak dapat terhubung ke layanan akun. Periksa koneksi Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.main}>
      <div className={styles.layout}>
        {/* Left: Branding */}
        <div className={styles.brandCol}>
          <div className={styles.brandContent}>
            <Link href="/" className={styles.logo}>Wina Jaya</Link>
            <h1 className={styles.brandTitle}>
              Mulai<br/>
              perjalanan<br/>
              Anda
            </h1>
            <p className={styles.brandDesc}>
              Bergabunglah dengan ratusan klien Wina Jaya dan dapatkan kemudahan mengelola pesanan kain tekstil premium.
            </p>
          </div>
        </div>

        {/* Right: Form */}
        <div className={styles.formCol}>
          <div className={styles.formWrapper}>
            <h2 className={styles.formTitle}>Buat Akun</h2>

            <form onSubmit={handleRegister} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="nama">Nama Lengkap *</label>
                <input type="text" id="nama" name="nama" className={styles.input} value={formData.nama} onChange={handleChange} required />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">Email *</label>
                <input type="email" id="email" name="email" className={styles.input} value={formData.email} onChange={handleChange} required />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="telepon">No. WhatsApp *</label>
                <input type="tel" id="telepon" name="telepon" className={styles.input} value={formData.telepon} onChange={handleChange} required />
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="password">Password *</label>
                  <input type="password" id="password" name="password" className={styles.input} value={formData.password} onChange={handleChange} required />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="konfirmasiPassword">Konfirmasi *</label>
                  <input type="password" id="konfirmasiPassword" name="konfirmasiPassword" className={styles.input} value={formData.konfirmasiPassword} onChange={handleChange} required />
                </div>
              </div>

              <div className={styles.checkboxRow}>
                <input type="checkbox" id="terms" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
                <label htmlFor="terms" className={styles.checkboxLabel}>
                  Saya setuju dengan <Link href="/legal/terms" className={styles.termsLink}>Syarat & Ketentuan</Link> serta <Link href="/legal/privacy" className={styles.termsLink}>Kebijakan Privasi</Link>.
                </label>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Memproses...' : 'Daftar Akun'}
              </button>
            </form>

            <p className={styles.switchText}>
              Sudah punya akun? <Link href={`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`} className={styles.switchLink}>Masuk di sini</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
