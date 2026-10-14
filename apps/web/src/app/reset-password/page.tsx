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
      const { data: { session }, error: sessionError } = await recoveryClient.auth.getSession();
      if (sessionError || !session) {
        return setMessage('Sesi pemulihan tidak ditemukan atau telah berakhir. Minta tautan reset baru, lalu buka tautan terbaru di browser yang sama.');
      }

      const { error } = await recoveryClient.auth.updateUser({ password });
      if (error) {
        const errorText = error.message.toLowerCase();
        const errorCode = 'code' in error && typeof error.code === 'string' ? error.code : '';

        if (errorCode === 'same_password' || errorText.includes('different from the old password')) {
          return setMessage('Password baru harus berbeda dari password yang sedang digunakan.');
        }
        if (errorCode === 'weak_password' || errorText.includes('weak password') || errorText.includes('password should be')) {
          return setMessage('Password belum memenuhi kebijakan keamanan. Gunakan password yang lebih kuat dan coba lagi.');
        }
        if (error.status === 401 || errorCode === 'bad_jwt' || errorCode === 'session_not_found') {
          return setMessage('Sesi pemulihan tidak valid atau telah berakhir. Minta tautan reset baru.');
        }

        console.error('Password update failed', { status: error.status, code: errorCode });
        return setMessage('Password belum dapat diperbarui. Periksa password baru dan coba lagi. Jika tetap gagal, kirimkan waktu percobaan agar log autentikasi dapat diperiksa.');
      }
      await recoveryClient.auth.signOut();
      setMessage('Password berhasil diperbarui. Silakan masuk menggunakan password baru.');
      router.replace('/login?reset=success');
      router.refresh();
    } catch {
      setMessage('Password belum dapat diperbarui. Coba kembali.');
    } finally {
      setIsSubmitting(false);
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
        </div></div>
      </div>
    </div>
  );
}
