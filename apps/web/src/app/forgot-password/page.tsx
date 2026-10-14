'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { buildConfiguredAppUrl } from '@/lib/app-url';
import styles from '../login/page.module.css';

export default function ForgotPasswordPage() {
  const [recoveryClient] = useState(createClient);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    try {
      const guardResponse = await fetch('/api/auth/password-reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const guardResult = await guardResponse.json().catch(() => ({})) as { error?: string };
      if (!guardResponse.ok) {
        setMessage(guardResult.error ?? 'Permintaan belum dapat diproses.');
        return;
      }

      const { error } = await recoveryClient.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: buildConfiguredAppUrl('/auth/callback'),
      });
      if (error) {
        console.error('Password reset request failed', {
          status: error.status,
          code: 'code' in error && typeof error.code === 'string' ? error.code : '',
        });
      }
      setMessage('Jika alamat email terdaftar, tautan pemulihan telah dikirim.');
    } catch {
      setMessage('Koneksi ke layanan akun terputus. Coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.main}>
      <div className={styles.layout}>
        <div className={styles.brandCol}><div className={styles.brandContent}><Link href="/" className={styles.logo}>Wina Jaya</Link><h1 className={styles.brandTitle}>Pulihkan<br/>akses<br/>akun</h1><p className={styles.brandDesc}>Kami akan mengirim tautan aman ke alamat email Anda.</p></div></div>
        <div className={styles.formCol}><div className={styles.formWrapper}>
          <h2 className={styles.formTitle}>Lupa Password</h2>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.formGroup}><label htmlFor="email">Email</label><input id="email" type="email" className={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            {message && <p role="status">{message}</p>}
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>{isSubmitting ? 'Mengirim…' : 'Kirim tautan pemulihan'}</button>
          </form>
          <p className={styles.switchText}><Link href="/login" className={styles.switchLink}>Kembali ke masuk</Link></p>
        </div></div>
      </div>
    </div>
  );
}
