'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  composition: string;
  gsm: number;
  width: number;
  price: number;
  images: string[];
};

type SortOption = 'name' | 'price-asc' | 'price-desc';

const mockProducts: CatalogProduct[] = [
  { id: '1', slug: 'katun-combed-30s', name: 'Katun Combed 30s', category: 'Katun', composition: '100% Cotton', gsm: 150, width: 42, price: 65000, images: [] },
  { id: '2', slug: 'poly-micro', name: 'Polyester Micro', category: 'Polyester', composition: '100% Polyester', gsm: 110, width: 44, price: 45000, images: [] },
  { id: '3', slug: 'rayon-viscose', name: 'Rayon Viscose', category: 'Rayon', composition: '100% Rayon', gsm: 120, width: 44, price: 55000, images: [] },
  { id: '4', slug: 'denim-14oz', name: 'Raw Denim 14oz', category: 'Denim', composition: '100% Cotton', gsm: 400, width: 58, price: 120000, images: [] },
  { id: '5', slug: 'linen-rami', name: 'Linen Rami', category: 'Linen', composition: '100% Linen', gsm: 140, width: 54, price: 85000, images: [] },
  { id: '6', slug: 'spandex-jersey', name: 'Spandex Jersey', category: 'Spandex', composition: '95% Poly, 5% Spandex', gsm: 180, width: 36, price: 70000, images: [] },
];

const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
}).format(amount);

const getCategoryGradient = (category: string) => {
  switch (category.toLowerCase()) {
    case 'katun': return 'linear-gradient(135deg, #e6dfd2, #cfc4b1)';
    case 'polyester': return 'linear-gradient(135deg, #d5e0e5, #aabdc8)';
    case 'rayon': return 'linear-gradient(135deg, #e2e9dc, #c3d0b9)';
    case 'denim': return 'linear-gradient(135deg, #b9c5d1, #77899b)';
    case 'linen': return 'linear-gradient(135deg, #e7dfd2, #c7bba8)';
    case 'spandex': return 'linear-gradient(135deg, #d8d8d8, #a6a6a6)';
    default: return 'linear-gradient(135deg, #f0f0ed, #d8d9d5)';
  }
};

export default function ProductsPage() {
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ? [] : mockProducts,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [page, setPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL));
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    const controller = new AbortController();
    fetch('/api/products?limit=50', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Katalog belum dapat dimuat.');
        return response.json();
      })
      .then((result) => {
        setCatalogProducts((result.products ?? []).map((product: {
          id: string; slug: string; name: string; category: string; composition: string;
          gsm: number; widthCm: number; pricePerMeter: number; images?: string[];
        }) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          composition: product.composition,
          gsm: product.gsm,
          width: product.widthCm / 2.54,
          price: product.pricePerMeter,
          images: product.images ?? [],
        })));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCatalogProducts([]);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  const categories = useMemo(() => [...new Set(catalogProducts.map((product) => product.category))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'id')),
  [catalogProducts]);

  const toggleCategory = (category: string) => {
    setPage(1);
    setSelectedCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  };

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('id-ID');
    const results = catalogProducts.filter((product) => {
      const searchableText = [product.name, product.category, product.composition]
        .join(' ')
        .toLocaleLowerCase('id-ID');
      const matchesSearch = !query || searchableText.includes(query);
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category);
      return matchesSearch && matchesCategory;
    });

    return results.sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return a.name.localeCompare(b.name, 'id');
    });
  }, [catalogProducts, searchQuery, selectedCategories, sortBy]);

  const pageSize = 12;
  const pageCount = Math.ceil(filteredProducts.length / pageSize);
  const currentPage = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const visibleProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasActiveFilters = Boolean(searchQuery || selectedCategories.length);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setPage(1);
  };

  return (
    <main className={styles.container}>
      <div className={styles.contentContainer}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Semua produk</h1>
          <p className={styles.pageDescription}>Jelajahi pilihan material untuk koleksi dan kebutuhan produksi Anda.</p>
        </header>

        <button
          className={styles.mobileFilterBtn}
          type="button"
          onClick={() => setShowMobileFilters((visible) => !visible)}
          aria-expanded={showMobileFilters}
          aria-controls="product-filters"
        >
          <span>{showMobileFilters ? 'Sembunyikan filter' : 'Filter produk'}</span>
          <span aria-hidden="true">{showMobileFilters ? '−' : '+'}</span>
        </button>

        <div className={styles.layout}>
          <aside id="product-filters" className={`${styles.sidebar} ${showMobileFilters ? styles.showMobile : ''}`} aria-label="Filter produk">
            <div className={styles.filterSection}>
              <label className={styles.filterTitle} htmlFor="catalog-search">Cari produk</label>
              <div className={styles.searchWrap}>
                <input
                  id="catalog-search"
                  type="search"
                  placeholder="Nama atau material"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }}
                />
              </div>
            </div>

            <div className={styles.filterSection}>
              <h2 className={styles.filterTitle}>Kategori</h2>
              <div className={styles.checkboxGroup}>
                {categories.map((category) => (
                  <label key={category} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    <span>{category}</span>
                    <span className={styles.categoryCount}>
                      {catalogProducts.filter((product) => product.category === category).length}
                    </span>
                  </label>
                ))}
                {!categories.length && !isLoading && <p className={styles.filterHint}>Kategori belum tersedia.</p>}
              </div>
            </div>

            {hasActiveFilters && <button className={styles.clearFilters} type="button" onClick={resetFilters}>Hapus semua filter</button>}
          </aside>

          <section className={styles.mainContent} aria-labelledby="product-results-title">
            <div className={styles.resultsToolbar}>
              <p id="product-results-title" className={styles.resultsCount}>
                {isLoading ? 'Memuat produk…' : `${filteredProducts.length} produk`}
              </p>
              <label className={styles.sortControl}>
                <span>Urutkan</span>
                <select value={sortBy} onChange={(event) => { setSortBy(event.target.value as SortOption); setPage(1); }}>
                  <option value="name">Nama produk</option>
                  <option value="price-asc">Harga: terendah</option>
                  <option value="price-desc">Harga: tertinggi</option>
                </select>
              </label>
            </div>

            {isLoading ? (
              <div className={styles.productGrid} aria-label="Memuat produk">
                {Array.from({ length: 8 }, (_, index) => <div key={index} className={styles.skeletonCard} />)}
              </div>
            ) : visibleProducts.length ? (
              <>
                <div className={styles.productGrid} data-testid="products-list">
                  {visibleProducts.map((product) => (
                    <Link href={`/products/${product.slug}`} key={product.id} className={styles.productCard}>
                      <div className={styles.imageContainer}>
                        {product.images[0] ? (
                          <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            sizes="(max-width: 575px) 50vw, (max-width: 1023px) 33vw, 25vw"
                            className={styles.productImage}
                          />
                        ) : (
                          <div className={styles.imagePlaceholder} style={{ background: getCategoryGradient(product.category) }}>
                            <span className={styles.fabricSample} aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className={styles.cardContent}>
                        <h2 className={styles.productName}>{product.name}</h2>
                        <p className={styles.productCategory}>{product.category}</p>
                        <p className={styles.productPrice}>{product.price > 0 ? `${formatRupiah(product.price)} /m` : 'Hubungi untuk harga'}</p>
                      </div>
                    </Link>
                  ))}
                </div>

                {pageCount > 1 && <nav className={styles.pagination} aria-label="Halaman produk">
                  <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</button>
                  <span>Halaman {currentPage} dari {pageCount}</span>
                  <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Berikutnya</button>
                </nav>}
              </>
            ) : (
              <div className={styles.emptyState}>
                <h2>{loadFailed ? 'Katalog belum dapat dimuat' : 'Produk tidak ditemukan'}</h2>
                <p>{loadFailed ? 'Periksa koneksi lalu muat ulang halaman.' : 'Ubah kata pencarian atau filter kategori untuk melihat produk lain.'}</p>
                {hasActiveFilters && <button type="button" onClick={resetFilters}>Hapus filter</button>}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
