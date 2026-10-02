'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

// --- MOCK DATA FALLBACK ---
const categories = ['Katun', 'Polyester', 'Rayon', 'Denim', 'Linen', 'Spandex'];
const mockProducts = [
  { id: '1', slug: 'katun-combed-30s', name: 'Katun Combed 30s', category: 'Katun', composition: '100% Cotton', gsm: 150, width: 42, price: 65000, stock: 1000, variants: [{color:'#000000'}, {color:'#ffffff'}, {color:'#ff0000'}] },
  { id: '2', slug: 'poly-micro', name: 'Polyester Micro', category: 'Polyester', composition: '100% Polyester', gsm: 110, width: 44, price: 45000, stock: 500, variants: [{color:'#0000ff'}, {color:'#808080'}] },
  { id: '3', slug: 'rayon-viscose', name: 'Rayon Viscose', category: 'Rayon', composition: '100% Rayon', gsm: 120, width: 44, price: 55000, stock: 0, variants: [{color:'#ffc0cb'}, {color:'#008000'}] },
  { id: '4', slug: 'denim-14oz', name: 'Raw Denim 14oz', category: 'Denim', composition: '100% Cotton', gsm: 400, width: 58, price: 120000, stock: 200, variants: [{color:'#00008b'}] },
  { id: '5', slug: 'linen-rami', name: 'Linen Rami', category: 'Linen', composition: '100% Linen', gsm: 140, width: 54, price: 85000, stock: 150, variants: [{color:'#d2b48c'}, {color:'#f5f5dc'}] },
  { id: '6', slug: 'spandex-jersey', name: 'Spandex Jersey', category: 'Spandex', composition: '95% Poly, 5% Spandex', gsm: 180, width: 36, price: 70000, stock: 300, variants: [{color:'#ff0000'}, {color:'#0000ff'}, {color:'#ffff00'}] },
];

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const getCategoryGradient = (category: string) => {
  switch (category.toLowerCase()) {
    case 'katun': return 'linear-gradient(135deg, #d4c9b0, #c2b49a)';
    case 'polyester': return 'linear-gradient(135deg, #a0bacc, #7899b2)';
    case 'rayon': return 'linear-gradient(135deg, #c8e6c9, #a5d6a7)';
    case 'denim': return 'linear-gradient(135deg, #3f51b5, #1a237e)';
    case 'linen': return 'linear-gradient(135deg, #d7ccc8, #8d6e63)';
    case 'spandex': return 'linear-gradient(135deg, #424242, #212121)';
    default: return 'linear-gradient(135deg, #eeeeee, #cccccc)';
  }
};

export default function ProductsPage() {
  const [catalogProducts, setCatalogProducts] = useState(
    process.env.NEXT_PUBLIC_SUPABASE_URL ? [] : mockProducts,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    let active = true;
    fetch('/api/products?limit=50')
      .then(async (response) => {
        if (!response.ok) throw new Error('Catalog unavailable');
        return response.json();
      })
      .then((result) => {
        if (!active) return;
        setCatalogProducts((result.products ?? []).map((product: {
          id: string; slug: string; name: string; category: string; composition: string;
          gsm: number; widthCm: number; pricePerMeter: number; isAvailable: boolean;
          variants: Array<{ colorHex?: string }>;
        }) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          composition: product.composition,
          gsm: product.gsm,
          width: product.widthCm / 2.54,
          price: product.pricePerMeter,
          stock: product.isAvailable ? 1 : 0,
          variants: product.variants.map((variant) => ({ color: variant.colorHex ?? '#d4c9b0' })),
        })));
      })
      .catch(() => {
        if (active) setCatalogProducts([]);
      });

    return () => { active = false; };
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filteredProducts = useMemo(() => {
    return catalogProducts.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category);
      return matchesSearch && matchesCategory;
    });
  }, [catalogProducts, searchQuery, selectedCategories]);

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Katalog<br/>Produksi</h1>
          <p className={styles.heroSubtitle}>Material kain premium untuk koleksi terbaik Anda.</p>
        </div>
      </div>

      <button 
        className={styles.mobileFilterBtn}
        onClick={() => setShowMobileFilters(!showMobileFilters)}
      >
        {showMobileFilters ? 'Sembunyikan Filter' : 'Filter / Sortir'}
      </button>

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${showMobileFilters ? styles.showMobile : ''}`}>
          <div className={styles.filterSection}>
            <h3 className={styles.filterTitle}>Pencarian</h3>
            <input 
              type="text" 
              placeholder="Ketik nama produk..." 
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.filterSection}>
            <h3 className={styles.filterTitle}>Kategori Material</h3>
            <div className={styles.checkboxGroup}>
              {categories.map(cat => (
                <label key={cat} className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    className={styles.checkboxInput}
                    checked={selectedCategories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                  />
                  <span className={styles.checkboxText}>{cat}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <main className={styles.mainContent}>
          <div className={styles.resultsCount}>
            Menampilkan {filteredProducts.length} Material
          </div>

          <div className={styles.grid}>
            {filteredProducts.map(product => (
              <Link href={`/products/${product.slug}`} key={product.id} className={styles.productCard}>
                <div className={styles.imageContainer}>
                  <div 
                    className={styles.imagePlaceholder} 
                    style={{ background: getCategoryGradient(product.category) }}
                  >
                    <span className={styles.categoryBadge}>{product.category}</span>
                  </div>
                </div>
                
                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.productName}>{product.name}</h3>
                    <div className={styles.price}>
                      {formatRupiah(product.price)}
                    </div>
                  </div>
                  
                  <p className={styles.composition}>{product.composition}</p>
                  
                  <div className={styles.specs}>
                    <span>{product.gsm} GSM</span>
                    <span className={styles.specSep}>|</span>
                    <span>Lebar {product.width}&quot;</span>
                  </div>
                  
                  <div className={styles.cardFooter}>
                    <div className={styles.variants}>
                      {product.variants.map((v, i) => (
                        <div key={i} className={styles.colorCircle} style={{ backgroundColor: v.color }}></div>
                      ))}
                    </div>
                    <span className={styles.detailLink}>Lihat Detail &rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
