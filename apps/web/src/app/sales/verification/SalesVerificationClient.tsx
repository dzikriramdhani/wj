'use client';

import { useState } from 'react';
import styles from './page.module.css';

type VerificationRequest = {
  organizationId: string;
  name: string;
  legalName: string;
  industry: string;
  website: string;
  submittedAt: string;
};

export default function SalesVerificationClient({ requests: initialRequests }: { requests: VerificationRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const review = async (request: VerificationRequest, decision: 'verified' | 'rejected') => {
    setBusyId(request.organizationId);
    setMessage('');
    try {
      const response = await fetch('/api/business/verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: request.organizationId, decision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Verifikasi belum dapat diperbarui.');
      setRequests((current) => current.filter((item) => item.organizationId !== request.organizationId));
      setMessage(`${request.name} ${decision === 'verified' ? 'telah diverifikasi' : 'ditolak'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verifikasi belum dapat diperbarui.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>B2B SALES</p>
          <h1>Verifikasi perusahaan</h1>
          <p>Tinjau dokumen dan data perusahaan sebelum harga B2B atau quotation dapat digunakan.</p>
        </div>
        <span>{requests.length} menunggu</span>
      </header>
      {message && <p className={styles.message} role="status">{message}</p>}
      {requests.length === 0 ? (
        <div className={styles.empty}>Tidak ada permohonan verifikasi yang menunggu.</div>
      ) : (
        <div className={styles.list}>
          {requests.map((request) => (
            <article className={styles.request} key={request.organizationId}>
              <div>
                <h2>{request.name}</h2>
                <p>{request.legalName || 'Nama legal belum diisi'}</p>
                <dl>
                  <div><dt>Industri</dt><dd>{request.industry || '-'}</dd></div>
                  <div><dt>Website</dt><dd>{request.website || '-'}</dd></div>
                  <div><dt>Diajukan</dt><dd>{new Date(request.submittedAt).toLocaleDateString('id-ID')}</dd></div>
                </dl>
              </div>
              <div className={styles.actions}>
                <button type="button" disabled={busyId === request.organizationId} onClick={() => review(request, 'verified')}>Verifikasi</button>
                <button type="button" className={styles.reject} disabled={busyId === request.organizationId} onClick={() => review(request, 'rejected')}>Tolak</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
