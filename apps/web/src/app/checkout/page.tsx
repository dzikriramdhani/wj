'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { useCart } from '@/lib/cart-context';
import { usePaymentsSandbox } from '@/app/SiteShell';
import { Trash2 } from 'lucide-react';

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
  courierName: string;
  serviceName: string;
  cost: number;
  detail: string | null;
};

function createCheckoutKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export default function CheckoutPage() {
  const { items, removeItem, updateQty, totalAmount, clearCart, isReady } = useCart();
  const paymentsSandbox = usePaymentsSandbox();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [shippingQuoteId, setShippingQuoteId] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutKey, setCheckoutKey] = useState(createCheckoutKey);

  const selectedShippingQuote = useMemo(
    () => shippingQuotes.find((quote) => quote.id === shippingQuoteId) ?? null,
    [shippingQuoteId, shippingQuotes],
  );

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
        setCustomerName((current) => current || profile.fullName || '');
        setCustomerEmail((current) => current || profile.email || '');
        setCustomerPhone((current) => current || profile.phone || '');
        setRecipientName((current) => current || profile.fullName || '');
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
      if (!quotes.length) setShippingError('Tidak ada layanan pengiriman untuk alamat ini.');
    } catch (error) {
      setShippingQuotes([]);
      setShippingQuoteId('');
      setShippingError(error instanceof Error ? error.message : 'Ongkir tidak dapat dihitung.');
    } finally {
      setShippingLoading(false);
    }
  };

  const createPaymentSession = async (nextOrderId: string) => {
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const response = await fetch('/api/payments/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: nextOrderId }),
      });
      const data = await response.json().catch(() => ({})) as { success?: boolean; data?: { paymentUrl?: string }; error?: string };
      if (!response.ok || !data.success || !data.data?.paymentUrl) {
        throw new Error(data.error || 'Halaman pembayaran belum dapat dibuat.');
      }
      setPaymentUrl(data.data.paymentUrl);
    } catch (error) {
      setPaymentUrl(null);
      setPaymentError(error instanceof Error ? error.message : 'Halaman pembayaran belum dapat dibuat.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !destination || !selectedShippingQuote) {
      setShippingError('Lengkapi alamat dan pilih layanan pengiriman sebelum membuat pesanan.');
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
        setOrderNumber(data.data.orderNumber ?? data.data.id);
        setIsSuccess(true);
        clearCart();
        void createPaymentSession(data.data.id);
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
      <div className={styles.main}>
        <section className={styles.contentSection}>
          <div className={styles.emptyState}><p className={styles.emptyDesc}>Memuat keranjang Andaâ€¦</p></div>
        </section>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className={styles.main}>
        <section className={styles.heroSection}>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>Pesanan<br/>Dibuat</h1>
          </div>
        </section>
        <section className={styles.successSection}>
          <div className={styles.successIcon}>âœ“</div>
          <h2 className={styles.successHeading}>{orderNumber}</h2>
          <p className={styles.successDesc}>
            Pesanan Anda sudah tersimpan. Selesaikan pembayaran{paymentsSandbox ? ' Midtrans Sandbox' : ' melalui Midtrans'} agar pesanan dapat diteruskan ke warehouse{paymentsSandbox ? '. Ini bukan settlement produksi.' : '.'}
          </p>
          <div className={styles.successActions}>
            {paymentLoading && <span className={styles.paymentStatus}>Menyiapkan halaman pembayaran amanâ€¦</span>}
            {paymentUrl && <a href={paymentUrl} className={styles.btnPrimary}>Lanjut ke Pembayaran</a>}
            {!paymentLoading && !paymentUrl && <button type="button" className={styles.btnPrimary} onClick={() => void createPaymentSession(orderId)}>Coba Siapkan Pembayaran Lagi</button>}
            <Link href={`/orders/${encodeURIComponent(orderId)}`} className={styles.btnOutline}>Lacak Pesanan</Link>
            <Link href="/products" className={styles.btnOutline}>Lanjut Belanja</Link>
          </div>
          {paymentError && <p className={styles.shippingError} role="alert">{paymentError}</p>}
          <p className={styles.paymentNote}>Lacak pesanan dari perangkat ini atau setelah masuk ke akun Anda.</p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.main}>
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Checkout</h1>
        </div>
      </section>

      <section className={styles.contentSection}>
        {items.length === 0 ? (
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>Keranjang Kosong</h2>
            <p className={styles.emptyDesc}>Anda belum menambahkan produk ke keranjang.</p>
            <Link href="/products" className={styles.btnPrimary}>Lihat Katalog</Link>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className={styles.layout}>
            {/* Cart Items */}
            <div className={styles.cartCol}>
              <h2 className={styles.sectionTitle}>Keranjang ({items.length} jenis kain)</h2>
              <div className={styles.cartList}>
                {items.map((item) => (
                  <div key={`${item.productId}-${item.variantId}`} className={styles.cartItem}>
                    <div className={styles.cartItemImage}>
                      {item.category}
                    </div>
                    
                    <div className={styles.cartItemInfo}>
                      <h3 className={styles.cartItemName}>{item.productName}</h3>
                      <p className={styles.cartItemMeta}>
                        {item.variantName ? `Varian: ${item.variantName}` : item.category}
                      </p>
                    </div>
                    
                    <div className={styles.cartItemActions}>
                      <div className={styles.qtyControl}>
                        <select
                          className={styles.qtySelect}
                          value={item.qtyMeters}
                          onChange={(e) => updateQty(item.productId, parseInt(e.target.value), item.variantId)}
                        >
                          {Array.from({ length: 10 }, (_, i) => {
                            const val = Math.max(item.minQtyMeters ?? 1, 10) + (i * 10);
                            return <option key={val} value={val}>{val} m</option>;
                          })}
                        </select>
                      </div>
                      
                      <span className={styles.lineTotal}>{formatRupiah(item.pricePerMeter * item.qtyMeters)}</span>
                      
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className={styles.removeBtn}
                        aria-label="Hapus item"
                      >
                        <Trash2 size={18} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Checkout Forms (Medusa style puts this on the left) */}
              <div className={styles.formSection}>
                <h2 className={styles.sectionTitle}>Detail Pengiriman</h2>
                
                <div className={styles.customerBlock}>

                <h3 className={styles.addressTitle}>Informasi Pemesan *</h3>
                <label className={styles.fieldLabel} htmlFor="customerName">Nama lengkap</label>
                <input id="customerName" className={styles.input} autoComplete="name" required minLength={2} maxLength={100} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <label className={styles.fieldLabel} htmlFor="customerEmail">Email</label>
                <input id="customerEmail" className={styles.input} type="email" autoComplete="email" required value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                <label className={styles.fieldLabel} htmlFor="customerPhone">Nomor telepon</label>
                <input id="customerPhone" className={styles.input} type="tel" autoComplete="tel" required minLength={6} maxLength={32} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              
                </div>

                <div className={styles.addressBlock}>

                <h3 className={styles.addressTitle}>Alamat Pengiriman *</h3>
                <label className={styles.fieldLabel} htmlFor="recipientName">Nama penerima</label>
                <input id="recipientName" className={styles.input} autoComplete="shipping name" required minLength={2} maxLength={120} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                <label className={styles.fieldLabel} htmlFor="destinationSearch">Kota atau kecamatan</label>
                <input id="destinationSearch" className={styles.input} autoComplete="shipping address-level2" required value={destinationSearch} onChange={(e) => { setDestinationSearch(e.target.value); setDestination(null); }} placeholder="Contoh: Bandung" />
                {destinations.length > 0 && (
                  <div className={styles.destinationResults}>
                    {destinations.map((item) => (
                      <button type="button" key={item.id} className={styles.destinationOption} onClick={() => {
                        setDestination(item);
                        setDestinationSearch(item.label);
                        if (item.postalCode) setPostalCode(item.postalCode);
                        setDestinations([]);
                      }}>{item.label}</button>
                    ))}
                  </div>
                )}
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  required
                  minLength={10}
                  placeholder="Jl. Raya Industri No. 88, Bandung..."
                ></textarea>
                <label className={styles.fieldLabel} htmlFor="postalCode">Kode pos</label>
                <input id="postalCode" className={styles.input} inputMode="numeric" autoComplete="shipping postal-code" required pattern="[0-9]{5}" value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))} />
                <button type="button" className={styles.shippingButton} disabled={shippingLoading || !destination} onClick={calculateShipping}>
                  {shippingLoading ? 'Menghitung ongkir...' : 'Hitung ongkir'}
                </button>
                {shippingError && <p className={styles.shippingError} role="alert">{shippingError}</p>}
                {shippingQuotes.length > 0 && <div className={styles.shippingOptions}>
                  {shippingQuotes.map((quote) => <label className={styles.shippingOption} key={quote.id}>
                    <input type="radio" name="shippingQuote" value={quote.id} checked={shippingQuoteId === quote.id} onChange={() => { setShippingQuoteId(quote.id); setCheckoutKey(createCheckoutKey()); }} />
                    <span><strong>{quote.courierName} Â· {quote.serviceName}</strong><small>{quote.detail ?? 'Tarif terverifikasi RajaOngkir'}</small></span>
                    <strong>{formatRupiah(quote.cost)}</strong>
                  </label>)}
                </div>}
              
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className={styles.summaryCol}>
              <div className={styles.summaryBlock}>
                <h3 className={styles.summaryTitle}>Ringkasan</h3>
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
                <button type="submit" className={styles.checkoutBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan pesanan...' : 'Buat Pesanan & Lanjut Bayar'}
              </button>
{checkoutError && <p className={styles.shippingError} role="alert">{checkoutError}</p>}
              <p className={styles.paymentNote}>Pesanan disimpan terlebih dahulu. Setelah itu, pembayaran dilakukan melalui halaman aman Midtrans.</p>
              </div>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}


