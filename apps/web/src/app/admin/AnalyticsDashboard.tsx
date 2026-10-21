'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CreditCard, Package, ShoppingBag } from 'lucide-react';
import styles from './page.module.css';

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
const compactRupiah = (amount: number) => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(amount);
const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('id-ID', options).format(date);
const shortId = (id: string) => id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-5)}` : id;
type ChartPoint = { x: number; y: number };
const smoothPath = (points: ChartPoint[]) => {
  if (!points.length) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    path += ` C ${start.x + (end.x - previous.x) / 6} ${start.y + (end.y - previous.y) / 6}, ${end.x - (next.x - start.x) / 6} ${end.y - (next.y - start.y) / 6}, ${end.x} ${end.y}`;
  }
  return path;
};
const areaPath = (upper: ChartPoint[], lower: ChartPoint[]) => {
  if (!upper.length || !lower.length) return '';
  const reversedLower = [...lower].reverse();
  return `${smoothPath(upper)} L ${reversedLower[0].x} ${reversedLower[0].y} ${smoothPath(reversedLower).replace(/^M [^C]+/, '')} Z`;
};

export default function AnalyticsDashboard({
  orders,
  rfqs,
  productCount,
}: {
  orders: AnalyticsOrder[];
  rfqs: AnalyticsRFQ[];
  productCount: number;
}) {
  const [activeChartPoint, setActiveChartPoint] = useState<{ chart: 'sales' | 'orders'; index: number; series?: 'paid' | 'pending' } | null>(null);
  const [paymentTooltipSeries, setPaymentTooltipSeries] = useState<'paid' | 'pending' | 'both' | null>(null);
  const [salesTooltipPosition, setSalesTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const [paymentTooltipPosition, setPaymentTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const [activityTooltipPosition, setActivityTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const salesChartViewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = salesChartViewport.current;
    if (viewport) viewport.scrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  }, []);
  const now = useMemo(() => new Date(), []);
  const since = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 11, 1), [now]);
  const rangeOrders = useMemo(() => orders.filter((order) => new Date(order.createdAt) >= since), [orders, since]);
  const paidOrders = useMemo(() => rangeOrders.filter((order) => order.paymentStatus === 'paid'), [rangeOrders]);
  const pendingOrders = useMemo(() => rangeOrders.filter((order) => order.paymentStatus === 'pending'), [rangeOrders]);
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const pendingValue = pendingOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const openRFQs = useMemo(() => rfqs.filter((rfq) => ['SUBMITTED', 'REVIEWED', 'QUOTED', 'NEGOTIATING'].includes(rfq.status)), [rfqs]);

  const buckets = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(since.getFullYear(), since.getMonth() + index, 1);
      const end = new Date(since.getFullYear(), since.getMonth() + index + 1, 1);
      const values = rangeOrders.filter((order) => {
        const created = new Date(order.createdAt);
        return created >= start && created < end;
      });
      const paid = values.filter((order) => order.paymentStatus === 'paid');
      const pending = values.filter((order) => order.paymentStatus === 'pending');
      return {
        label: dateLabel(start, { month: 'short', year: '2-digit' }),
        paidValue: paid.reduce((sum, order) => sum + order.totalAmount, 0),
        pendingValue: pending.reduce((sum, order) => sum + order.totalAmount, 0),
        paidCount: paid.length,
        pendingCount: pending.length,
        paidMeters: paid.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qtyMeters, 0), 0),
      };
    });
  }, [rangeOrders, since]);

  const maxValue = Math.max(...buckets.map((item) => Math.max(item.paidValue, item.pendingValue)), 1);
  const chartHeight = 220;
  const salesChartWidth = 1200;
  const chartLeft = 62;
  const salesChartRight = salesChartWidth - chartLeft;
  const chartTop = 12;
  const chartBottom = 180;
  const activityChartWidth = 660;
  const activityChartHeight = 371;
  const activityChartLeft = 42;
  const activityChartRight = activityChartWidth - 10;
  const activityChartTop = 20;
  const activityChartBottom = 292;
  const maxOrderCount = Math.max(...buckets.map((item) => item.paidCount + item.pendingCount), 1);
  const salesSlotWidth = (salesChartRight - chartLeft) / buckets.length;
  const salesChartX = (index: number) => chartLeft + index * salesSlotWidth + salesSlotWidth / 2;
  const salesBarWidth = 24;
  const salesBarGap = 8;
  const salesBarGroupWidth = salesBarWidth * 2 + salesBarGap;
  const salesBarHeight = (value: number) => value > 0 ? Math.max(3, (value / maxValue) * (chartBottom - chartTop)) : 0;
  const activityChartX = (index: number) => activityChartLeft + index * ((activityChartRight - activityChartLeft) / (buckets.length - 1));
  const activityPaidBoundary = buckets.map((item, index) => ({ x: activityChartX(index), y: activityChartBottom - (item.paidCount / maxOrderCount) * (activityChartBottom - activityChartTop) }));
  const activityTotalBoundary = buckets.map((item, index) => ({ x: activityChartX(index), y: activityChartBottom - ((item.paidCount + item.pendingCount) / maxOrderCount) * (activityChartBottom - activityChartTop) }));
  const activityBaseline = buckets.map((_, index) => ({ x: activityChartX(index), y: activityChartBottom }));
  const activityPaidArea = areaPath(activityPaidBoundary, activityBaseline);
  const activityPendingArea = areaPath(activityTotalBoundary, activityPaidBoundary);
  const activityPaidLine = smoothPath(activityPaidBoundary);
  const activityPendingLine = smoothPath(activityTotalBoundary);
  const handleSalesPointerMove = (event: MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const frame = svg.parentElement?.parentElement;
    if (frame) {
      const frameBounds = frame.getBoundingClientRect();
      setSalesTooltipPosition({
        left: Math.max(8, Math.min(frameBounds.width - 328, event.clientX - frameBounds.left + 14)),
        top: Math.max(8, Math.min(frameBounds.height - 132, event.clientY - frameBounds.top + 14)),
      });
    }
    const target = event.target;
    if (target instanceof SVGRectElement) {
      const series = target.classList.contains(styles.salesBarPaid) ? 'paid' : target.classList.contains(styles.salesBarPending) ? 'pending' : null;
      const index = Number(target.dataset.index);
      if (series && Number.isInteger(index) && index >= 0 && index < buckets.length) {
        setActiveChartPoint({ chart: 'sales', index, series });
        return;
      }
    }
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const viewPoint = point.matrixTransform(matrix.inverse());
    if (viewPoint.x >= chartLeft && viewPoint.x <= salesChartRight) {
      const index = Math.min(buckets.length - 1, Math.floor((viewPoint.x - chartLeft) / salesSlotWidth));
      setActiveChartPoint({ chart: 'sales', index });
      return;
    }
    setActiveChartPoint(null);
  };
  const handleSalesWheel = (event: WheelEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const nextScrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + delta));
    if (nextScrollLeft !== viewport.scrollLeft) {
      event.preventDefault();
      viewport.scrollLeft = nextScrollLeft;
    }
  };
  const handleActivityPointerMove = (event: MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const viewPoint = point.matrixTransform(matrix.inverse());
    if (viewPoint.x < activityChartLeft || viewPoint.x > activityChartRight || viewPoint.y < activityChartTop || viewPoint.y > activityChartBottom) {
      setActiveChartPoint(null);
      setActivityTooltipPosition(null);
      return;
    }
    const index = Math.max(0, Math.min(buckets.length - 1, Math.round((viewPoint.x - activityChartLeft) / ((activityChartRight - activityChartLeft) / (buckets.length - 1)))));
    const series = viewPoint.y < activityPaidBoundary[index].y ? 'pending' : 'paid';
    setActiveChartPoint({ chart: 'orders', index, series });
    const frame = svg.parentElement;
    if (frame) {
      const frameBounds = frame.getBoundingClientRect();
      setActivityTooltipPosition({
        left: Math.max(8, Math.min(frameBounds.width - 328, event.clientX - frameBounds.left + 12)),
        top: Math.max(8, Math.min(frameBounds.height - 132, event.clientY - frameBounds.top + 12)),
      });
    }
  };
  const totalPayments = paidOrders.length + pendingOrders.length;
  const paidShare = totalPayments ? Math.round((paidOrders.length / totalPayments) * 360) : 0;
  const handlePaymentPointerMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const overviewBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (overviewBounds) {
      setPaymentTooltipPosition({
        left: Math.max(8, Math.min(overviewBounds.width - 328, event.clientX - overviewBounds.left + 14)),
        top: Math.max(8, Math.min(overviewBounds.height - 132, event.clientY - overviewBounds.top + 14)),
      });
    }
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    if (Math.hypot(x, y) < 44) {
      setPaymentTooltipSeries('both');
      return;
    }
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 450) % 360;
    setPaymentTooltipSeries(angle < paidShare ? 'paid' : 'pending');
  };
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

  const latestOrders = useMemo(() => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4), [orders]);
  const followUps = useMemo(() => [
    ...pendingOrders.slice(0, 3).map((order) => ({
      id: `payment-${order.id}`,
      title: `Pembayaran ${shortId(order.id)}`,
      detail: `${rupiah(order.totalAmount)} · menunggu pembayaran`,
      date: order.createdAt,
      href: '/admin/orders',
      kind: 'payment' as const,
    })),
    ...openRFQs.slice(0, 4).map((rfq) => ({
      id: `rfq-${rfq.id}`,
      title: rfq.productName,
      detail: `${rfq.qtyRequested.toLocaleString('id-ID')} m · ${rfq.status.toLowerCase()}`,
      date: rfq.createdAt,
      href: '/admin/rfq',
      kind: 'rfq' as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5), [pendingOrders, openRFQs]);

  return (
    <div className={styles.dashboard}>
      <div className={styles.dashboardGrid}>
        <section className={`${styles.widget} ${styles.revenueWidget}`} aria-labelledby="revenue-title">
          <div className={styles.widgetHeader}>
            <h2 id="revenue-title">Penjualan</h2>
          </div>
          <div className={styles.chartSummary}>
            <div><span>Pendapatan</span><strong>{rupiah(paidRevenue)}</strong></div>
            <div><span>Belum dibayar</span><strong>{rupiah(pendingValue)}</strong></div>
          </div>
          <div className={styles.salesChartGroup}>
          <div className={styles.revenueChartFrame} onMouseLeave={() => { setActiveChartPoint(null); setSalesTooltipPosition(null); }}>
              <div ref={salesChartViewport} className={`${styles.chartScroll} ${styles.revenueChartScroll}`} role="region" aria-label="Grafik penjualan 12 bulan, geser untuk melihat bulan lainnya" tabIndex={0} onWheel={handleSalesWheel}>
                <svg className={styles.barChart} viewBox={`0 0 ${salesChartWidth} ${chartHeight}`} role="group" aria-label="Grafik penjualan dan pembayaran per bulan selama 12 bulan" onMouseMove={handleSalesPointerMove}>
                  {[0, 1, 2, 3].map((line) => {
                    const y = chartTop + line * ((chartBottom - chartTop) / 3);
                    return <g key={line}><line x1={chartLeft} y1={y} x2={salesChartRight} y2={y} className={styles.chartGridline} /><text x="0" y={y + 4} className={styles.chartAxis}>{compactRupiah(maxValue * (1 - line / 3))}</text></g>;
                  })}
                  {buckets.map((item, index) => <g key={`${item.label}-${index}`}>
                    <rect x={chartLeft + index * salesSlotWidth} y={chartTop} width={salesSlotWidth} height={chartBottom - chartTop} className={styles.hitArea} onMouseEnter={() => setActiveChartPoint({ chart: 'sales', index })} />
                    <text x={salesChartX(index)} y="210" textAnchor="middle" className={styles.chartAxis} onMouseEnter={() => setActiveChartPoint({ chart: 'sales', index })}>{item.label}</text>
                  </g>)}
                  {buckets.map((item, index) => {
                    const paidHeight = salesBarHeight(item.paidValue);
                    const pendingHeight = salesBarHeight(item.pendingValue);
                    const groupStart = salesChartX(index) - salesBarGroupWidth / 2;
                    return <g key={`bars-${item.label}-${index}`}>
                      <rect data-index={index} x={groupStart} y={chartBottom - paidHeight} width={salesBarWidth} height={paidHeight} rx="2" className={`${styles.salesBar} ${styles.salesBarPaid}`} tabIndex={0} role="button" aria-label={`${item.label}: dibayar ${rupiah(item.paidValue)}, ${item.paidCount} order`} onMouseEnter={() => setActiveChartPoint({ chart: 'sales', index, series: 'paid' })} onFocus={() => setActiveChartPoint({ chart: 'sales', index, series: 'paid' })} onBlur={() => setActiveChartPoint(null)} />
                      <rect data-index={index} x={groupStart + salesBarWidth + salesBarGap} y={chartBottom - pendingHeight} width={salesBarWidth} height={pendingHeight} rx="2" className={`${styles.salesBar} ${styles.salesBarPending}`} tabIndex={0} role="button" aria-label={`${item.label}: menunggu ${rupiah(item.pendingValue)}, ${item.pendingCount} order`} onMouseEnter={() => setActiveChartPoint({ chart: 'sales', index, series: 'pending' })} onFocus={() => setActiveChartPoint({ chart: 'sales', index, series: 'pending' })} onBlur={() => setActiveChartPoint(null)} />
                    </g>;
                  })}
                </svg>
              </div>
              <div className={`${styles.chartTooltip} ${styles.cursorTooltip} ${styles.animatedTooltip} ${activeChartPoint?.chart === 'sales' ? styles.tooltipVisible : ''}`} style={salesTooltipPosition ? { left: salesTooltipPosition.left, top: salesTooltipPosition.top, right: 'auto' } : undefined} role="tooltip" aria-hidden={activeChartPoint?.chart !== 'sales'}>
                {activeChartPoint?.chart === 'sales' && (() => {
                  const item = buckets[activeChartPoint.index];
                  return <div key={`${activeChartPoint.index}-${activeChartPoint.series ?? 'month'}`} className={styles.tooltipContent}><strong>{item.label}</strong>{(!activeChartPoint.series || activeChartPoint.series === 'paid') && <span><i className={styles.legendPaid} />Dibayar · {rupiah(item.paidValue)} · {item.paidCount} order</span>}{(!activeChartPoint.series || activeChartPoint.series === 'pending') && <span><i className={styles.legendPending} />Menunggu · {rupiah(item.pendingValue)} · {item.pendingCount} order</span>}</div>;
                })()}
              </div>
            </div>
            <div className={`${styles.legend} ${styles.salesLegend}`} aria-label="Legenda grafik penjualan"><span><i className={styles.legendPaid} />Dibayar</span><span><i className={styles.legendPending} />Menunggu</span></div>
          </div>
        </section>

        <section className={`${styles.widget} ${styles.transactionsWidget}`} aria-labelledby="transactions-title">
          <div className={styles.widgetHeader}><h2 id="transactions-title">Pesanan terbaru</h2><Link href="/admin/orders" className={styles.iconLink} aria-label="Semua pesanan"><ArrowRight size={16} /></Link></div>
          {latestOrders.length ? <div className={styles.transactionList}>{latestOrders.map((order) => <article className={styles.transaction} key={order.id}>
            <span className={styles.transactionIcon}><ShoppingBag size={16} aria-hidden="true" /></span>
            <span className={styles.transactionText}><strong>{shortId(order.id)}</strong><small>{dateLabel(new Date(order.createdAt), { day: 'numeric', month: 'short', year: 'numeric' })} · {order.paymentStatus === 'paid' ? 'Dibayar' : 'Menunggu'}</small></span>
            <b>{rupiah(order.totalAmount)}</b>
          </article>)}</div> : <p className={styles.emptyState}>Belum ada transaksi.</p>}
        </section>

        <section className={`${styles.widget} ${styles.paymentWidget}`} aria-labelledby="payment-title">
          <div className={styles.widgetHeader}><h2 id="payment-title">Pembayaran</h2></div>
          <div className={styles.paymentOverview} onMouseLeave={() => { setPaymentTooltipSeries(null); setPaymentTooltipPosition(null); }}>
            <div className={styles.donut} style={{ background: `conic-gradient(var(--admin-chart-1) 0deg ${paidShare}deg, var(--admin-chart-4) ${paidShare}deg 360deg)` }} role="img" tabIndex={0} aria-label={`${paidOrders.length} dibayar dan ${pendingOrders.length} menunggu`} onMouseEnter={handlePaymentPointerMove} onMouseMove={handlePaymentPointerMove} onFocus={() => { setPaymentTooltipSeries('both'); setPaymentTooltipPosition(null); }} onBlur={() => { setPaymentTooltipSeries(null); setPaymentTooltipPosition(null); }}>
              <span><strong>{totalPayments}</strong><small>order</small></span>
            </div>
              <div className={styles.paymentLegend}>
              <div><i className={styles.legendPaid} /><span>Dibayar</span><strong>{paidOrders.length}</strong></div>
              <div><i className={styles.legendPending} /><span>Menunggu</span><strong>{pendingOrders.length}</strong></div>
              <Link href="/admin/orders">Kelola pesanan <ArrowRight size={13} /></Link>
            </div>
            <div className={`${styles.paymentTooltip} ${styles.cursorTooltip} ${styles.animatedTooltip} ${paymentTooltipSeries ? styles.tooltipVisible : ''}`} style={paymentTooltipPosition ? { left: paymentTooltipPosition.left, top: paymentTooltipPosition.top, right: 'auto' } : undefined} role="tooltip" aria-hidden={!paymentTooltipSeries}>
              {paymentTooltipSeries && <div key={paymentTooltipSeries} className={styles.tooltipContent}>
                <strong>Status pembayaran · 12 bulan</strong>
                {(paymentTooltipSeries === 'both' || paymentTooltipSeries === 'paid') && <span><i className={styles.legendPaid} />Dibayar · {rupiah(paidRevenue)} · {paidOrders.length} order · {totalPayments ? Math.round((paidOrders.length / totalPayments) * 100) : 0}%</span>}
                {(paymentTooltipSeries === 'both' || paymentTooltipSeries === 'pending') && <span><i className={styles.legendPending} />Menunggu · {rupiah(pendingValue)} · {pendingOrders.length} order · {totalPayments ? Math.round((pendingOrders.length / totalPayments) * 100) : 0}%</span>}
              </div>}
            </div>
          </div>
        </section>

        <section className={`${styles.widget} ${styles.todoWidget}`} aria-labelledby="followups-title">
          <div className={styles.widgetHeader}><h2 id="followups-title">Perlu ditindaklanjuti</h2><span className={styles.countBadge}>{followUps.length}</span></div>
          {followUps.length ? <div className={styles.followUpList}>{followUps.map((item) => <Link href={item.href} className={styles.followUp} key={item.id}>
            <span className={`${styles.followUpIcon} ${item.kind === 'payment' ? styles.paymentFollowUp : ''}`}>{item.kind === 'payment' ? <CreditCard size={14} /> : <Package size={14} />}</span>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            {item.kind === 'payment' ? <ArrowDownRight size={14} aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}
          </Link>)}</div> : <p className={styles.emptyState}>Tidak ada tindak lanjut saat ini.</p>}
        </section>

        <section className={`${styles.widget} ${styles.trendWidget}`} aria-labelledby="trend-title">
          <div className={styles.widgetHeader}><h2 id="trend-title">Aktivitas order</h2><span className={styles.metricPill}>12 bulan</span></div>
          <div className={styles.activityChartGroup}>
            <div className={styles.activityChartFrame} onMouseLeave={() => { setActiveChartPoint(null); setActivityTooltipPosition(null); }}>
              <svg className={styles.areaChart} viewBox={`0 0 ${activityChartWidth} ${activityChartHeight}`} role="img" aria-label="Grafik area aktivitas order dibayar dan menunggu per bulan selama 12 bulan" tabIndex={0} onMouseMove={handleActivityPointerMove} onFocus={() => { setActiveChartPoint({ chart: 'orders', index: 11 }); setActivityTooltipPosition({ left: 8, top: 8 }); }} onBlur={() => { setActiveChartPoint(null); setActivityTooltipPosition(null); }}>
                <defs>
                  <linearGradient id="activity-paid-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--admin-chart-1)" stopOpacity=".8" /><stop offset="95%" stopColor="var(--admin-chart-1)" stopOpacity=".1" /></linearGradient>
                  <linearGradient id="activity-pending-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--admin-chart-4)" stopOpacity=".8" /><stop offset="95%" stopColor="var(--admin-chart-4)" stopOpacity=".1" /></linearGradient>
                </defs>
                {[0, 1, 2, 3].map((line) => {
                  const fraction = 1 - line / 3;
                  const y = activityChartTop + line * ((activityChartBottom - activityChartTop) / 3);
                  return <g key={line}><line x1={activityChartLeft} y1={y} x2={activityChartRight} y2={y} className={styles.activityGridline} /><text x="0" y={y + 4} className={styles.chartAxis}>{Math.round(maxOrderCount * fraction)}</text></g>;
                })}
                {activeChartPoint?.chart === 'orders' && <line x1={activityChartX(activeChartPoint.index)} y1={activityChartTop} x2={activityChartX(activeChartPoint.index)} y2={activityChartBottom} className={styles.chartCursor} />}
                <path d={activityPaidArea} fill="url(#activity-paid-gradient)" fillOpacity=".4" />
                <path d={activityPendingArea} fill="url(#activity-pending-gradient)" fillOpacity=".4" />
                <path d={activityPaidLine} className={styles.paidLine} />
                <path d={activityPendingLine} className={styles.pendingLine} />
                {buckets.map((item, index) => <text key={`${item.label}-${index}`} x={activityChartX(index)} y="330" textAnchor="middle" className={styles.chartAxis}>{item.label.split(' ')[0]}</text>)}
              </svg>
              <div className={`${styles.chartTooltip} ${styles.animatedTooltip} ${activeChartPoint?.chart === 'orders' ? styles.tooltipVisible : ''}`} style={activityTooltipPosition ? { left: activityTooltipPosition.left, top: activityTooltipPosition.top, right: 'auto' } : undefined} role="tooltip" aria-hidden={activeChartPoint?.chart !== 'orders'}>
                {activeChartPoint?.chart === 'orders' && (() => {
                  const item = buckets[activeChartPoint.index];
                  return <div key={`${activeChartPoint.index}-${activeChartPoint.series ?? 'both'}`} className={styles.tooltipContent}><strong>{item.label}</strong><span><i className={styles.legendPaid} />Dibayar · {item.paidCount} order</span><span><i className={styles.legendPending} />Menunggu · {item.pendingCount} order</span><span>Total · {item.paidCount + item.pendingCount} order · {item.paidMeters.toLocaleString('id-ID')} m lunas</span></div>;
                })()}
              </div>
            </div>
            <div className={`${styles.legend} ${styles.activityLegend}`} aria-label="Legenda aktivitas order"><span><i className={styles.legendPaid} />Dibayar</span><span><i className={styles.legendPending} />Menunggu</span></div>
          </div>
        </section>

        <section className={`${styles.widget} ${styles.productsWidget}`} aria-labelledby="popular-title">
          <div className={styles.widgetHeader}><h2 id="popular-title">Produk teratas</h2><Link href="/admin/products" className={styles.iconLink} aria-label="Semua produk"><ArrowRight size={16} /></Link></div>
          {productLeaders.length ? <div className={styles.popularList}>{productLeaders.map((product, index) => <article className={styles.popularProduct} key={product.name}>
            <span className={styles.productThumb}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.productText}><strong>{product.name}</strong><small>{product.meters.toLocaleString('id-ID')} meter terjual</small></span>
            <b>{rupiah(product.revenue)}</b>
          </article>)}</div> : <p className={styles.emptyState}>Data produk terjual muncul setelah pembayaran terverifikasi.</p>}
          <div className={styles.productsFoot}><Package size={14} aria-hidden="true" />{productCount.toLocaleString('id-ID')} produk aktif di katalog</div>
        </section>
      </div>
    </div>
  );
}
