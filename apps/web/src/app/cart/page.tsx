'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import styles from './page.module.css';

const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

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
            const minimum = Math.max(item.minQtyMeters ?? 10, 1);
            const noticeKey = `${item.productId}-${item.variantId ?? ''}`;
            return (
              <article className={styles.item} key={noticeKey}>
                <div className={styles.itemImage} aria-hidden="true">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>{item.category}</span>}
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
                      <div className={styles.quantityControl} role="group" aria-label={'Jumlah ' + item.productName}>
                        <button
                          type="button"
                          aria-label="Kurangi jumlah"
                          onClick={() => {
                            const nextQuantity = Math.max(minimum, item.qtyMeters - 10);
                            if (nextQuantity === item.qtyMeters) {
                              setMinimumNotices((current) => current.includes(noticeKey) ? current : [...current, noticeKey]);
                              return;
                            }
                            setMinimumNotices((current) => current.filter((key) => key !== noticeKey));
                            updateQty(item.productId, nextQuantity, item.variantId);
                          }}
                        >−</button>
                        <span>{item.qtyMeters} meter</span>
                        <button
                          type="button"
                          aria-label="Tambah jumlah"
                          onClick={() => {
                            setMinimumNotices((current) => current.filter((key) => key !== noticeKey));
                            updateQty(item.productId, item.qtyMeters + 10, item.variantId);
                          }}
                        >+</button>
                      </div>
                    </div>
                    {minimumNotices.includes(noticeKey) && (
                      <p className={styles.minimumNotice} role="status">Minimum pemesanan: {minimum} meter.</p>
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
