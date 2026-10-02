'use client';

import { useMemo, useState } from 'react';
import styles from './page.module.css';

type PaymentRow = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  createdAt: string;
  paymentStatus: string;
  provider: string;
  providerOrderId: string | null;
  paidAt: string | null;
  paymentUrl: string | null;
};

const money = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);

function paymentLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Menunggu pembayaran',
    capture: 'Dibayar',
    settlement: 'Dibayar',
    deny: 'Ditolak',
    cancel: 'Dibatalkan',
    expire: 'Kedaluwarsa',
    refund: 'Dikembalikan',
  };
  return labels[status.toLowerCase()] ?? status.replaceAll('_', ' ');
}

export default function FinancePaymentsClient({ payments: initialPayments }: { payments: PaymentRow[] }) {
  const [payments] = useState(initialPayments);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const visiblePayments = useMemo(() => payments.filter((payment) => {
    if (filter === 'pending') return payment.paymentStatus === 'pending';
    if (filter === 'paid') return ['capture', 'settlement'].includes(payment.paymentStatus);
    return true;
  }), [filter, payments]);

  const reconcile = async (payment: PaymentRow) => {
    setBusyId(payment.id);
    setMessage('');
    try {
      const response = await fetch('/api/finance/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: payment.id }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Status pembayaran belum dapat diperiksa.');
      setMessage(`${payment.orderNumber} berhasil diperiksa ke Midtrans. Muat ulang halaman untuk melihat status terbaru.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Status pembayaran belum dapat diperiksa.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = payments.filter((payment) => payment.paymentStatus === 'pending').length;
  const paidTotal = payments
    .filter((payment) => ['capture', 'settlement'].includes(payment.paymentStatus))
    .reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>FINANCE WORKSPACE</p>
          <h1>Pembayaran</h1>
          <p>Periksa status Midtrans, nilai transaksi, dan invoice tanpa akses katalog atau pengiriman.</p>
        </div>
        <div className={styles.summary}>
          <span><strong>{pendingCount}</strong> menunggu</span>
          <span><strong>{money(paidTotal)}</strong> dibayar</span>
        </div>
      </header>

      {message && <p className={styles.message} role="status">{message}</p>}
      <div className={styles.filters} aria-label="Filter pembayaran">
        <button type="button" className={filter === 'all' ? styles.activeFilter : ''} onClick={() => setFilter('all')}>Semua</button>
        <button type="button" className={filter === 'pending' ? styles.activeFilter : ''} onClick={() => setFilter('pending')}>Menunggu</button>
        <button type="button" className={filter === 'paid' ? styles.activeFilter : ''} onClick={() => setFilter('paid')}>Dibayar</button>
      </div>

      {visiblePayments.length === 0 ? <div className={styles.empty}>Tidak ada pembayaran pada filter ini.</div> : (
        <div className={styles.list}>
          {visiblePayments.map((payment) => (
            <article className={styles.payment} key={payment.id}>
              <div className={styles.paymentHead}>
                <div>
                  <strong>{payment.orderNumber}</strong>
                  <span>{payment.customerName} · {payment.customerEmail}</span>
                </div>
                <div>
                  <strong>{money(payment.amount)}</strong>
                  <span>{new Date(payment.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
              <div className={styles.meta}>
                <span>Pembayaran: <b>{paymentLabel(payment.paymentStatus)}</b></span>
                <span>Order: {payment.orderStatus.replaceAll('_', ' ')}</span>
                <span>Provider: {payment.provider}</span>
                {payment.paidAt && <span>Dibayar: {new Date(payment.paidAt).toLocaleString('id-ID')}</span>}
              </div>
              <div className={styles.actions}>
                <button type="button" disabled={busyId === payment.id} onClick={() => void reconcile(payment)}>
                  {busyId === payment.id ? 'Memeriksa…' : 'Cek Midtrans'}
                </button>
                {payment.paymentStatus === 'pending' && payment.paymentUrl && <a href={payment.paymentUrl} target="_blank" rel="noreferrer">Buka halaman pembayaran</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
