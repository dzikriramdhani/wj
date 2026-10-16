'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from '../../checkout/page.module.css';

type PaymentDetails = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  paymentStatus: string;
  paymentUrl: string | null;
  paymentExpiresAt: string | null;
  paymentExpiresAtProvider: string | null;
  paymentInstruction: {
    paymentType?: string | null;
    grossAmount?: number;
    vaNumbers?: Array<{ va_number?: string }>;
    permataVaNumber?: string | null;
    paymentCode?: string | null;
    expiryTime?: string | null;
    actions?: Array<{ name: string; url: string }>;
  } | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  items: Array<{ productName: string; variantName: string | null; qtyMeters: number; lineTotal: number }>;
};

const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(amount);

function formatDate(value: string | null | undefined) {
  if (!value) return 'Belum tersedia';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Belum tersedia' : date.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
}

function CheckoutHeader() {
  return <header className={styles.checkoutHeader}>
    <nav className={styles.checkoutHeaderInner} aria-label="Navigasi pembayaran">
      <Link href="/" className={styles.checkoutBrand} aria-label="Wina Jaya beranda">WINA JAYA</Link>
      <span className={styles.headerSpacer} aria-hidden="true" />
    </nav>
  </header>;
}

export default function PaymentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedValue, setCopiedValue] = useState('');
  const [now, setNow] = useState<number | null>(null);

  const loadOrder = useCallback(async (initial = false) => {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as { data?: PaymentDetails; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || 'Detail pembayaran belum dapat dimuat.');
      setOrder(result.data);
      setError('');
    } catch (cause) {
      if (initial) setError(cause instanceof Error ? cause.message : 'Detail pembayaran belum dapat dimuat.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadOrder(true), 0);
    const refreshTimer = window.setInterval(() => void loadOrder(), 5000);
    const initialClockTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(initialClockTimer);
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadOrder]);

  const status = order?.paymentStatus.toLowerCase() ?? 'pending';
  const isPaid = ['paid', 'capture', 'settlement'].includes(status);
  const instruction = order?.paymentInstruction;
  const expiry = instruction?.expiryTime || order?.paymentExpiresAtProvider || order?.paymentExpiresAt || null;
  const isExpired = ['expire', 'expired'].includes(status) || Boolean(expiry && now !== null && Date.parse(expiry) <= now);
  const paymentStateLabel = isPaid ? 'Pembayaran berhasil' : isExpired ? 'Kedaluwarsa' : 'Menunggu pembayaran';
  const vaNumber = instruction?.vaNumbers?.[0]?.va_number ?? instruction?.permataVaNumber;
  const paymentCode = vaNumber ?? instruction?.paymentCode;
  const paymentAction = instruction?.actions?.find((action) => /deeplink|redirect/i.test(action.name))?.url;

  const copyPaymentCode = async () => {
    if (!paymentCode) return;
    try {
      await navigator.clipboard.writeText(paymentCode);
      setCopiedValue(paymentCode);
    } catch {
      setError('Instruksi pembayaran tidak dapat disalin di browser ini.');
    }
  };

  return <div className={styles.main}>
    <CheckoutHeader />
    <section className={styles.orderPendingSection}>
      <div className={styles.orderPendingCard}>
        {loading && <><h1 className={styles.orderPendingTitle}>Pembayaran</h1><p className={styles.paymentStatus} role="status">Memuat ringkasan pembayaran…</p></>}
        {error && !order && <><h1 className={styles.orderPendingTitle}>Pembayaran</h1><p className={styles.shippingError} role="alert">{error}</p></>}
        {order && <>
          <h1 className={styles.orderPendingTitle}>Pembayaran</h1>
          <p className={styles.receiptLabel}>NOMOR PESANAN</p>
          <h2 className={styles.successHeading}>{order.orderNumber}</h2>
          {isPaid && <p className={styles.paymentSuccessNotice} role="status">Pembayaran berhasil.</p>}
          {isExpired && <p className={styles.paymentStatus} role="status">Pembayaran kedaluwarsa. Instruksi pembayaran ini sudah tidak berlaku.</p>}
          <div className={styles.orderPreview}>
            <div className={styles.orderPreviewHeader}>
              <div><strong>Ringkasan pesanan</strong><span>{formatDate(order.createdAt)}</span></div>
              <span className={styles.orderPreviewStatus}>{paymentStateLabel}</span>
            </div>
            <div className={styles.orderPreviewItems}>
              {order.items.map((item, index) => <div className={styles.paymentDetailItem} key={`${item.productName}-${index}`}>
                <span><strong>{item.productName}</strong><small>{item.variantName ? `${item.variantName} · ` : ''}{item.qtyMeters} meter</small></span>
                <strong>{rupiah(item.lineTotal)}</strong>
              </div>)}
            </div>
            <div className={styles.paymentDetailRow}><span>Subtotal</span><span>{rupiah(order.subtotal)}</span></div>
            <div className={styles.paymentDetailRow}><span>Pengiriman</span><span>{rupiah(order.shippingCost)}</span></div>
            <div className={`${styles.paymentDetailRow} ${styles.paymentDetailTotal}`}><strong>Total pembayaran</strong><strong>{rupiah(order.totalAmount)}</strong></div>
          </div>
          {!isPaid && !isExpired && <div className={styles.paymentInstruction}>
            <h3>Instruksi pembayaran</h3>
            {status !== 'pending' && <p className={styles.paymentStatus} role="status">Status: {order.paymentStatus}</p>}
            {instruction?.paymentType === 'bank_transfer' && vaNumber && <div className={styles.instructionRow}>
              <span>Nomor Virtual Account</span><strong>{vaNumber}</strong>
              <button type="button" className={styles.copyButton} onClick={() => void copyPaymentCode()}>{copiedValue === vaNumber ? 'Tersalin' : 'Salin'}</button>
            </div>}
            {instruction?.paymentType === 'cstore' && instruction.paymentCode && <div className={styles.instructionRow}>
              <span>Kode pembayaran</span><strong>{instruction.paymentCode}</strong>
              <button type="button" className={styles.copyButton} onClick={() => void copyPaymentCode()}>{copiedValue === instruction.paymentCode ? 'Tersalin' : 'Salin'}</button>
            </div>}
            {instruction?.paymentType === 'qris' && <div className={styles.qrPayment}>
              <img src={`/api/orders/${encodeURIComponent(order.id)}/payment-qr`} alt="QR pembayaran QRIS" />
              <p>Pindai QRIS melalui aplikasi bank atau dompet digital Anda.</p>
            </div>}
            {paymentAction && <a className={styles.btnPrimary} href={paymentAction} target="_blank" rel="noopener noreferrer">Buka aplikasi pembayaran</a>}
            {order.paymentUrl && <a className={styles.btnPrimary} href={order.paymentUrl} target="_blank" rel="noopener noreferrer">Lanjutkan pembayaran</a>}
            <p className={styles.paymentExpiry}>Batas pembayaran: {formatDate(expiry)}</p>
            {instruction && <p className={styles.paymentTotal}>Total pembayaran <strong>{rupiah(instruction.grossAmount || order.totalAmount)}</strong></p>}
          </div>}
          {error && <p className={styles.shippingError} role="alert">{error}</p>}
          {!isPaid && !isExpired && <p className={styles.paymentNote}>Status pembayaran diperbarui otomatis setelah pembayaran dikonfirmasi.</p>}
          {order.invoiceNumber && order.invoiceStatus === 'issued' && <div className={styles.paymentPageActions}>
            <a className={styles.btnOutline} href={`/api/orders/${encodeURIComponent(order.id)}/invoice`} target="_blank" rel="noreferrer">Buka invoice</a>
          </div>}
        </>}
      </div>
    </section>
  </div>;
}
