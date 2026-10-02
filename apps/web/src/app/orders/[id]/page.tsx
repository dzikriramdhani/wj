'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './page.module.css';

interface OrderDetails {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentUrl: string | null;
  trackingNumber: string | null;
  courierName: string | null;
  serviceName: string | null;
  invoiceNumber: string | null;
  createdAt: string;
  items: Array<{ productName: string; qtyMeters: number; lineTotal: number }>;
}

const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(amount);

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as { data?: OrderDetails; error?: string };
      if (!response.ok) {
        throw new Error(result.error || 'Pesanan tidak dapat ditemukan.');
      }
      if (!result.data) throw new Error('Pesanan tidak dapat ditemukan.');
      setOrder(result.data);
    } catch (cause) {
      setOrder(null);
      setError(cause instanceof Error ? cause.message : 'Terjadi kesalahan saat memuat pesanan.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOrder(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOrder]);

  const preparePayment = async () => {
    if (!order) return;
    setPaymentLoading(true);
    setError('');
    try {
      const response = await fetch('/api/payments/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const result = await response.json().catch(() => ({})) as { data?: { paymentUrl?: string }; error?: string };
      if (!response.ok || !result.data?.paymentUrl) throw new Error(result.error || 'Halaman pembayaran belum dapat dibuat.');
      setOrder((current) => current ? { ...current, paymentUrl: result.data?.paymentUrl ?? null } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Halaman pembayaran belum dapat dibuat.');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>STATUS PESANAN</p>
        <h1 className={styles.title}>Lacak pesanan</h1>
        <p className={styles.description}>
          Pesanan akan dimuat otomatis bila Anda sudah masuk atau memakai perangkat checkout yang sama.
        </p>
        {loading && <p className={styles.description}>Memuat pesanan…</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {order && (
          <section className={styles.order} aria-live="polite">
            <div className={styles.orderHeader}>
              <div><p className={styles.eyebrow}>NOMOR PESANAN</p><h2>{order.orderNumber}</h2></div>
              <span className={styles.status}>{order.status.replaceAll('_', ' ')}</span>
            </div>
            <p className={styles.payment}>Pembayaran: <strong>{order.paymentStatus === 'paid' ? 'Berhasil' : order.paymentStatus === 'pending' ? 'Menunggu pembayaran' : order.paymentStatus}</strong></p>
            {order.items.map((item, index) => <div className={styles.item} key={`${item.productName}-${index}`}><span>{item.productName} · {item.qtyMeters} m</span><strong>{rupiah(item.lineTotal)}</strong></div>)}
            <div className={styles.total}><span>Total</span><strong>{rupiah(order.totalAmount)}</strong></div>
            {order.paymentStatus === 'pending' && order.paymentUrl && <a className={styles.payButton} href={order.paymentUrl}>Lanjutkan pembayaran</a>}
            {order.paymentStatus === 'pending' && !order.paymentUrl && <button className={styles.payButton} type="button" disabled={paymentLoading} onClick={() => void preparePayment()}>{paymentLoading ? 'Menyiapkan pembayaran…' : 'Siapkan pembayaran'}</button>}
            {order.invoiceNumber && <a className={styles.payButton} href={`/api/orders/${encodeURIComponent(order.id)}/invoice`} target="_blank" rel="noreferrer">Buka invoice</a>}
            <div className={styles.shipping}><strong>Pengiriman</strong><p>{order.trackingNumber ? `${order.courierName ?? 'Kurir'} ${order.serviceName ?? ''} · Nomor resi: ${order.trackingNumber}` : 'Nomor resi akan muncul setelah pesanan dikirim.'}</p></div>
          </section>
        )}
        <Link href="/products" className={styles.backLink}>Kembali ke katalog</Link>
      </section>
    </main>
  );
}
