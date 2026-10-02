'use client';

import React, { useState, useEffect } from 'react';
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
  isCustomOnly?: boolean; variants: DetailVariant[];
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
  
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [qty, setQty] = useState(10);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    if (!slug) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const timer = window.setTimeout(() => setProduct(mockProducts.find((item) => item.slug === slug) ?? null), 0);
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
          isCustomOnly: boolean; isAvailable: boolean;
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
      });

    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    const timer = window.setTimeout(() => setQty(product.moq), 0);
    return () => window.clearTimeout(timer);
  }, [product]);

  const handleAddToCart = () => {
    if (!product || product.price <= 0) return;
    const variant = product.variants[selectedVariant];
    addItem({
      productId: product.id,
      productName: product.name,
      variantId: variant?.id,
      variantName: variant?.name,
      category: product.category,
      qtyMeters: qty,
      minQtyMeters: product.moq,
      pricePerMeter: product.price,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (!product) {
    return <div className={styles.main}>Produk tidak ditemukan</div>;
  }

  const relatedProducts = catalogProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 3);
  if (relatedProducts.length < 3) {
    const others = catalogProducts.filter(p => p.id !== product.id && !relatedProducts.find(r => r.id === p.id)).slice(0, 3 - relatedProducts.length);
    relatedProducts.push(...others);
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.main}>
        <div className={styles.layout}>
          {/* Left Column - Gallery */}
        <div className={styles.gallery}>
          <div className={styles.mainImageWrapper}>
            <div 
              className={styles.imagePlaceholder} 
              style={{ background: getCategoryGradient(product.category) }}
            >
              Wina Jaya {product.category}
            </div>
          </div>
          <div className={styles.thumbnails}>
            {[1, 2, 3, 4].map((_, i) => (
              <div key={i} className={`${styles.thumbnail} ${i === 0 ? styles.active : ''}`}>
                <div 
                  className={styles.imagePlaceholderThumb} 
                  style={{ background: getCategoryGradient(product.category) }}
                ></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Info */}
        <div className={styles.info}>
          <div className={styles.infoHeader}>
            <span className={styles.categoryBadge}>{product.category}</span>
            <span className={styles.sku}>SKU: {product.sku}</span>
          </div>

          <h1 className={styles.productName}>{product.name}</h1>

          <div className={styles.priceContainer}>
            {product.price > 0 ? (
              <div className={styles.price}>
                {formatRupiah(product.price)}
                <span className={styles.priceUnit}>/m</span>
              </div>
            ) : (
              <div className={styles.contactForPrice}>Hubungi untuk harga</div>
            )}
            <div className={styles.stockIndicator}>
              {product.stock > 0 ? `Stok Tersedia` : 'Custom Order / PO'}
            </div>
          </div>

          <p className={styles.description}>{product.description}</p>

          <div className={styles.variantsSection}>
            <h3 className={styles.sectionTitle}>Pilih Warna</h3>
            <div className={styles.colorGrid}>
              {product.variants.map((v, i) => (
                <button 
                  key={i} 
                  className={`${styles.colorOption} ${selectedVariant === i ? styles.activeColor : ''}`}
                  onClick={() => setSelectedVariant(i)}
                  type="button"
                >
                  <div className={styles.colorCircle} style={{ backgroundColor: v.color }}></div>
                  <span className={styles.colorName}>{v.name}</span>
                </button>
              ))}
            </div>
          </div>

          <table className={styles.specsTable}>
            <tbody>
              <tr>
                <th>Komposisi</th>
                <td>{product.composition}</td>
              </tr>
              <tr>
                <th>Gramasi</th>
                <td>{product.gsm} gsm</td>
              </tr>
              <tr>
                <th>Lebar Kain</th>
                <td>{product.width} inch</td>
              </tr>
              <tr>
                <th>Sertifikasi</th>
                <td>OEKO-TEX®</td>
              </tr>
            </tbody>
          </table>

          <div className={styles.actions}>
            {product.price > 0 && product.stock > 0 ? (
              <>
                <div className={styles.qtyRow}>
                  <button type="button" className={styles.qtyBtn} onClick={() => setQty(Math.max(product.moq, qty - 10))}>−</button>
                  <span className={styles.qtyDisplay}>{qty} meter</span>
                  <button type="button" className={styles.qtyBtn} onClick={() => setQty(qty + 10)}>+</button>
                </div>
                <p className={styles.minimumNote}>Minimum pemesanan {product.moq} meter.</p>
                <button className={styles.buyBtn} onClick={handleAddToCart}>
                  {addedToCart ? '✓ Ditambahkan!' : 'Tambah ke Keranjang'}
                </button>
                <Link href="/checkout" className={styles.checkoutLink}>
                  Langsung Checkout &rarr;
                </Link>
              </>
            ) : null}
            <Link href={`/rfq/new?productId=${product.id}`} className={styles.rfqBtn}>
              Ajukan Penawaran / RFQ
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.relatedSection}>
        <h2 className={styles.relatedTitle}>Koleksi Serupa</h2>
        <div className={styles.relatedGrid}>
          {relatedProducts.map(rp => (
            <Link href={`/products/${rp.slug}`} key={rp.id} className={styles.relatedCard}>
              <div className={styles.relatedImage}>
                <div 
                  className={styles.imagePlaceholderThumb} 
                  style={{ background: getCategoryGradient(rp.category) }}
                ></div>
              </div>
              <div className={styles.relatedInfo}>
                <h3 className={styles.relatedName}>{rp.name}</h3>
                <p className={styles.relatedPrice}>{rp.price > 0 ? formatRupiah(rp.price) : 'Hubungi Kami'}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
