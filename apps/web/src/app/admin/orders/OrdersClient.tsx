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
      setMessage('Status pembayaran berhasil diperiksa. Muat ulang halaman untuk melihat status terbaru.');
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
    <header className={styles.heading}>
      <div><h1>Pesanan</h1></div>
      <p>{rows.length} pesanan terbaru</p>
    </header>
    {message && <p className={styles.message} role="status">{message}</p>}
    {rows.length === 0 ? <div className={styles.empty}>Belum ada pesanan yang masuk.</div> : <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Order</th><th>Pelanggan</th><th>Total</th><th>Status order</th><th>Pembayaran</th><th>Kurir &amp; resi</th><th>Aksi</th></tr></thead>
        <tbody>{rows.map((order) => <tr key={order.id}>
          <td><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString('id-ID')}</small></td>
          <td><strong>{order.customerName}</strong><small>{order.customerEmail}</small></td>
          <td className={styles.amount}>{rupiah(order.total)}</td>
          <td><span className={styles.statusBadge}>{order.status.replaceAll('_', ' ')}</span></td>
          <td><span className={order.paymentStatus.toLowerCase() === 'paid' ? styles.paidBadge : styles.pendingBadge}>{order.paymentStatus}</span></td>
          <td><div className={styles.shippingCell}><span>{order.courier ?? 'Belum dibuat'}</span><input aria-label={`Nomor resi ${order.orderNumber}`} placeholder="Nomor resi" value={order.trackingNumber} onChange={(event) => setRows((current) => current.map((row) => row.id === order.id ? { ...row, trackingNumber: event.target.value } : row))} /></div></td>
          <td><div className={styles.actions}>
            <button type="button" disabled={busyId === order.id} onClick={() => reconcile(order.id)}>Cek pembayaran</button>
            {order.status === 'PAID' && <button type="button" disabled={busyId === order.id} onClick={() => updateFulfillment(order, 'PROCESSING')}>Proses</button>}
            {order.status === 'PROCESSING' && <button type="button" disabled={busyId === order.id} onClick={() => updateFulfillment(order, 'PACKED')}>Kemas</button>}
            {order.status === 'PACKED' && <button type="button" disabled={busyId === order.id} onClick={() => updateFulfillment(order, 'SHIPPED')}>Kirim</button>}
            {order.status === 'SHIPPED' && <button type="button" disabled={busyId === order.id} onClick={() => updateFulfillment(order, 'DELIVERED')}>Selesai</button>}
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
