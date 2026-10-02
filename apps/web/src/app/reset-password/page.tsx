'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from '../login/page.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) return setMessage('Password minimal 8 karakter.');
    if (password !== confirmation) return setMessage('Konfirmasi password tidak sama.');
    setIsSubmitting(true);
    setMessage('');
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) return setMessage('Tautan pemulihan tidak valid atau telah kedaluwarsa. Minta tautan baru.');
      setMessage('Password berhasil diperbarui. Anda akan diarahkan ke akun.');
      router.replace('/account');
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
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>{isSubmitting ? 'Menyimpan…' : 'Simpan password'}</button>
          </form>
        </div></div>
      </div>
    </div>
  );
}
