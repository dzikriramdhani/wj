'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import styles from './page.module.css';
import { useCart } from '@/lib/cart-context';

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

type Destination = {
  id: string;
  label: string;
  provinceId: string;
  provinceName: string;
  cityName: string;
  districtName: string | null;
  postalCode: string | null;
};

type ShippingQuote = {
  id: string;
  courierCode: string;
  courierName: string;
  serviceName: string;
  cost: number;
  detail: string | null;
};

type CheckoutStep = 'address' | 'delivery' | 'payment';
type CheckoutOrderPreview = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  courierName: string;
  serviceName: string;
  items: Array<{ productName: string; variantName: string | null; qtyMeters: number; lineTotal: number }>;
  subtotal: number;
  shippingCost: number;
  grandTotal: number;
};
type PaymentMethod =
  | { key: string; type: 'bank_transfer'; bank: 'bca' | 'bni' | 'bri' | 'permata'; label: string }
  | { key: string; type: 'qris'; label: string }
  | { key: string; type: 'ewallet'; provider: 'gopay' | 'shopeepay' | 'dana' | 'ovo'; label: string }
  | { key: string; type: 'cstore'; store: 'indomaret' | 'alfamart'; label: string };

type PaymentInstruction = {
  transactionId: string | null;
  transactionStatus: string;
  paymentType: string | null;
  grossAmount: number;
  expiryTime: string | null;
  bank: string | null;
  vaNumbers: Array<{ bank?: string; va_number?: string }>;
  permataVaNumber: string | null;
  qrString: string | null;
  actions: Array<{ name: string; url: string; method?: string }>;
  store: string | null;
  paymentCode: string | null;
  billKey: string | null;
  billerCode: string | null;
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

const paymentBrandMarks: Record<string, { src: string }> = {
  'bank-bca': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/09/fc68a00838f69124fddaf64e30f5e958_ca45aac69ce87ce691c3e6582894b6f0_compressed.png' },
  'bank-bni': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/09/f6f57e9126c57179cf729cc9586e47c0_e26ce4cce944fe379072ae509fe72ec1_compressed.png' },
  'bank-bri': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/09/0fcddd245474380834dfe5f3beb0492f_093eb297aba2188382cf91e556dd9bdf_compressed.png' },
  'bank-permata': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2024/10/b8ed83a966c951414a2c0ababa0b6987_377d64303a92b5d124043e753ae85f64_compressed.png' },
  qris: { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2026/05/6237bef1c044ea522c682a8c7ac8ed96_50c21935c4ca616d555ac3545f93345e_compressed.png' },
  'wallet-gopay': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2026/05/1ac8e4338379d401b2f6c409a5c5b368_ff408617fe1bc56dc9d05aab777ff06f_compressed.png' },
  'wallet-shopeepay': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/10/f7fb2e0ab8572355142dba33ddc7b8d6_0747205be87147c03d04217ad4eb06c3_compressed.png' },
  'wallet-dana': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2024/11/c9386acd20eb0368a480d24e9ee6a664_8000f1aceb209912674e98494d376284_compressed.png' },
  'wallet-ovo': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2026/03/9d5866d13585a012a6239d8a66601ebf_6d74d45eae27e8a5bddc0b64098cff68_compressed.png' },
  'store-indomaret': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2025/03/8120a478a97dae6c25f295690a49dfe2_a4d8783f9cc51fd18a3d851cfc2aefb6_compressed.png' },
  'store-alfamart': { src: 'https://midtrans-website.al-mp-id-p.cdn.gtflabs.io/uploads/2020/09/0b49d7de63b2367e0515c1283060f64e_c16ca417c1f390206d3ccc6785df8f19_compressed.png' },
};

function getCourierBrand(courierCode: string) {
  const code = courierCode.toLowerCase();
  if (code.includes('jne')) return { src: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/JNE_HR.jpg' };
  if (code.includes('pos')) return { src: 'https://upload.wikimedia.org/wikipedia/commons/4/47/POSIND_2023_%28with_wordmark%29.svg' };
  if (code.includes('tiki')) return { src: 'https://cek-ongkir.id/static/images/tiki.png' };
  return null;
}

function createCheckoutKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function CheckoutHeader() {
  return (
    <header className={styles.checkoutHeader}>
      <nav className={styles.checkoutHeaderInner} aria-label="Navigasi checkout">
        <Link href="/" className={styles.checkoutBrand} aria-label="Wina Jaya beranda">WINA JAYA</Link>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </nav>
    </header>
  );
}

type CheckoutInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'placeholder' | 'className'> & {
  id: string;
  label: string;
  wrapperClassName?: string;
};

function CheckoutInput({ id, label, required, wrapperClassName, ...inputProps }: CheckoutInputProps) {
  return (
    <label className={`${styles.fieldGroup} ${wrapperClassName ?? ''}`} htmlFor={id}>
      <input id={id} className={styles.input} placeholder=" " required={required} {...inputProps} />
      <span>{label}{required && <b>*</b>}</span>
    </label>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart, isReady } = useCart();
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('address');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [shippingQuoteId, setShippingQuoteId] = useState('');
  const [openShippingCourier, setOpenShippingCourier] = useState<string | null>(null);
  const [openPaymentGroup, setOpenPaymentGroup] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderPreview, setOrderPreview] = useState<CheckoutOrderPreview | null>(null);
  const [orderPaymentStatus, setOrderPaymentStatus] = useState('pending');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentInstruction, setPaymentInstruction] = useState<PaymentInstruction | null>(null);
  const [paymentDeadline, setPaymentDeadline] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [copiedPaymentValue, setCopiedPaymentValue] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutKey, setCheckoutKey] = useState(createCheckoutKey);

  const selectedShippingQuote = useMemo(
    () => shippingQuotes.find((quote) => quote.id === shippingQuoteId) ?? null,
    [shippingQuoteId, shippingQuotes],
  );
  const shippingCourierGroups = useMemo(() => {
    const groups = new Map<string, ShippingQuote[]>();
    for (const quote of shippingQuotes) {
      const key = quote.courierCode.toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), quote]);
    }
    return Array.from(groups, ([key, quotes]) => ({ key, quotes }));
  }, [shippingQuotes]);
  const customerName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const recipientName = customerName;

  useEffect(() => {
    let active = true;
    fetch('/api/auth/access', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Status akun tidak tersedia.');
        return response.json() as Promise<{ data?: { signedIn?: boolean } }>;
      })
      .then((result) => { if (active) setIsSignedIn(Boolean(result.data?.signedIn)); })
      .catch(() => { if (active) setIsSignedIn(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!orderCreated || !orderId || isPaymentConfirmed) return;
    let active = true;
    let checking = false;
    const checkPaymentStatus = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json() as { data?: { status?: string; paymentStatus?: string; paymentInstruction?: PaymentInstruction | null; paymentExpiresAt?: string | null; paymentExpiresAtProvider?: string | null } };
        if (!active || !result.data) return;
        const status = result.data.paymentStatus ?? 'pending';
        setOrderPaymentStatus(status);
        if (result.data.paymentInstruction) setPaymentInstruction(result.data.paymentInstruction);
        setPaymentDeadline(result.data.paymentInstruction?.expiryTime ?? result.data.paymentExpiresAtProvider ?? result.data.paymentExpiresAt ?? null);
        const confirmed = ['paid', 'capture', 'settlement'].includes(status.toLowerCase())
          || result.data.status?.toUpperCase() === 'PAID';
        if (confirmed) setIsPaymentConfirmed(true);
      } catch {
        // Keep showing the pending state while the payment status endpoint is temporarily unavailable.
      } finally {
        checking = false;
      }
    };
    void checkPaymentStatus();
    const timer = window.setInterval(() => void checkPaymentStatus(), 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isPaymentConfirmed, orderCreated, orderId]);

  useEffect(() => {
    if (!isPaymentConfirmed) return;
    const timer = window.setTimeout(() => router.replace('/'), 3000);
    return () => window.clearTimeout(timer);
  }, [isPaymentConfirmed, router]);

  useEffect(() => {
    if (destinationSearch.trim().length < 3 || destination?.label === destinationSearch) {
      const timer = window.setTimeout(() => setDestinations([]), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/shipping/destinations?search=${encodeURIComponent(destinationSearch.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lokasi tidak ditemukan.');
        setDestinations(data.data ?? []);
      } catch {
        if (!controller.signal.aborted) setDestinations([]);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [destination?.label, destinationSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShippingQuotes([]);
      setShippingQuoteId('');
      setOpenShippingCourier(null);
      setShippingError('');
      setCheckoutKey(createCheckoutKey());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [destination, items]);

  useEffect(() => {
    let active = true;
    fetch('/api/account/profile', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ data?: { fullName?: string; email?: string; phone?: string } }>;
      })
      .then((result) => {
        if (!active || !result?.data) return;
        const profile = result.data;
        const nameParts = (profile.fullName ?? '').trim().split(/\s+/).filter(Boolean);
        setFirstName((current) => current || nameParts[0] || '');
        setLastName((current) => current || nameParts.slice(1).join(' '));
        setCustomerEmail((current) => current || profile.email || '');
        setCustomerPhone((current) => current || profile.phone || '');
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const calculateShipping = async () => {
    if (!destination) {
      setShippingError('Pilih lokasi tujuan dari hasil pencarian terlebih dahulu.');
      return;
    }
    setShippingLoading(true);
    setShippingError('');
    try {
      const response = await fetch('/api/shipping/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          items: items.map((item) => ({ productId: item.productId, qtyMeters: item.qtyMeters })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ongkir tidak dapat dihitung.');
      const quotes = data.data as ShippingQuote[];
      setShippingQuotes(quotes);
      setShippingQuoteId(quotes[0]?.id ?? '');
      setOpenShippingCourier(quotes[0]?.courierCode.toLowerCase() ?? null);
      if (!quotes.length) setShippingError('Tidak ada layanan pengiriman untuk alamat ini.');
    } catch (error) {
      setShippingQuotes([]);
      setShippingQuoteId('');
      setShippingError(error instanceof Error ? error.message : 'Ongkir tidak dapat dihitung.');
    } finally {
      setShippingLoading(false);
    }
  };

  const continueToDelivery = () => {
    const requiredFields = ['firstName', 'lastName', 'customerEmail', 'customerPhone', 'addressLine', 'postalCode', 'destinationSearch', 'province'];
    for (const fieldId of requiredFields) {
      const field = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | null;
      if (field && !field.reportValidity()) return;
    }
    if (!destination) {
      setShippingError('Pilih lokasi tujuan dari hasil pencarian terlebih dahulu.');
      return;
    }
    setShippingError('');
    setCheckoutStep('delivery');
    void calculateShipping();
  };

  const continueToPayment = () => {
    if (!selectedShippingQuote) {
      setShippingError('Pilih layanan pengiriman sebelum melanjutkan.');
      return;
    }
    setShippingError('');
    setCheckoutStep('payment');
  };

  const createPaymentSession = async (nextOrderId: string, method: PaymentMethod | null) => {
    if (!method) {
      setPaymentError('Pilih metode pembayaran terlebih dahulu.');
      return;
    }
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const response = await fetch('/api/payments/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: nextOrderId,
          method: method.type === 'bank_transfer'
            ? { type: method.type, bank: method.bank }
            : method.type === 'ewallet'
              ? { type: method.type, provider: method.provider }
              : method.type === 'cstore'
                ? { type: method.type, store: method.store }
                : { type: method.type },
        }),
      });
      const data = await response.json().catch(() => ({})) as { success?: boolean; data?: { instruction?: PaymentInstruction }; error?: string };
      if (!response.ok || !data.success || !data.data?.instruction) {
        throw new Error(data.error || 'Instruksi pembayaran belum dapat dibuat.');
      }
      setPaymentInstruction(data.data.instruction);
      setPaymentDeadline(data.data.instruction.expiryTime ?? null);
    } catch (error) {
      setPaymentInstruction(null);
      setPaymentError(error instanceof Error ? error.message : 'Instruksi pembayaran belum dapat dibuat.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      router.push('/login?redirectTo=%2Fcheckout');
      return;
    }
    if (items.length === 0 || !destination || !selectedShippingQuote) {
      setShippingError('Lengkapi alamat dan pilih layanan pengiriman sebelum membuat pesanan.');
      return;
    }
    if (!paymentMethod) {
      setCheckoutError('Pilih metode pembayaran sebelum membuat pesanan.');
      return;
    }

    setIsSubmitting(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          shippingQuoteId: selectedShippingQuote.id,
          items: items.map(i => ({
            productId: i.productId,
            variantId: i.variantId,
            qtyMeters: i.qtyMeters,
          })),
          shippingAddress: {
            recipientName,
            phone: customerPhone,
            addressLine,
            provinceId: destination.provinceId,
            provinceName: destination.provinceName,
            destinationId: destination.id,
            cityName: destination.cityName,
            districtName: destination.districtName,
            postalCode,
          },
        }),
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': checkoutKey },
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOrderId(data.data.id);
        setPaymentDeadline(data.data.paymentExpiresAt ?? null);
        setOrderNumber(data.data.orderNumber ?? data.data.id);
        setOrderPreview({
          customerName,
          customerEmail,
          customerPhone,
          courierName: selectedShippingQuote.courierName,
          serviceName: selectedShippingQuote.serviceName,
          items: items.map((item) => ({
            productName: item.productName,
            variantName: item.variantName ?? null,
            qtyMeters: item.qtyMeters,
            lineTotal: item.pricePerMeter * item.qtyMeters,
          })),
          subtotal: totalAmount,
          shippingCost: selectedShippingQuote.cost,
          grandTotal: totalAmount + selectedShippingQuote.cost,
        });
        setOrderCreated(true);
        clearCart();
        void createPaymentSession(data.data.id, paymentMethod);
      } else {
        setCheckoutError(data.error || 'Pesanan belum dapat dibuat. Periksa kembali data yang diisi.');
      }
    } catch {
      setCheckoutError('Gagal menghubungi server. Data pesanan belum dikirim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <div className={styles.main}><CheckoutHeader />
        <section className={styles.contentSection}>
          <div className={styles.emptyState}><p className={styles.emptyDesc}>Memuat keranjang Anda…</p></div>
        </section>
      </div>
    );
  }

  if (orderCreated) {
    return (
      <div className={styles.main}><CheckoutHeader />
        <section className={styles.orderPendingSection}>
          <div className={styles.orderPendingCard}>
          <h1 className={styles.orderPendingTitle}>Pembayaran</h1>
          <p className={styles.receiptLabel}>NOMOR PESANAN</p>
          <h2 className={styles.successHeading}>{orderNumber}</h2>
          {isPaymentConfirmed && <p className={styles.paymentSuccessNotice} role="status">Pembayaran sukses.</p>}
          {orderPreview && <div className={styles.orderPreview}>
            <div className={styles.orderPreviewHeader}>
              <div><strong>{orderPreview.customerName}</strong><span>{orderPreview.customerEmail} · {orderPreview.customerPhone}</span></div>
              <span className={styles.orderPreviewStatus}>{isPaymentConfirmed ? 'Pembayaran berhasil' : 'Menunggu pembayaran'}</span>
            </div>
            <div className={styles.orderPreviewItems}>{orderPreview.items.map((item, index) => <div className={styles.summaryItem} key={`${item.productName}-${index}`}>
              <span><strong>{item.productName}</strong><small>{item.variantName ? `${item.variantName} · ` : ''}{item.qtyMeters} meter</small></span>
              <strong>{formatRupiah(item.lineTotal)}</strong>
            </div>)}</div>
            <div className={styles.summaryRow}><span>Subtotal</span><span>{formatRupiah(orderPreview.subtotal)}</span></div>
            <div className={styles.summaryRow}><span>Pengiriman · {orderPreview.courierName} {orderPreview.serviceName}</span><span>{formatRupiah(orderPreview.shippingCost)}</span></div>
            <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><strong>Total</strong><strong>{formatRupiah(orderPreview.grandTotal)}</strong></div>
          </div>}
          <div className={styles.paymentInstruction}>
            <h3>{paymentMethod ? paymentMethod.label : 'Instruksi pembayaran'}</h3>
            {orderPaymentStatus !== 'pending' && !isPaymentConfirmed && <p className={styles.paymentStatus} role="status">Status pembayaran: {orderPaymentStatus}</p>}
            {paymentLoading && <p className={styles.paymentStatus} role="status">Menyiapkan instruksi pembayaran…</p>}
            {paymentInstruction && <>
              {paymentMethod?.type === 'bank_transfer' && (paymentInstruction.vaNumbers?.[0]?.va_number || paymentInstruction.permataVaNumber) && <div className={styles.instructionRow}>
                <span>Nomor Virtual Account</span>
                <strong>{paymentInstruction.vaNumbers?.[0]?.va_number ?? paymentInstruction.permataVaNumber}</strong>
                <button type="button" className={styles.copyButton} onClick={() => {
                  const value = paymentInstruction.vaNumbers?.[0]?.va_number ?? paymentInstruction.permataVaNumber ?? '';
                  void navigator.clipboard.writeText(value).then(() => setCopiedPaymentValue(value)).catch(() => setPaymentError('Nomor VA tidak dapat disalin di browser ini.'));
                }}>{copiedPaymentValue === (paymentInstruction.vaNumbers?.[0]?.va_number ?? paymentInstruction.permataVaNumber) ? 'Tersalin' : 'Salin'}</button>
              </div>}
              {paymentMethod?.type === 'qris' && <div className={styles.qrPayment}>
                <img src={`/api/orders/${encodeURIComponent(orderId)}/payment-qr`} alt="QR pembayaran QRIS" />
                <p>Pindai QRIS melalui aplikasi bank atau dompet digital Anda.</p>
              </div>}
              {paymentMethod?.type === 'cstore' && paymentInstruction.paymentCode && <div className={styles.instructionRow}>
                <span>Kode pembayaran</span><strong>{paymentInstruction.paymentCode}</strong>
                <button type="button" className={styles.copyButton} onClick={() => {
                  void navigator.clipboard.writeText(paymentInstruction.paymentCode ?? '').then(() => setCopiedPaymentValue(paymentInstruction.paymentCode ?? '')).catch(() => setPaymentError('Kode pembayaran tidak dapat disalin di browser ini.'));
                }}>{copiedPaymentValue === paymentInstruction.paymentCode ? 'Tersalin' : 'Salin'}</button>
              </div>}
              {paymentMethod?.type === 'ewallet' && paymentInstruction.actions.find((action) => /deeplink|redirect/i.test(action.name))?.url && <a className={styles.btnPrimary} href={paymentInstruction.actions.find((action) => /deeplink|redirect/i.test(action.name))?.url} target="_blank" rel="noopener noreferrer">Buka {paymentMethod.label}</a>}
              <p className={styles.paymentExpiry}>Batas pembayaran: {paymentInstruction.expiryTime || paymentDeadline
                ? new Date(paymentInstruction.expiryTime || paymentDeadline || '').toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
                : 'Sedang memuat batas pembayaran…'}</p>
              <p className={styles.paymentTotal}>Total pembayaran <strong>{formatRupiah(paymentInstruction.grossAmount || orderPreview?.grandTotal || 0)}</strong></p>
            </>}
            {!paymentLoading && !paymentInstruction && <button type="button" className={styles.btnPrimary} onClick={() => void createPaymentSession(orderId, paymentMethod)}>Coba siapkan instruksi lagi</button>}
          </div>
          {paymentError && <p className={styles.shippingError} role="alert">{paymentError}</p>}
          {!isPaymentConfirmed && <p className={styles.paymentNote}>Status pembayaran diperbarui otomatis setelah pembayaran dikonfirmasi.</p>}
          </div>
        </section>
      </div>
    );
  }

  if (isSignedIn === null) {
    return <div className={styles.main}><CheckoutHeader /><section className={styles.contentSection}><div className={styles.emptyState}><p className={styles.emptyDesc}>Memeriksa akun…</p></div></section></div>;
  }

  if (!isSignedIn) {
    return (
      <div className={styles.main}><CheckoutHeader />
        <section className={styles.orderPendingSection}>
          <div className={styles.orderPendingCard}>
            <h1 className={styles.orderPendingTitle}>Masuk untuk checkout</h1>
            <p className={styles.loginGateNotice}>Masuk ke akun agar pesanan tersimpan di riwayat profil Anda.</p>
            <Link href="/login?redirectTo=%2Fcheckout" className={styles.btnPrimary}>Masuk ke akun</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.main}>
      <CheckoutHeader />

      <section className={styles.contentSection}>
        {items.length === 0 ? (
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>Keranjang Kosong</h2>
            <p className={styles.emptyDesc}>Tambahkan produk ke keranjang sebelum melanjutkan checkout.</p>
            <Link href="/cart" className={styles.btnPrimary}>Kembali ke Keranjang</Link>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className={styles.layout}>
            <div className={styles.cartCol}>
              <section className={styles.checkoutStep}>
                <div className={styles.stepHeading}>
                  <h2>Alamat &amp; kontak</h2>
                  {checkoutStep !== 'address' && <span className={styles.sectionCheck} aria-label="Selesai">✓</span>}
                  {checkoutStep !== 'address' && <button type="button" className={styles.editStep} onClick={() => setCheckoutStep('address')}>Ubah</button>}
                </div>
                {checkoutStep === 'address' ? (
                  <div className={styles.stepBody}>
                    <div className={styles.formGrid}>
                      <CheckoutInput id="firstName" label="Nama depan" autoComplete="given-name" required minLength={1} maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                      <CheckoutInput id="lastName" label="Nama belakang" autoComplete="family-name" required minLength={1} maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                      <CheckoutInput id="addressLine" label="Alamat" autoComplete="shipping street-address" required minLength={10} maxLength={500} value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
                      <CheckoutInput id="postalCode" label="Kode pos" inputMode="numeric" autoComplete="shipping postal-code" required pattern="[0-9]{5}" value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))} />
                      <div className={`${styles.fieldGroup} ${styles.destinationField}`}>
                        <input id="destinationSearch" className={styles.input} autoComplete="off" required placeholder=" " value={destinationSearch} onChange={(e) => { setDestinationSearch(e.target.value); setDestination(null); }} />
                        <label htmlFor="destinationSearch" className={styles.floatingLabel}>Kota / kecamatan <b>*</b></label>
                        {destinations.length > 0 && <div className={styles.destinationResults}>{destinations.map((item) => <button type="button" key={item.id} className={styles.destinationOption} onClick={() => { setDestination(item); setDestinationSearch(item.label); if (item.postalCode) setPostalCode(item.postalCode); setDestinations([]); }}>{item.label}</button>)}</div>}
                      </div>
                      <CheckoutInput id="country" label="Negara" value="Indonesia" readOnly required />
                      <CheckoutInput id="province" label="Provinsi" value={destination?.provinceName ?? ''} readOnly required />
                      <CheckoutInput id="customerEmail" label="Email" type="email" autoComplete="email" required value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                      <CheckoutInput id="customerPhone" label="Nomor telepon" wrapperClassName={styles.phoneField} type="tel" autoComplete="tel" required minLength={6} maxLength={32} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                    </div>
                    {shippingError && <p className={styles.shippingError} role="alert">{shippingError}</p>}
                    <button type="button" className={styles.stepButton} onClick={continueToDelivery}>Lanjut ke pengiriman</button>
                  </div>
                ) : (
                  <div className={styles.stepSummary}>
                    <p><strong>{customerName}</strong> · {customerEmail} · {customerPhone}</p>
                    <p>{addressLine}, {destination?.label}, {postalCode}</p>
                  </div>
                )}
              </section>

              <section className={`${styles.checkoutStep} ${checkoutStep === 'address' ? styles.stepLocked : ''}`}>
                <div className={styles.stepHeading}>
                  <h2>Pengiriman</h2>
                  {checkoutStep === 'payment' && <span className={styles.sectionCheck} aria-label="Selesai">✓</span>}
                  {checkoutStep === 'payment' && <button type="button" className={styles.editStep} onClick={() => setCheckoutStep('delivery')}>Ubah</button>}
                </div>
                {checkoutStep === 'delivery' ? (
                  <div className={styles.stepBody}>
                    <p className={styles.stepHint}>Pilih layanan pengiriman untuk {destination?.label}.</p>
                    {shippingLoading && <p className={styles.stepHint} role="status" aria-live="polite">Memuat pilihan pengiriman…</p>}
                    {shippingError && <p className={styles.shippingError} role="alert">{shippingError}</p>}
                    {!shippingLoading && shippingError && <button type="button" className={styles.shippingButton} disabled={!destination} onClick={() => void calculateShipping()}>Coba hitung ulang</button>}
                    {shippingCourierGroups.length > 0 && <div className={styles.shippingGroups}>
                      {shippingCourierGroups.map(({ key, quotes }) => {
                        const courierName = quotes[0].courierName;
                        const brand = getCourierBrand(quotes[0].courierCode);
                        const isOpen = openShippingCourier === key;
                        const selectedQuote = quotes.find((quote) => quote.id === shippingQuoteId);
                        const panelId = `shipping-options-${key.replace(/[^a-z0-9_-]/g, '-')}`;
                        return <section className={styles.shippingGroup} key={key}>
                          <button
                            type="button"
                            className={`${styles.accordionTrigger} ${styles.courierTrigger}`}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() => setOpenShippingCourier((current) => current === key ? null : key)}
                          >
                            {brand ? <img className={styles.brandLogo} src={brand.src} alt="" /> : <span className={styles.brandFallback}>{courierName}</span>}
                            <span className={styles.courierName}>{courierName}</span>
                            <span className={styles.accordionSelection}>
                              {selectedQuote && <><span>{selectedQuote.serviceName} · {formatRupiah(selectedQuote.cost)}</span><span className={styles.selectionCheck} aria-label="Terpilih"><Check size={14} strokeWidth={2.5} /></span></>}
                              <ChevronDown className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ''}`} size={18} aria-hidden="true" />
                            </span>
                          </button>
                          {isOpen && <div id={panelId} className={styles.shippingOptions}>
                            {quotes.map((quote) => {
                              const isSelected = shippingQuoteId === quote.id;
                              return <button
                                type="button"
                                className={`${styles.shippingOption} ${isSelected ? styles.shippingOptionSelected : ''}`}
                                key={quote.id}
                                aria-pressed={isSelected}
                                onClick={() => { setShippingQuoteId(quote.id); setCheckoutKey(createCheckoutKey()); }}
                              >
                                <span className={styles.shippingService}><strong>{quote.serviceName}</strong><small>{quote.detail ?? 'Estimasi layanan pengiriman'}</small></span>
                                <strong className={styles.shippingCost}>{formatRupiah(quote.cost)}</strong>
                                <span className={`${styles.selectionCheck} ${isSelected ? styles.selectionCheckVisible : ''}`} aria-hidden={!isSelected}>{isSelected && <Check size={14} strokeWidth={2.5} />}</span>
                              </button>;
                            })}
                          </div>}
                        </section>;
                      })}
                    </div>}
                    <button type="button" className={styles.stepButton} disabled={!selectedShippingQuote} onClick={continueToPayment}>Lanjut ke pembayaran</button>
                  </div>
                ) : checkoutStep === 'payment' && selectedShippingQuote ? (
                  <div className={styles.stepSummary}><p>{selectedShippingQuote.courierName} · {selectedShippingQuote.serviceName}</p><p>{formatRupiah(selectedShippingQuote.cost)}</p></div>
                ) : checkoutStep === 'address' ? (
                  <p className={styles.stepHint}>Lengkapi alamat untuk memilih layanan pengiriman.</p>
                ) : (
                  <div className={styles.stepBody}>
                    <p className={styles.stepHint}>Pilih metode pengiriman terlebih dahulu.</p>
                    <button type="button" className={styles.stepButton} onClick={() => setCheckoutStep('delivery')}>Pilih pengiriman</button>
                  </div>
                )}
              </section>

              <section className={`${styles.checkoutStep} ${checkoutStep !== 'payment' ? styles.stepLocked : ''}`}>
                <div className={styles.stepHeading}>
                  <h2>Pembayaran</h2>
                </div>
                {checkoutStep === 'payment' ? (
                  <div className={styles.stepBody}>
                    <p className={styles.stepHint}>Pilih cara pembayaran. Instruksi pembayaran akan ditampilkan di halaman ini setelah pesanan dibuat.</p>
                    <div className={styles.paymentGroups}>
                      {paymentMethodGroups.map((group) => {
                        const groupId = `payment-${group.methods[0].key}`;
                        const isOpen = openPaymentGroup === groupId;
                        const selectedMethod = group.methods.find((method) => method.key === paymentMethod?.key);
                        return <section className={styles.paymentGroup} key={group.title}>
                          <button
                            type="button"
                            className={styles.accordionTrigger}
                            aria-expanded={isOpen}
                            aria-controls={groupId}
                            onClick={() => setOpenPaymentGroup((current) => current === groupId ? null : groupId)}
                          >
                            <span className={styles.accordionTitle}>{group.title}</span>
                            <span className={styles.accordionSelection}>
                              {selectedMethod && <><span>{selectedMethod.label}</span><span className={styles.selectionCheck} aria-label="Terpilih"><Check size={14} strokeWidth={2.5} /></span></>}
                              <ChevronDown className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ''}`} size={18} aria-hidden="true" />
                            </span>
                          </button>
                          {isOpen && <div className={styles.paymentChoices} id={groupId}>
                            {group.methods.map((method) => {
                              const isSelected = paymentMethod?.key === method.key;
                              return <button
                                type="button"
                                className={styles.paymentChoice}
                                key={method.key}
                                aria-pressed={isSelected}
                                onClick={() => { setPaymentMethod(method); setCheckoutError(''); }}
                              >
                                <img className={styles.paymentLogo} src={paymentBrandMarks[method.key].src} alt="" />
                                <span className={styles.paymentLabel}>{method.label}</span>
                                <span className={`${styles.selectionCheck} ${isSelected ? styles.selectionCheckVisible : ''}`} aria-hidden={!isSelected}>{isSelected && <Check size={14} strokeWidth={2.5} />}</span>
                              </button>;
                            })}
                          </div>}
                        </section>;
                      })}
                    </div>
                    {checkoutError && <p className={styles.shippingError} role="alert">{checkoutError}</p>}
                    <button type="submit" className={styles.stepButton} disabled={isSubmitting || !selectedShippingQuote || !paymentMethod}>
                      {isSubmitting ? 'Menyimpan pesanan...' : 'Buat pesanan & tampilkan instruksi'}
                    </button>
                  </div>
                ) : (
                  <p className={styles.stepHint}>Selesaikan alamat dan pengiriman untuk melanjutkan.</p>
                )}
              </section>
            </div>

            <div className={styles.summaryCol}>
              <div className={styles.summaryBlock}>
                <h3 className={styles.summaryTitle}>Di keranjang</h3>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>{formatRupiah(totalAmount)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Pengiriman</span>
                  <span className={selectedShippingQuote ? '' : styles.tbd}>{selectedShippingQuote ? formatRupiah(selectedShippingQuote.cost) : 'Pilih layanan'}</span>
                </div>
                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>Total</span>
                  <span>{formatRupiah(totalAmount + (selectedShippingQuote?.cost ?? 0))}</span>
                </div>
                <div className={styles.summaryItems}>{items.map((item) => <div className={styles.summaryItem} key={`${item.productId}-${item.variantId}`}>
                  {item.imageUrl && <Image src={item.imageUrl} alt="" width={64} height={64} sizes="64px" />}
                  <span><strong>{item.productName}</strong><small>{item.variantName ? `${item.variantName} · ` : ''}{item.qtyMeters} meter</small></span>
                  <strong>{formatRupiah(item.pricePerMeter * item.qtyMeters)}</strong>
                </div>)}</div>
              </div>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}


