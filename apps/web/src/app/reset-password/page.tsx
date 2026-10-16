'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { validateResetPassword } from '@/lib/reset-password';
import styles from '../login/page.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [recoveryClient] = useState(createClient);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const establishRecoverySession = async () => {
      const { data: { session }, error } = await recoveryClient.auth.getSession();
      if (cancelled) return;
      if (error || !session) {
        setMessage('Tautan pemulihan tidak valid atau telah kedaluwarsa. Minta tautan baru.');
        return;
      }
      setIsRecoveryReady(true);
    };

    void establishRecoverySession().catch(() => {
      if (!cancelled) setMessage('Tautan pemulihan tidak dapat diverifikasi. Minta tautan baru.');
    });

    return () => {
      cancelled = true;
    };
  }, [recoveryClient]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const passwordError = validateResetPassword(password, confirmation);
    if (passwordError) return setMessage(passwordError);
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmation }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; code?: string };
      if (response.status === 403 && result.code === 'mfa_required') {
        setMfaRequired(true);
      }
      if (!response.ok) return setMessage(result.error ?? 'Password belum dapat diperbarui. Coba kembali.');

      await recoveryClient.auth.signOut({ scope: 'local' });
      setMessage('Password berhasil diperbarui. Silakan masuk menggunakan password baru.');
      router.replace('/login?reset=success');
      router.refresh();
    } catch {
      setMessage('Password belum dapat diperbarui. Coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyMfa = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = mfaCode.replace(/\D/g, '');
    if (code.length !== 6) return setMessage('Masukkan enam digit kode dari aplikasi authenticator.');

    setIsVerifyingMfa(true);
    setMessage('');
    try {
      const { data: factors, error: factorsError } = await recoveryClient.auth.mfa.listFactors();
      const factor = factors?.totp.find((item: { status: string }) => item.status === 'verified');
      if (factorsError || !factor) {
        return setMessage('Faktor MFA tidak ditemukan. Minta bantuan administrator untuk pemulihan akun.');
      }

      const { error } = await recoveryClient.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) return setMessage('Kode MFA tidak valid atau sudah kedaluwarsa. Gunakan kode terbaru lalu coba kembali.');

      setMfaCode('');
      setMfaRequired(false);
      setMessage('MFA berhasil diverifikasi. Simpan password baru untuk melanjutkan.');
    } catch {
      setMessage('MFA belum dapat diverifikasi. Coba kembali.');
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  return (
    <div className={styles.main}>
      <div className={styles.layout}>
        <div className={styles.brandCol}><div className={styles.brandContent}><Link href="/" className={styles.logo}>Wina Jaya</Link><h1 className={styles.brandTitle}>Password<br/>baru<br/>Anda</h1><p className={styles.brandDesc}>Gunakan password yang hanya Anda ketahui.</p></div></div>
        <div className={styles.formCol}><div className={styles.formWrapper}>
          <h2 className={styles.formTitle}>Atur Password Baru</h2>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.formGroup}><label htmlFor="password">Password baru</label><input id="password" type="password" className={styles.input} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <div className={styles.formGroup}><label htmlFor="confirmation">Konfirmasi password</label><input id="confirmation" type="password" className={styles.input} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></div>
            {message && <p role="status">{message}</p>}
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting || !isRecoveryReady}>{isSubmitting ? 'Menyimpan…' : isRecoveryReady ? 'Simpan password' : 'Memverifikasi tautan…'}</button>
          </form>
          {mfaRequired && <form className={styles.form} onSubmit={verifyMfa}>
            <div className={styles.formGroup}>
              <label htmlFor="mfa-code">Kode MFA</label>
              <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className={styles.input} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={isVerifyingMfa}>{isVerifyingMfa ? 'Memverifikasi…' : 'Verifikasi MFA'}</button>
          </form>}
        </div></div>
      </div>
    </div>
  );
}
