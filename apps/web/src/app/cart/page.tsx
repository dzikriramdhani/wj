'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import styles from './page.module.css';

const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

function CartQuantityControl({
  productName,
  quantity,
  minimum,
  onChange,
  onMinimumAttempt,
  onValidChange,
}: {
  productName: string;
  quantity: number;
  minimum: number;
  onChange: (quantity: number) => void;
  onMinimumAttempt: () => void;
  onValidChange: () => void;
}) {
  const [draft, setDraft] = useState(String(quantity));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(String(quantity));
  }, [isEditing, quantity]);

  const setQuantity = (nextQuantity: number) => {
    onChange(nextQuantity);
    setDraft(String(nextQuantity));
    onValidChange();
  };
  const isValidMeterValue = (value: string) => /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value)
    && Number.isFinite(Number(value));

  return (
    <div className={styles.quantityControl} role="group" aria-label={'Jumlah ' + productName}>
      <button
        type="button"
        aria-label="Kurangi jumlah"
        onClick={() => {
          if (quantity <= minimum) {
            onMinimumAttempt();
            return;
          }
          setQuantity(Math.max(minimum, Number((quantity - 1).toFixed(2))));
        }}
      >−</button>
      <input
        type="number"
        min={minimum}
        step="0.01"
        inputMode="decimal"
        aria-label={'Jumlah meter ' + productName}
        value={draft}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => {
          const value = event.currentTarget.value;
          setDraft(value);
          if (!isValidMeterValue(value)) return;
          const nextQuantity = Number(value);
          if (nextQuantity < minimum) {
            onMinimumAttempt();
            return;
          }
          onChange(nextQuantity);
          onValidChange();
        }}
        onBlur={() => {
          setIsEditing(false);
          const nextQuantity = Number(draft);
          if (!isValidMeterValue(draft) || nextQuantity < minimum) {
            if (draft && Number.isFinite(nextQuantity) && nextQuantity < minimum) onMinimumAttempt();
            setDraft(String(quantity));
            return;
          }
          setQuantity(Number(nextQuantity.toFixed(2)));
        }}
      />
      <button
        type="button"
        aria-label="Tambah jumlah"
        onClick={() => setQuantity(Number((quantity + 1).toFixed(2)))}
      >+</button>
    </div>
  );
}

export default function CartPage() {
  const { items, removeItem, updateQty, totalAmount, isReady } = useCart();
  const [minimumNotices, setMinimumNotices] = useState<string[]>([]);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/access', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Status akun tidak tersedia');
        return response.json() as Promise<{ data?: { signedIn?: boolean } }>;
      })
      .then((result) => { if (active) setIsSignedIn(Boolean(result.data?.signedIn)); })
      .catch(() => { if (active) setIsSignedIn(false); });
    return () => { active = false; };
  }, []);

  if (!isReady) {
    return <div className={styles.main}><p className={styles.loading}>Memuat keranjang…</p></div>;
  }

  if (items.length === 0) {
    return (
      <div className={styles.main}>
        <section className={styles.emptyState}>
          <h1>Keranjang Anda kosong</h1>
          <p>Pilih kain dari katalog untuk mulai berbelanja.</p>
          <Link href="/products" className={styles.primaryLink}>Lihat katalog <ArrowUpRight size={16} strokeWidth={1.6} /></Link>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.main}>
      <div className={styles.layout}>
        <section className={styles.itemsColumn} aria-label="Produk di keranjang">
          {isSignedIn === false && <>
            <div className={styles.signInPrompt}>
              <div>
                <h2>Sudah memiliki akun?</h2>
                <p>Masuk sebelum checkout agar pesanan tersimpan di riwayat akun.</p>
              </div>
              <Link href="/login?redirectTo=%2Fcheckout" className={styles.signInButton}>Masuk</Link>
            </div>
            <div className={styles.divider} />
          </>}

          <div className={styles.cartTitleRow}>
            <h1>Keranjang</h1>
          </div>
          <div className={styles.tableHeader} aria-hidden="true">
            <span>Produk</span><span /><span>Jumlah</span><span className={styles.priceHeading}>Harga</span><span className={styles.totalHeading}>Total</span>
          </div>
          {items.map((item) => {
            const minimum = Math.max(item.minQtyMeters ?? 1, 0.01);
            const noticeKey = `${item.productId}-${item.variantId ?? ''}`;
            return (
              <article className={styles.item} key={noticeKey}>
                <div className={styles.itemImage} aria-hidden="true">
                  {item.imageUrl ? <Image src={item.imageUrl} alt="" width={96} height={96} sizes="(max-width: 767px) 64px, (max-width: 1023px) 80px, 96px" /> : <span>{item.category}</span>}
                </div>
                <div className={styles.itemInfo}>
                  <h2>{item.productName}</h2>
                  {item.variantName && <p>{item.variantName}</p>}
                </div>
                <div className={styles.itemActions}>
                  <div className={styles.quantityCell}>
                    <div className={styles.quantityRow}>
                      <button
                        type="button"
                        className={styles.removeButton}
                        aria-label={'Hapus ' + item.productName + ' dari keranjang'}
                        onClick={() => removeItem(item.productId, item.variantId)}
                      ><Trash2 size={18} strokeWidth={1.6} /></button>
                      <CartQuantityControl
                        productName={item.productName}
                        quantity={item.qtyMeters}
                        minimum={minimum}
                        onChange={(quantity) => updateQty(item.productId, quantity, item.variantId)}
                        onMinimumAttempt={() => setMinimumNotices((current) => current.includes(noticeKey) ? current : [...current, noticeKey])}
                        onValidChange={() => setMinimumNotices((current) => current.filter((key) => key !== noticeKey))}
                      />
                    </div>
                    {minimumNotices.includes(noticeKey) && (
                      <p className={styles.minimumNotice} role="status">Minimum pemesanan: {minimum.toLocaleString('id-ID')} meter.</p>
                    )}
                  </div>
                  <span className={styles.unitPrice}>{formatRupiah(item.pricePerMeter)} / meter</span>
                  <strong className={styles.lineTotal}>{formatRupiah(item.pricePerMeter * item.qtyMeters)}</strong>
                </div>
              </article>
            );
          })}
        </section>

        <aside className={styles.summary}>
          <h2>Ringkasan</h2>
          <div className={styles.summaryRows}>
            <div className={styles.summaryRow}><span>Subtotal</span><span>{formatRupiah(totalAmount)}</span></div>
            <div className={styles.summaryRow}><span>Pengiriman</span><span>Dihitung saat checkout</span></div>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryTotal}><span>Total</span><strong>{formatRupiah(totalAmount)}</strong></div>
          <div className={styles.summaryDivider} />
          <p>Ongkos kirim dihitung setelah alamat pengiriman diisi.</p>
          <Link href={isSignedIn === false ? '/login?redirectTo=%2Fcheckout' : '/checkout'} className={styles.checkoutLink}>{isSignedIn === false ? 'Masuk untuk checkout' : 'Lanjut ke checkout'}</Link>
        </aside>
      </div>
    </div>
  );
}
