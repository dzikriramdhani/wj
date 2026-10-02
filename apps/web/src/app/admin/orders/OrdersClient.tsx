'use client';

import { useState } from 'react';
import styles from './page.module.css';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  total: number;
  createdAt: string;
  paymentStatus: string;
  shipmentStatus: string | null;
  trackingNumber: string;
  courier: string | null;
};

const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export default function OrdersClient({ orders }: { orders: Order[] }) {
  const [rows, setRows] = useState(orders);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const reconcile = async (orderId: string) => {
    setBusyId(orderId);
    setMessage('');
    try {
      const response = await fetch('/api/admin/payments/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Rekonsiliasi gagal.');
      setMessage('Status Midtrans berhasil diperiksa. Muat ulang halaman untuk melihat status terbaru.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rekonsiliasi gagal.');
    } finally {
      setBusyId(null);
    }
  };

  const updateFulfillment = async (order: Order, status: 'PROCESSING' | 'PACKED' | 'SHIPPED' | 'DELIVERED') => {
    setBusyId(order.id);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/fulfillment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, trackingNumber: order.trackingNumber }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Status pengiriman gagal diperbarui.');
      setRows((current) => current.map((row) => row.id === order.id ? { ...row, status } : row));
      setMessage(`${order.orderNumber} diperbarui menjadi ${status.replaceAll('_', ' ')}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Status pengiriman gagal diperbarui.');
    } finally {
      setBusyId(null);
    }
  };

  return <section className={styles.page}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>FULL COMMERCE</p><h1>Pesanan</h1></div><p>{rows.length} pesanan terbaru</p></div>
    {message && <p className={styles.message} role="status">{message}</p>}
    {rows.length === 0 ? <div className={styles.empty}>Belum ada pesanan yang masuk.</div> : <div className={styles.list}>
      {rows.map((order) => <article key={order.id} className={styles.order}>
        <div className={styles.orderHead}><div><strong>{order.orderNumber}</strong><span>{order.customerName} · {order.customerEmail}</span></div><div><b>{rupiah(order.total)}</b><span>{new Date(order.createdAt).toLocaleDateString('id-ID')}</span></div></div>
        <div className={styles.meta}><span>Order: {order.status.replaceAll('_', ' ')}</span><span>Pembayaran: {order.paymentStatus}</span><span>{order.courier ?? 'Pengiriman akan dibuat setelah pembayaran berhasil.'}</span></div>
        <div className={styles.actions}>
          <input aria-label={`Nomor resi ${order.orderNumber}`} placeholder="Nomor resi" value={order.trackingNumber} onChange={(event) => setRows((current) => current.map((row) => row.id === order.id ? { ...row, trackingNumber: event.target.value } : row))} />
          <button type="button" disabled={busyId === order.id} onClick={() => reconcile(order.id)}>Cek Midtrans</button>
          {order.status === 'PAID' && <button type="button" disabled={busyId === order.id} onClick={() => updateFulfillment(order, 'PROCESSING')}>Proses</button>}
          {order.status === 'PROCESSING' && <button type="button" disabled={busyId === order.id} onClick={() => updateFulfillment(order, 'PACKED')}>Sudah dikemas</button>}
          {order.status === 'PACKED' && <button type="button" disabled={busyId === order.id} onClick={() => updateFulfillment(order, 'SHIPPED')}>Kirim</button>}
          {order.status === 'SHIPPED' && <button type="button" disabled={busyId === order.id} onClick={() => updateFulfillment(order, 'DELIVERED')}>Tandai diterima</button>}
        </div>
      </article>)}
    </div>}
  </section>;
}
