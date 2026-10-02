'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        alert(result.error ?? 'Login gagal. Silakan coba kembali.');
        return;
      }

      router.push(redirectTo ?? result.data?.defaultPortal ?? '/account');
      router.refresh();
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
              Selamat<br/>
              datang<br/>
              kembali
            </h1>
            <p className={styles.brandDesc}>
              Masuk ke akun Anda untuk memantau status pesanan, riwayat penawaran, dan katalog eksklusif.
            </p>
          </div>
        </div>

        {/* Right: Form */}
        <div className={styles.formCol}>
          <div className={styles.formWrapper}>
            <h2 className={styles.formTitle}>Masuk</h2>
            
            <form onSubmit={handleLogin} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email *</label>
                <input 
                  type="email" 
                  id="email"
                  className={styles.input} 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              
              <div className={styles.formGroup}>
                <div className={styles.labelRow}>
                  <label htmlFor="password">Password *</label>
                  <Link href="/forgot-password" className={styles.forgotLink}>Lupa Password?</Link>
                </div>
                <div className={styles.passwordWrapper}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    id="password"
                    className={styles.input} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                  <button 
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Memproses...' : 'Masuk'}
              </button>
            </form>

            <div className={styles.divider}>
              <span>atau</span>
            </div>

            <p className={styles.switchText}>
              Belum punya akun? <Link href={`/register${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`} className={styles.switchLink}>Daftar Akun Baru</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
