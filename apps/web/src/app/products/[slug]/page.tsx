'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './page.module.css';
import { useCart } from '@/lib/cart-context';

// MOCK DATA FALLBACK
const mockProducts = [
  { id: '1', slug: 'katun-combed-30s', name: 'Katun Combed 30s', category: 'Katun', sku: 'KTN-CMB-30S', description: 'Kain katun combed 30s dengan kualitas premium, sangat lembut dan menyerap keringat. Cocok untuk kaos distro dan pakaian sehari-hari.', composition: '100% Cotton', gsm: 150, width: 42, moq: 10, price: 65000, stock: 1000, variants: [{name: 'Black', color:'#000000', stock: 500}, {name: 'White', color:'#ffffff', stock: 300}, {name: 'Red', color:'#ff0000', stock: 200}] },
  { id: '2', slug: 'poly-micro', name: 'Polyester Micro', category: 'Polyester', sku: 'PLY-MCR-01', description: 'Kain polyester micro yang ringan, jatuh, dan tidak mudah kusut.', composition: '100% Polyester', gsm: 110, width: 44, moq: 20, price: 45000, stock: 500, variants: [{name: 'Navy', color:'#000080', stock: 300}, {name: 'Grey', color:'#808080', stock: 200}] },
  { id: '3', slug: 'rayon-viscose', name: 'Rayon Viscose', category: 'Rayon', sku: 'RYN-VSC-01', description: 'Rayon viscose dengan tekstur lembut, adem dan jatuh di badan. Sangat cocok untuk kemeja, daster, dan mukena.', composition: '100% Rayon', gsm: 120, width: 44, moq: 20, price: 55000, stock: 0, variants: [{name: 'Pink', color:'#ffc0cb', stock: 0}, {name: 'Green', color:'#008000', stock: 0}] },
  { id: '4', slug: 'denim-14oz', name: 'Raw Denim 14oz', category: 'Denim', sku: 'DNM-RAW-14', description: 'Raw denim tebal 14oz, kaku dan siap untuk fading yang memukau.', composition: '100% Cotton', gsm: 400, width: 58, moq: 5, price: 0, stock: 200, variants: [{name: 'Indigo', color:'#00008b', stock: 200}] },
];

type DetailVariant = { id?: string; name: string; color: string; stock: number };
type DetailProduct = {
  id: string; slug: string; name: string; category: string; sku: string; description: string;
  composition: string; gsm: number; width: number; moq: number; price: number; stock: number;
  isCustomOnly?: boolean; images?: string[]; certifications?: string[]; variants: DetailVariant[];
};

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const getCategoryGradient = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'katun': return 'linear-gradient(135deg, #d4c9b0, #c2b49a)';
    case 'polyester': return 'linear-gradient(135deg, #a0bacc, #7899b2)';
    case 'rayon': return 'linear-gradient(135deg, #c8e6c9, #a5d6a7)';
    case 'denim': return 'linear-gradient(135deg, #3f51b5, #1a237e)';
    case 'linen': return 'linear-gradient(135deg, #d7ccc8, #8d6e63)';
    case 'spandex': return 'linear-gradient(135deg, #424242, #212121)';
    default: return 'linear-gradient(135deg, #eeeeee, #cccccc)';
  }
};

export default function ProductDetailPage() {
  const params = useParams();
  const { addItem } = useCart();
  const slug = params?.slug as string;
  const [product, setProduct] = useState<DetailProduct | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<DetailProduct[]>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ? [] : mockProducts,
  );
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [cartToast, setCartToast] = useState<{ productName: string; variantName?: string; qtyMeters: number } | null>(null);
  const cartToastTimeout = useRef<number | null>(null);

  useEffect(() => () => {
    if (cartToastTimeout.current !== null) window.clearTimeout(cartToastTimeout.current);
  }, []);

  useEffect(() => {
    if (!slug) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const timer = window.setTimeout(() => {
        setProduct(mockProducts.find((item) => item.slug === slug) ?? null);
        setIsLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let active = true;
    Promise.all([
      fetch(`/api/products/${encodeURIComponent(slug)}`).then(async (response) => {
        if (!response.ok) throw new Error('Product not found');
        return response.json();
      }),
      fetch('/api/products?limit=50').then(async (response) => {
        if (!response.ok) throw new Error('Catalog unavailable');
        return response.json();
      }),
    ])
      .then(([detail, catalog]) => {
        if (!active) return;
        const mapProduct = (item: {
          id: string; slug: string; name: string; category: string; sku: string; description: string;
          composition: string; gsm: number; widthCm: number; moqRetail: number; pricePerMeter: number;
          isCustomOnly: boolean; isAvailable: boolean; images?: string[]; certifications?: string[];
          variants: Array<{ id: string; colorName: string; colorHex?: string }>;
        }): DetailProduct => ({
          id: item.id,
          slug: item.slug,
          name: item.name,
          category: item.category,
          sku: item.sku,
          description: item.description,
          composition: item.composition,
          gsm: item.gsm,
          width: item.widthCm / 2.54,
          moq: item.moqRetail,
          price: item.pricePerMeter,
          stock: item.isAvailable ? 1 : 0,
          isCustomOnly: item.isCustomOnly,
          images: item.images ?? [],
          certifications: item.certifications ?? [],
          variants: item.variants.map((variant) => ({
            id: variant.id,
            name: variant.colorName,
            color: variant.colorHex ?? '#d4c9b0',
            stock: 0,
          })),
        });
        setProduct(mapProduct(detail.product));
        setCatalogProducts((catalog.products ?? []).map(mapProduct));
      })
      .catch(() => {
        if (active) {
          setProduct(null);
          setCatalogProducts([]);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  const handleAddToCart = () => {
    if (!product || product.price <= 0) return;
    const variant = product.variants[selectedVariant];
    addItem({
      productId: product.id,
      productName: product.name,
      variantId: variant?.id,
      variantName: variant?.name,
      imageUrl: product.images?.[0],
      category: product.category,
      qtyMeters: product.moq,
      minQtyMeters: product.moq,
      pricePerMeter: product.price,
    });
    setCartToast({ productName: product.name, variantName: variant?.name, qtyMeters: product.moq });
    if (cartToastTimeout.current !== null) window.clearTimeout(cartToastTimeout.current);
    cartToastTimeout.current = window.setTimeout(() => setCartToast(null), 4200);
  };

  if (!product) {
    return (
      <main className={styles.pageWrapper}>
        <div className={styles.main}>
          <p className={styles.pageMessage} role={isLoading ? 'status' : 'alert'}>
            {isLoading ? 'Memuat detail produk…' : 'Produk tidak ditemukan.'}
          </p>
        </div>
      </main>
    );
  }

  const relatedProducts = catalogProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 3);
  if (relatedProducts.length < 3) {
    const others = catalogProducts.filter(p => p.id !== product.id && !relatedProducts.find(r => r.id === p.id)).slice(0, 3 - relatedProducts.length);
    relatedProducts.push(...others);
  }

  return (
    <div className={styles.pageWrapper}>
      <main className={styles.main}>
        <div className={styles.layout} data-testid="product-detail-layout">
          <section className={styles.productInfo} aria-labelledby="product-title">
            {product.category && <p className={styles.productCategory}>{product.category}</p>}
            <h1 id="product-title" className={styles.productName}>{product.name}</h1>
            <p className={styles.description}>{product.description}</p>

            <div className={styles.detailsList}>
              <details className={styles.detailDisclosure}>
                <summary className={styles.detailSummary}>
                  <span>Informasi Produk</span>
                  <span className={styles.disclosureIcon} aria-hidden="true">+</span>
                </summary>
                <div className={styles.specsGrid}>
                  <div className={styles.specsColumn}>
                    <div className={styles.specItem}><strong>Komposisi</strong><p>{product.composition || '—'}</p></div>
                    <div className={styles.specItem}><strong>Lebar kain</strong><p>{product.width ? `${product.width} inch` : '—'}</p></div>
                  </div>
                  <div className={styles.specsColumn}>
                    <div className={styles.specItem}><strong>Gramasi</strong><p>{product.gsm ? `${product.gsm} gsm` : '—'}</p></div>
                    {product.certifications?.length ? <div className={styles.specItem}><strong>Sertifikasi</strong><p>{product.certifications.join(', ')}</p></div> : null}
                  </div>
                </div>
              </details>

              <details className={styles.detailDisclosure}>
                <summary className={styles.detailSummary}>
                  <span>Pengiriman &amp; Retur</span>
                  <span className={styles.disclosureIcon} aria-hidden="true">+</span>
                </summary>
                <p className={styles.shippingCopy}>
                  Ongkir dihitung saat checkout berdasarkan tujuan dan layanan yang tersedia. Untuk bantuan retur atau pertanyaan pesanan, hubungi tim Wina Jaya.
                </p>
              </details>
            </div>
          </section>

          <section className={styles.gallery} aria-label={'Galeri ' + product.name}>
            <div className={styles.galleryImages}>
              {(product.images?.length ? product.images : Array.from({ length: 4 }, () => ''))
                .map((imageUrl, imageIndex) => (
                  <figure className={styles.galleryImage} key={imageUrl || imageIndex}>
                    {imageUrl ? (
                      <Image
                        className={styles.productImage}
                        src={imageUrl}
                        alt={`${product.name} — tampilan ${imageIndex + 1}`}
                        fill
                        sizes="(max-width: 720px) 100vw, (max-width: 1024px) 65vw, 56vw"
                        priority={imageIndex === 0}
                      />
                    ) : (
                      <div
                        className={styles.imagePlaceholder}
                        role="img"
                        aria-label={'Contoh material ' + product.name}
                        style={{ '--material-color': getCategoryGradient(product.category) } as React.CSSProperties}
                      >
                        <span className={styles.fabricSample} aria-hidden="true" />
                        <span className={styles.imageCaption}>WINA JAYA <span aria-hidden="true">/</span> MATERIAL STUDY</span>
                      </div>
                    )}
                  </figure>
                ))}
            </div>
          </section>

          <aside className={styles.purchasePanel} aria-label="Pilih varian dan pesan produk">
            <div className={styles.variantsSection}>
              <div className={styles.variantHeading}>
                <h2 className={styles.sectionTitle}>Pilih warna</h2>
              </div>
              <div className={styles.colorGrid}>
                {product.variants.map((v, i) => (
                  <button
                    key={i}
                    className={styles.colorOption + (selectedVariant === i ? ' ' + styles.activeColor : '')}
                    onClick={() => setSelectedVariant(i)}
                    type="button"
                    aria-pressed={selectedVariant === i}
                    aria-label={'Pilih warna ' + v.name}
                  >
                    <span className={styles.colorName}>{v.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.priceBlock}>
              {product.price > 0 ? (
                <p className={styles.price}>{formatRupiah(product.price)}<span className={styles.priceUnit}>/m</span></p>
              ) : (
                <p className={styles.contactForPrice}>Hubungi untuk harga</p>
              )}
            </div>

            <div className={styles.actions}>
              {product.price > 0 && product.stock > 0 ? (
                <button className={styles.buyBtn} onClick={handleAddToCart} type="button">
                  Tambah ke Keranjang
                </button>
              ) : null}
            </div>
          </aside>
        </div>

        <section className={styles.relatedSection} aria-labelledby="related-title">
          <div className={styles.relatedHeading}>
            <p className={styles.relatedEyebrow}>Pilihan material</p>
            <h2 id="related-title" className={styles.relatedTitle}>Produk serupa</h2>
            <p className={styles.relatedDescription}>Temukan material lain yang mungkin sesuai untuk kebutuhan produksi Anda.</p>
          </div>
          <div className={styles.relatedGrid}>
            {relatedProducts.map((rp) => (
              <Link href={'/products/' + rp.slug} key={rp.id} className={styles.relatedCard}>
                <div className={styles.relatedImage}>
                  {rp.images?.[0] ? <Image src={rp.images[0]} alt={rp.name} fill sizes="(max-width: 720px) 50vw, 25vw" /> : (
                    <span className={styles.relatedSwatch} style={{ background: getCategoryGradient(rp.category) }} aria-hidden="true" />
                  )}
                </div>
                <div className={styles.relatedInfo}>
                  <h3 className={styles.relatedName}>{rp.name}</h3>
                  <p className={styles.relatedPrice}>{rp.price > 0 ? `${formatRupiah(rp.price)} /m` : 'Hubungi Kami'}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      {cartToast && (
        <div className={styles.cartToast} role="status" aria-live="polite">
          <span className={styles.toastCheck} aria-hidden="true">✓</span>
          <div className={styles.toastMessage}>
            <p className={styles.toastEyebrow}>Berhasil ditambahkan</p>
            <strong>{cartToast.productName}</strong>
            <span>{[cartToast.variantName, `${cartToast.qtyMeters} meter`].filter(Boolean).join(' · ')}</span>
          </div>
          <Link href="/cart" className={styles.toastLink}>Lihat keranjang</Link>
          <button
            type="button"
            className={styles.toastClose}
            aria-label="Tutup notifikasi"
            onClick={() => {
              if (cartToastTimeout.current !== null) window.clearTimeout(cartToastTimeout.current);
              setCartToast(null);
            }}
          >×</button>
        </div>
      )}
    </div>
  );
}
