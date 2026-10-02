'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './MfaSetup.module.css';

type MfaSetupProps = {
  continueTo: string;
  requirement: 'Admin' | 'Super Admin';
};

export default function MfaSetup({ continueTo, requirement }: MfaSetupProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [hasVerifiedFactor, setHasVerifiedFactor] = useState(false);
  const [sessionIsAal2, setSessionIsAal2] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadStatus = async () => {
    const [{ data: factorData, error: factorError }, { data: assurance, error: assuranceError }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factorError || assuranceError) {
      setError('Status MFA belum dapat dimuat. Muat ulang halaman lalu coba kembali.');
      setReady(true);
      return;
    }
    const verifiedFactor = factorData?.totp[0] ?? null;
    const unfinishedFactor = factorData?.all.find((factor) => factor.factor_type === 'totp' && factor.status === 'unverified') ?? null;
    setFactorId(verifiedFactor?.id ?? unfinishedFactor?.id ?? null);
    setHasVerifiedFactor(Boolean(verifiedFactor));
    setSessionIsAal2(assurance?.currentLevel === 'aal2');
    setReady(true);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStatus(); }, 0);
    return () => window.clearTimeout(timer);
  // The browser Supabase client is memoized for the component lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEnrollment = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const unfinishedFactors = factors?.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified') ?? [];
      await Promise.all(unfinishedFactors.map(async (factor) => {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }));

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Wina Jaya Authenticator',
        issuer: 'Wina Jaya',
      });
      if (enrollError || !data || data.type !== 'totp') throw enrollError ?? new Error('Faktor MFA belum dapat dibuat.');
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setHasVerifiedFactor(false);
      setCode('');
      setNotice('Pindai QR code dengan aplikasi authenticator, lalu masukkan kode enam digitnya.');
    } catch {
      setError('MFA belum dapat diaktifkan. Pastikan MFA TOTP aktif pada pengaturan Supabase Auth, lalu coba kembali.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedCode = code.replace(/\D/g, '');
    if (!factorId || normalizedCode.length !== 6) {
      setError('Masukkan enam digit kode dari aplikasi authenticator.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: normalizedCode });
      if (verifyError) throw verifyError;
      setHasVerifiedFactor(true);
      setSessionIsAal2(true);
      setQrCode(null);
      setNotice('MFA aktif. Anda akan diteruskan ke portal.');
      router.replace(continueTo);
      router.refresh();
    } catch {
      setError('Kode tidak valid atau sudah kedaluwarsa. Buka kode terbaru di aplikasi authenticator lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return <section className={styles.card}><p>Memeriksa keamanan akun…</p></section>;
  }

  return (
    <section className={styles.card} aria-labelledby="mfa-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>KEAMANAN AKUN</p>
          <h3 id="mfa-title">Verifikasi dua langkah</h3>
        </div>
        <span className={sessionIsAal2 ? styles.active : styles.pending}>{sessionIsAal2 ? 'Aktif' : 'Diperlukan'}</span>
      </div>
      <p className={styles.description}>MFA diperlukan untuk akses {requirement}. Gunakan aplikasi authenticator seperti Google Authenticator, Microsoft Authenticator, atau 1Password.</p>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      {sessionIsAal2 ? (
        <button className={styles.primaryButton} type="button" onClick={() => { router.push(continueTo); router.refresh(); }}>
          Lanjut ke portal
        </button>
      ) : qrCode ? (
        <form className={styles.verifyForm} onSubmit={verifyCode}>
          {/* The QR code comes directly from the authenticated Supabase MFA enrollment response. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.qrCode} src={qrCode} alt="QR code untuk aplikasi authenticator" />
          <label htmlFor="mfa-code">Kode enam digit</label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            required
          />
          <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? 'Memverifikasi…' : 'Verifikasi & aktifkan MFA'}</button>
          <button className={styles.secondaryButton} type="button" onClick={() => void startEnrollment()} disabled={busy}>Buat QR code baru</button>
        </form>
      ) : hasVerifiedFactor && factorId ? (
        <form className={styles.verifyForm} onSubmit={verifyCode}>
          <label htmlFor="mfa-code">Kode dari aplikasi authenticator</label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            required
          />
          <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? 'Memverifikasi…' : 'Verifikasi & masuk'}</button>
        </form>
      ) : (
        <button className={styles.primaryButton} type="button" onClick={() => void startEnrollment()} disabled={busy}>
          {busy ? 'Menyiapkan MFA…' : 'Aktifkan MFA'}
        </button>
      )}
    </section>
  );
}
