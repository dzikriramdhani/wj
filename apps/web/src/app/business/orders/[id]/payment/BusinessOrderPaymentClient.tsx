'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, ChevronDown } from 'lucide-react';
import styles from '@/app/checkout/page.module.css';

type PaymentMethod =
  | { key: string; type: 'bank_transfer'; bank: 'bca' | 'bni' | 'bri' | 'permata'; label: string }
  | { key: string; type: 'qris'; label: string }
  | { key: string; type: 'ewallet'; provider: 'gopay' | 'shopeepay' | 'dana' | 'ovo'; label: string }
  | { key: string; type: 'cstore'; store: 'indomaret' | 'alfamart'; label: string };

type PaymentInstruction = {
  transactionId?: string | null;
  transactionStatus?: string;
  paymentType?: string | null;
  grossAmount?: number;
  expiryTime?: string | null;
  bank?: string | null;
  vaNumbers?: Array<{ bank?: string; va_number?: string }>;
  permataVaNumber?: string | null;
  qrString?: string | null;
  actions?: Array<{ name: string; url: string; method?: string }>;
  store?: string | null;
  paymentCode?: string | null;
  billKey?: string | null;
  billerCode?: string | null;
};

type BulkOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentType: string | null;
  paymentInstruction: PaymentInstruction | null;
  paymentExpiresAt: string | null;
  paidAt: string | null;
  totalAmount: number;
  paymentTerms: string;
  items: Array<{ description: string; quantity: number; lineTotal: number }>;
};

const paymentMethodGroups: Array<{ title: string; methods: PaymentMethod[] }> = [
  { title: 'Transfer bank / Virtual Account', methods: [
    { key: 'bank-bca', type: 'bank_transfer', bank: 'bca', label: 'BCA Virtual Account' },
    { key: 'bank-bni', type: 'bank_transfer', bank: 'bni', label: 'BNI Virtual Account' },
    { key: 'bank-bri', type: 'bank_transfer', bank: 'bri', label: 'BRI Virtual Account' },
    { key: 'bank-permata', type: 'bank_transfer', bank: 'permata', label: 'Permata Virtual Account' },
  ] },
  { title: 'QRIS', methods: [{ key: 'qris', type: 'qris', label: 'QRIS' }] },
  { title: 'E-Wallet', methods: [
    { key: 'wallet-gopay', type: 'ewallet', provider: 'gopay', label: 'GoPay' },
    { key: 'wallet-shopeepay', type: 'ewallet', provider: 'shopeepay', label: 'ShopeePay' },
    { key: 'wallet-dana', type: 'ewallet', provider: 'dana', label: 'DANA' },
    { key: 'wallet-ovo', type: 'ewallet', provider: 'ovo', label: 'OVO' },
  ] },
  { title: 'Bayar di minimarket', methods: [
    { key: 'store-indomaret', type: 'cstore', store: 'indomaret', label: 'Indomaret' },
    { key: 'store-alfamart', type: 'cstore', store: 'alfamart', label: 'Alfamart' },
  ] },
];

const paymentBrandMarks: Record<string, string> = {
  'bank-bca': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/09/fc68a00838f69124fddaf64e30f5e958_ca45aac69ce87ce691c3e6582894b6f0_compressed.png',
  'bank-bni': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/09/f6f57e9126c57179cf729cc9586e47c0_e26ce4cce944fe379072ae509fe72ec1_compressed.png',
  'bank-bri': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/09/0fcddd245474380834dfe5f3beb0492f_093eb297aba2188382cf91e556dd9bdf_compressed.png',
  'bank-permata': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2024/10/b8ed83a966c951414a2c0ababa0b6987_377d64303a92b5d124043e753ae85f64_compressed.png',
  qris: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2026/05/6237bef1c044ea522c682a8c7ac8ed96_50c21935c4ca616d555ac3545f93345e_compressed.png',
  'wallet-gopay': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2026/05/1ac8e4338379d401b2f6c409a5c5b368_ff408617fe1bc56dc9d05aab777ff06c_compressed.png',
  'wallet-shopeepay': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/10/f7fb2e0ab8572355142dba33ddc7b8d6_0747205be87147c03d04217ad4eb06c3_compressed.png',
  'wallet-dana': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2024/11/c9386acd20eb0368a480d24e9ee6a664_8000f1aceb209912674e98494d376284_compressed.png',
  'wallet-ovo': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2026/03/9d5866d13585a012a6239d8a66601ebf_6d74d45eae27e8a5bddc0b64098cff68_compressed.png',
  'store-indomaret': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2025/03/8120a478a97dae6c25f295690a49dfe2_a4d8783f9cc51fd18a3d851cfc2aefb6_compressed.png',
  'store-alfamart': 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/09/0b49d7de63b2367e0515c1283060f64e_c16ca417c1f390206d3ccc6785df8f19_compressed.png',
};

const money = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(amount);

function paymentMethodRequest(method: PaymentMethod) {
  if (method.type === 'bank_transfer') return { type: method.type, bank: method.bank };
  if (method.type === 'ewallet') return { type: method.type, provider: method.provider };
  if (method.type === 'cstore') return { type: method.type, store: method.store };
  return { type: method.type };
}

function methodFromInstruction(instruction: PaymentInstruction | null): PaymentMethod | null {
  if (!instruction?.paymentType) return null;
  if (instruction.paymentType === 'qris') return paymentMethodGroups[1].methods[0];
  if (instruction.paymentType === 'bank_transfer') {
    const bank = (instruction.bank ?? instruction.vaNumbers?.[0]?.bank ?? '').toLowerCase();
    return paymentMethodGroups[0].methods.find((method) => method.type === 'bank_transfer' && method.bank === bank) ?? null;
  }
  if (instruction.paymentType === 'cstore') {
    const store = (instruction.store ?? '').toLowerCase();
    return paymentMethodGroups[3].methods.find((method) => method.type === 'cstore' && method.store === store) ?? null;
  }
  return paymentMethodGroups[2].methods.find((method) => method.type === 'ewallet' && method.provider === instruction.paymentType) ?? null;
}

export default function BusinessOrderPaymentClient({ bulkOrderId }: { bulkOrderId: string }) {
  const [order, setOrder] = useState<BulkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [copiedValue, setCopiedValue] = useState('');
  const [now, setNow] = useState<number | null>(null);

  const loadOrder = useCallback(async (initial = false) => {
    try {
      const response = await fetch(`/api/business/bulk-orders/${encodeURIComponent(bulkOrderId)}/payment`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as { data?: BulkOrder; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || 'Ringkasan pembayaran belum dapat dimuat.');
      setOrder(result.data);
      setError('');
      setSelectedMethod((current) => current ?? methodFromInstruction(result.data?.paymentInstruction ?? null));
    } catch (cause) {
      if (initial) setError(cause instanceof Error ? cause.message : 'Ringkasan pembayaran belum dapat dimuat.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [bulkOrderId]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void loadOrder(true), 0);
    const refresh = window.setInterval(() => void loadOrder(), 5000);
    const initialClock = window.setTimeout(() => setNow(Date.now()), 0);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearTimeout(initialClock);
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, [loadOrder]);

  const instruction = order?.paymentInstruction ?? null;
  const paymentStatus = (order?.paymentStatus ?? 'unpaid').toLowerCase();
  const isPaid = paymentStatus === 'paid';
  const expiry = instruction?.expiryTime || order?.paymentExpiresAt || null;
  const isExpired = paymentStatus === 'expired' || Boolean(expiry && now !== null && Date.parse(expiry) <= now);
  const canChooseMethod = !isPaid && (isExpired || ['unpaid', 'failed'].includes(paymentStatus) || (paymentStatus === 'pending' && !instruction));
  const paymentCode = instruction?.vaNumbers?.[0]?.va_number ?? instruction?.permataVaNumber ?? instruction?.paymentCode ?? null;
  const paymentAction = instruction?.actions?.find((action) => /deeplink|redirect/i.test(action.name))?.url;

  const items = useMemo(() => order?.items ?? [], [order?.items]);

  const createPayment = async () => {
    if (!selectedMethod) {
      setPaymentError('Pilih metode pembayaran terlebih dahulu.');
      return;
    }
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const response = await fetch('/api/payments/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkOrderId, method: paymentMethodRequest(selectedMethod) }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; data?: { instruction?: PaymentInstruction }; error?: string };
      if (!response.ok || !result.success || !result.data?.instruction) {
        throw new Error(result.error || 'Instruksi pembayaran belum dapat dibuat.');
      }
      setOrder((current) => current ? { ...current, paymentStatus: 'pending', paymentInstruction: result.data?.instruction ?? null } : current);
      await loadOrder();
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : 'Instruksi pembayaran belum dapat dibuat.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const copyPaymentCode = async () => {
    if (!paymentCode) return;
    try {
      await navigator.clipboard.writeText(paymentCode);
      setCopiedValue(paymentCode);
    } catch {
      setPaymentError('Kode pembayaran tidak dapat disalin di browser ini.');
    }
  };

  return <div className={styles.main}>
    <header className={styles.checkoutHeader}>
      <nav className={styles.checkoutHeaderInner} aria-label="Navigasi pembayaran">
        <Link href="/" className={styles.checkoutBrand} aria-label="Wina Jaya beranda">WINA JAYA</Link>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </nav>
    </header>
    <section className={styles.orderPendingSection}>
      <div className={styles.orderPendingCard}>
        <h1 className={styles.orderPendingTitle}>Pembayaran</h1>
        {loading && <p className={styles.paymentStatus} role="status">Memuat ringkasan pembayaran…</p>}
        {error && !order && <p className={styles.shippingError} role="alert">{error}</p>}
        {order && <>
          <p className={styles.receiptLabel}>PESANAN PERUSAHAAN</p>
          <h2 className={styles.successHeading}>{order.orderNumber}</h2>
          {isPaid && <p className={styles.paymentSuccessNotice} role="status">Pembayaran sukses.</p>}
          {isExpired && <p className={styles.paymentStatus} role="status">Instruksi pembayaran telah kedaluwarsa. Anda dapat menyiapkan pembayaran baru.</p>}
          <div className={styles.orderPreview}>
            <div className={styles.orderPreviewHeader}>
              <div><strong>Ringkasan pesanan</strong><span>{order.paymentTerms || 'Syarat pembayaran sesuai quotation'}</span></div>
              <span className={styles.orderPreviewStatus}>{isPaid ? 'Pembayaran berhasil' : isExpired ? 'Kedaluwarsa' : paymentStatus === 'unpaid' ? 'Belum dibayar' : 'Menunggu pembayaran'}</span>
            </div>
            <div className={styles.orderPreviewItems}>
              {items.map((item, index) => <div className={styles.paymentDetailItem} key={`${item.description}-${index}`}>
                <span><strong>{item.description}</strong><small>{item.quantity.toLocaleString('id-ID')} meter</small></span>
                <strong>{money(item.lineTotal)}</strong>
              </div>)}
            </div>
            <div className={`${styles.paymentDetailRow} ${styles.paymentDetailTotal}`}><strong>Total pembayaran</strong><strong>{money(order.totalAmount)}</strong></div>
          </div>

          {canChooseMethod && <div className={styles.paymentInstruction}>
            <h3>Pilih metode pembayaran</h3>
            <div className={styles.paymentGroups}>
              {paymentMethodGroups.map((group) => {
                const groupId = `b2b-payment-${group.methods[0].key}`;
                const isOpen = openGroup === groupId;
                const selected = group.methods.find((method) => method.key === selectedMethod?.key);
                return <section className={styles.paymentGroup} key={group.title}>
                  <button type="button" className={styles.accordionTrigger} aria-expanded={isOpen} aria-controls={groupId} onClick={() => setOpenGroup((current) => current === groupId ? null : groupId)}>
                    <span className={styles.accordionTitle}>{group.title}</span>
                    <span className={styles.accordionSelection}>
                      {selected && <><span>{selected.label}</span><span className={styles.selectionCheck} aria-label="Terpilih"><Check size={14} strokeWidth={2.5} /></span></>}
                      <ChevronDown className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ''}`} size={18} aria-hidden="true" />
                    </span>
                  </button>
                  {isOpen && <div className={styles.paymentChoices} id={groupId}>
                    {group.methods.map((method) => {
                      const isSelected = method.key === selectedMethod?.key;
                      return <button type="button" className={styles.paymentChoice} key={method.key} aria-pressed={isSelected} onClick={() => { setSelectedMethod(method); setPaymentError(''); }}>
                        <Image className={styles.paymentLogo} src={paymentBrandMarks[method.key]} alt="" width={54} height={28} unoptimized />
                        <span className={styles.paymentLabel}>{method.label}</span>
                        <span className={`${styles.selectionCheck} ${isSelected ? styles.selectionCheckVisible : ''}`} aria-hidden={!isSelected}>{isSelected && <Check size={14} strokeWidth={2.5} />}</span>
                      </button>;
                    })}
                  </div>}
                </section>;
              })}
            </div>
            <button type="button" className={styles.btnPrimary} disabled={!selectedMethod || paymentLoading} onClick={() => void createPayment()}>
              {paymentLoading ? 'Menyiapkan pembayaran…' : selectedMethod ? `Bayar dengan ${selectedMethod.label}` : 'Pilih metode pembayaran'}
            </button>
          </div>}

          {!isPaid && !isExpired && instruction && <div className={styles.paymentInstruction}>
            <h3>{selectedMethod?.label ?? 'Instruksi pembayaran'}</h3>
            {paymentStatus !== 'pending' && <p className={styles.paymentStatus} role="status">Status pembayaran: {paymentStatus}</p>}
            {instruction.paymentType === 'bank_transfer' && paymentCode && <div className={styles.instructionRow}>
              <span>Nomor Virtual Account</span><strong>{paymentCode}</strong>
              <button type="button" className={styles.copyButton} onClick={() => void copyPaymentCode()}>{copiedValue === paymentCode ? 'Tersalin' : 'Salin'}</button>
            </div>}
            {instruction.paymentType === 'cstore' && paymentCode && <div className={styles.instructionRow}>
              <span>Kode pembayaran</span><strong>{paymentCode}</strong>
              <button type="button" className={styles.copyButton} onClick={() => void copyPaymentCode()}>{copiedValue === paymentCode ? 'Tersalin' : 'Salin'}</button>
            </div>}
            {instruction.paymentType === 'qris' && <div className={styles.qrPayment}>
              <Image src={`/api/business/bulk-orders/${encodeURIComponent(bulkOrderId)}/payment-qr`} alt="QR pembayaran QRIS" width={220} height={220} unoptimized />
              <p>Pindai QRIS melalui aplikasi bank atau dompet digital Anda.</p>
            </div>}
            {paymentAction && <a className={styles.btnPrimary} href={paymentAction} target="_blank" rel="noopener noreferrer">Buka aplikasi pembayaran</a>}
            <p className={styles.paymentExpiry}>Batas pembayaran: {expiry ? new Date(expiry).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : 'Sedang memuat batas pembayaran…'}</p>
            <p className={styles.paymentTotal}>Total pembayaran <strong>{money(instruction.grossAmount || order.totalAmount)}</strong></p>
          </div>}

          {paymentError && <p className={styles.shippingError} role="alert">{paymentError}</p>}
          {!isPaid && !isExpired && <p className={styles.paymentNote}>Status pembayaran diperbarui otomatis setelah notifikasi Midtrans diterima.</p>}
          <div className={styles.paymentPageActions}>
            <Link className={styles.btnOutline} href="/business">Kembali ke perusahaan</Link>
          </div>
        </>}
      </div>
    </section>
  </div>;
}
