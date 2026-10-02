'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

type Range = 7 | 30 | 90;
interface AnalyticsOrder {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  items: Array<{ productId: string; productName: string; qtyMeters: number; lineTotal: number }>;
}
interface AnalyticsRFQ {
  id: string;
  productName: string;
  qtyRequested: number;
  status: string;
  createdAt: string;
}

const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('id-ID', options).format(date);

export default function AnalyticsDashboard({
  orders,
  rfqs,
  productCount,
}: {
  orders: AnalyticsOrder[];
  rfqs: AnalyticsRFQ[];
  productCount: number;
}) {
  const [range, setRange] = useState<Range>(30);
  const now = useMemo(() => new Date(), []);
  const since = useMemo(() => new Date(now.getTime() - range * 86400000), [now, range]);
  const rangeOrders = useMemo(() => orders.filter((order) => new Date(order.createdAt) >= since), [orders, since]);
  const paidOrders = useMemo(() => rangeOrders.filter((order) => order.paymentStatus === 'paid'), [rangeOrders]);
  const revenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const openRFQs = rfqs.filter((rfq) => ['SUBMITTED', 'REVIEWED', 'QUOTED', 'NEGOTIATING'].includes(rfq.status));

  const trend = useMemo(() => {
    const bucketCount = range === 90 ? 13 : range;
    const bucketSize = (range * 86400000) / bucketCount;
    return Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(since.getTime() + index * bucketSize);
      const end = new Date(start.getTime() + bucketSize);
      const values = rangeOrders.filter((order) => {
        const created = new Date(order.createdAt);
        return created >= start && created < end && order.paymentStatus === 'paid';
      });
      return {
        label: dateLabel(start, range === 90 ? { day: 'numeric', month: 'short' } : { day: 'numeric' }),
        revenue: values.reduce((sum, order) => sum + order.totalAmount, 0),
        orders: values.length,
      };
    });
  }, [range, rangeOrders, since]);
  const maxRevenue = Math.max(...trend.map((item) => item.revenue), 1);
  const productLeaders = useMemo(() => {
    const totals = new Map<string, { name: string; meters: number; revenue: number }>();
    paidOrders.forEach((order) => order.items.forEach((item) => {
      const current = totals.get(item.productId) || { name: item.productName, meters: 0, revenue: 0 };
      totals.set(item.productId, {
        name: current.name,
        meters: current.meters + item.qtyMeters,
        revenue: current.revenue + item.lineTotal,
      });
    }));
    return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [paidOrders]);

  const recentActivity = useMemo(() => [
    ...rangeOrders.map((order) => ({ id: order.id, title: `Pesanan ${order.id}`, detail: order.paymentStatus === 'paid' ? 'Pembayaran diterima' : 'Menunggu pembayaran', date: order.createdAt, type: 'order' })),
    ...rfqs.filter((rfq) => new Date(rfq.createdAt) >= since).map((rfq) => ({ id: rfq.id, title: `RFQ ${rfq.id}`, detail: `${rfq.productName} · ${rfq.qtyRequested.toLocaleString('id-ID')} m`, date: rfq.createdAt, type: 'rfq' })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6), [rangeOrders, rfqs, since]);

  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>RINGKASAN BISNIS</p>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.subtitle}>Pantau transaksi retail, aktivitas RFQ, dan performa katalog.</p>
        </div>
        <Link href="/admin/rfq" className={styles.primaryAction}>Buka RFQ <span aria-hidden="true">↗</span></Link>
      </header>

      <div className={styles.toolbar}>
        <span className={styles.rangeCaption}>Periode aktivitas pesanan</span>
        <div className={styles.rangeControls} role="group" aria-label="Pilih rentang analitik">
          {([7, 30, 90] as const).map((days) => (
            <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(days)} className={`${styles.rangeButton} ${range === days ? styles.rangeActive : ''}`}>
              {days} hari
            </button>
          ))}
        </div>
      </div>

      <section className={styles.metricGrid} aria-label="Metrik utama">
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Pendapatan dibayar</span>
          <strong className={styles.metricValue}>{rupiah(revenue)}</strong>
          <span className={styles.metricNote}>{paidOrders.length} pesanan lunas dalam {range} hari</span>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Pesanan baru</span>
          <strong className={styles.metricValue}>{rangeOrders.length}</strong>
          <span className={styles.metricNote}>{rangeOrders.filter((order) => order.paymentStatus === 'pending').length} menunggu pembayaran</span>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>RFQ aktif</span>
          <strong className={styles.metricValue}>{openRFQs.length}</strong>
          <span className={styles.metricNote}>Perlu tindak lanjut sales</span>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Produk aktif</span>
          <strong className={styles.metricValue}>{productCount}</strong>
          <span className={styles.metricNote}>Tersedia di katalog</span>
        </article>
      </section>

      <section className={styles.mainGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2 className={styles.panelTitle}>Pendapatan</h2><p className={styles.panelDescription}>Transaksi lunas per {range === 90 ? 'minggu' : 'hari'}</p></div>
            <strong className={styles.panelTotal}>{rupiah(revenue)}</strong>
          </div>
          <div className={styles.chart} role="img" aria-label={`Grafik pendapatan terbayar selama ${range} hari`}>
            {trend.map((point, index) => (
              <div className={styles.chartColumn} key={`${point.label}-${index}`} title={`${point.label}: ${rupiah(point.revenue)}`}>
                <div className={styles.barTrack}><div className={styles.bar} style={{ height: `${point.revenue ? Math.max(5, (point.revenue / maxRevenue) * 100) : 2}%` }} /></div>
                {(range === 7 || index % (range === 30 ? 5 : 2) === 0 || index === trend.length - 1) && <span className={styles.chartLabel}>{point.label}</span>}
              </div>
            ))}
          </div>
          {paidOrders.length === 0 && <p className={styles.emptyNote}>Belum ada pembayaran lunas pada rentang waktu ini.</p>}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Pipeline RFQ</h2><p className={styles.panelDescription}>Permintaan yang perlu diproses</p></div><Link href="/admin/rfq" className={styles.textLink}>Kelola →</Link></div>
          <div className={styles.pipeline}>
            {[
              ['Diajukan', rfqs.filter((rfq) => rfq.status === 'SUBMITTED').length],
              ['Ditinjau', rfqs.filter((rfq) => rfq.status === 'REVIEWED').length],
              ['Penawaran dikirim', rfqs.filter((rfq) => ['QUOTED', 'NEGOTIATING'].includes(rfq.status)).length],
              ['Selesai', rfqs.filter((rfq) => ['ACCEPTED', 'COMPLETED'].includes(rfq.status)).length],
            ].map(([label, count]) => <div className={styles.pipelineRow} key={label}><span>{label}</span><strong>{count}</strong></div>)}
          </div>
        </article>
      </section>

      <section className={styles.lowerGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Produk teratas</h2><p className={styles.panelDescription}>Berdasarkan pembayaran lunas</p></div><Link href="/admin/products" className={styles.textLink}>Katalog →</Link></div>
          {productLeaders.length ? <div className={styles.productList}>{productLeaders.map((product, index) => <div className={styles.productRow} key={product.name}><span className={styles.productRank}>{String(index + 1).padStart(2, '0')}</span><span className={styles.productName}>{product.name}</span><span className={styles.productQty}>{product.meters.toLocaleString('id-ID')} m</span><strong>{rupiah(product.revenue)}</strong></div>)}</div> : <p className={styles.emptyNote}>Data produk terjual akan muncul setelah ada pembayaran.</p>}
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Aktivitas terbaru</h2><p className={styles.panelDescription}>Pesanan dan permintaan masuk</p></div></div>
          {recentActivity.length ? <div className={styles.activityList}>{recentActivity.map((activity) => <div className={styles.activityRow} key={`${activity.type}-${activity.id}`}><span className={`${styles.activityDot} ${activity.type === 'order' ? styles.orderDot : ''}`} /><span className={styles.activityText}><strong>{activity.title}</strong><small>{activity.detail}</small></span><time>{dateLabel(new Date(activity.date), { day: 'numeric', month: 'short', year: '2-digit' })}</time></div>)}</div> : <p className={styles.emptyNote}>Belum ada aktivitas untuk periode ini.</p>}
        </article>
      </section>
      <p className={styles.dataNote}>Pendapatan hanya menghitung pembayaran Midtrans yang sudah terverifikasi. Data diperbarui dari database operasional.</p>
    </div>
  );
}
