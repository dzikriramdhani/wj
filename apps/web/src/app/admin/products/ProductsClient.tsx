'use client';

import React, { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { formatRupiah } from '@/lib/routing-logic';

type AdminProduct = {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  category: string;
  composition: string;
  gsm: number;
  widthCm: number;
  description: string;
  pricePerMeter: number;
  stockMeters: number;
  moqRetail: number;
  shippingWeightGramsPerMeter: number;
  images: Array<{ id: string; url: string; altText: string }>;
  variants: Array<{ id: string; colorName: string; colorHex: string | null; stockMeters: number }>;
  isCustomOnly: boolean;
  isActive: boolean;
};

type ProductDraft = {
  productId: string | null;
  categoryId: string;
  name: string;
  sku: string;
  composition: string;
  gsm: string;
  widthCm: string;
  description: string;
  pricePerMeter: string;
  stockMeters: string;
  moqRetail: string;
  shippingWeightGramsPerMeter: string;
  isCustomOnly: boolean;
  isActive: boolean;
};

type Category = { id: string; name: string };

function createEmptyDraft(categories: Category[]): ProductDraft {
  return {
    productId: null,
    categoryId: categories[0]?.id ?? '',
    name: '',
    sku: '',
    composition: '',
    gsm: '',
    widthCm: '',
    description: '',
    pricePerMeter: '',
    stockMeters: '0',
    moqRetail: '1',
    shippingWeightGramsPerMeter: '500',
    isCustomOnly: false,
    isActive: true,
  };
}

function productToDraft(product: AdminProduct): ProductDraft {
  return {
    productId: product.id,
    categoryId: product.categoryId,
    name: product.name,
    sku: product.sku,
    composition: product.composition,
    gsm: String(product.gsm),
    widthCm: String(product.widthCm),
    description: product.description,
    pricePerMeter: String(product.pricePerMeter),
    stockMeters: String(product.stockMeters),
    moqRetail: String(product.moqRetail),
    shippingWeightGramsPerMeter: String(product.shippingWeightGramsPerMeter),
    isCustomOnly: product.isCustomOnly,
    isActive: product.isActive,
  };
}

export default function AdminProducts({
  products,
  categories,
  loadError,
}: {
  products: AdminProduct[];
  categories: Category[];
  loadError?: string;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(() => createEmptyDraft(categories));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [variantDraft, setVariantDraft] = useState({ colorName: '', colorHex: '#000000', stockMeters: '0' });

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
    || product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    || product.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const openCreate = () => {
    setDraft(createEmptyDraft(categories));
    setSaveError(null);
    setPendingImages([]);
    setVariantDraft({ colorName: '', colorHex: '#000000', stockMeters: '0' });
    setIsModalOpen(true);
  };

  const openEdit = (product: AdminProduct) => {
    setDraft(productToDraft(product));
    setSaveError(null);
    setPendingImages([]);
    setVariantDraft({ colorName: '', colorHex: '#000000', stockMeters: '0' });
    setIsModalOpen(true);
  };

  const addVariant = async () => {
    if (!draft.productId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(draft.productId)}/variants`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...variantDraft, stockMeters: Number(variantDraft.stockMeters) }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setSaveError(result.error ?? 'Varian belum dapat disimpan.');
      setVariantDraft({ colorName: '', colorHex: '#000000', stockMeters: '0' });
      router.refresh();
    } catch {
      setSaveError('Koneksi ke server terputus. Coba kembali.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    if (!isSaving) setIsModalOpen(false);
  };

  const updateDraft = <Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          gsm: Number(draft.gsm),
          widthCm: Number(draft.widthCm),
          pricePerMeter: Number(draft.pricePerMeter),
          stockMeters: Number(draft.stockMeters),
          moqRetail: Number(draft.moqRetail),
          shippingWeightGramsPerMeter: Number(draft.shippingWeightGramsPerMeter),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setSaveError(result.error ?? 'Produk belum dapat disimpan.');
        return;
      }
      const productId = String((result as { productId?: string }).productId ?? draft.productId ?? '');
      if (pendingImages.length && productId) {
        const images = new FormData();
        pendingImages.forEach((file) => images.append('files', file));
        const imageResponse = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/images`, { method: 'POST', body: images });
        if (!imageResponse.ok) {
          const imageResult = await imageResponse.json().catch(() => ({})) as { error?: string };
          setSaveError(imageResult.error ?? 'Produk tersimpan, tetapi gambar belum dapat diunggah.');
          return;
        }
      }
      setIsModalOpen(false);
      router.refresh();
    } catch {
      setSaveError('Koneksi ke server terputus. Coba simpan kembali.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeImage = async (product: AdminProduct, imageId: string) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}/images?imageId=${encodeURIComponent(imageId)}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setSaveError(result.error ?? 'Gambar belum dapat dihapus.');
      router.refresh();
    } catch {
      setSaveError('Koneksi ke server terputus. Coba kembali.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Kelola Produk</h1>
        <div className={styles.controls}>
          <input
            type="search"
            placeholder="Cari produk (nama, SKU, kategori)..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <button className={styles.addBtn} onClick={openCreate} disabled={categories.length === 0}>
            <span>+</span> Tambah Produk
          </button>
        </div>
      </header>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>No</th>
              <th>SKU</th>
              <th>Nama Produk</th>
              <th>Kategori</th>
              <th>Harga/Meter</th>
              <th>Stok (m)</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product, index) => (
              <tr key={product.id}>
                <td>{index + 1}</td>
                <td style={{ fontWeight: 500 }}>{product.sku}</td>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>{formatRupiah(product.pricePerMeter)}</td>
                <td>{Number(product.stockMeters).toLocaleString('id-ID')}</td>
                <td>
                  {!product.isActive ? (
                    <span className={`${styles.statusBadge} ${styles.statusCustom}`}>Tidak Aktif</span>
                  ) : !product.isCustomOnly ? (
                    <span className={`${styles.statusBadge} ${styles.statusActive}`}>Aktif</span>
                  ) : (
                    <span className={`${styles.statusBadge} ${styles.statusCustom}`}>Custom Only</span>
                  )}
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className={`${styles.iconBtn} ${styles.editBtn}`}
                      onClick={() => openEdit(product)}
                      title={`Edit ${product.name}`}
                      aria-label={`Edit ${product.name}`}
                    >
                      ✏️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  {loadError ?? 'Tidak ada produk yang sesuai dengan pencarian.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="product-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="product-form-title" className={styles.modalTitle}>
              {draft.productId ? 'Edit Produk' : 'Tambah Produk Baru'}
            </h2>
            <form className={styles.productForm} onSubmit={saveProduct}>
              <div className={styles.formGrid}>
                <label>
                  Kategori
                  <select value={draft.categoryId} onChange={(event) => updateDraft('categoryId', event.target.value)} required>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label>
                  SKU
                  <input value={draft.sku} onChange={(event) => updateDraft('sku', event.target.value)} maxLength={120} required />
                </label>
                <label className={styles.fullWidth}>
                  Nama produk
                  <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} maxLength={200} required />
                </label>
                <label>
                  Komposisi
                  <input value={draft.composition} onChange={(event) => updateDraft('composition', event.target.value)} maxLength={200} placeholder="Contoh: 100% Cotton" required />
                </label>
                <label>
                  GSM
                  <input type="number" min="1" step="1" value={draft.gsm} onChange={(event) => updateDraft('gsm', event.target.value)} required />
                </label>
                <label>
                  Lebar (cm)
                  <input type="number" min="1" step="1" value={draft.widthCm} onChange={(event) => updateDraft('widthCm', event.target.value)} required />
                </label>
                <label>
                  Harga per meter (Rp)
                  <input type="number" min="0" step="1" value={draft.pricePerMeter} onChange={(event) => updateDraft('pricePerMeter', event.target.value)} required />
                </label>
                <label>
                  Stok fisik (m)
                  <input type="number" min="0" step="0.01" value={draft.stockMeters} onChange={(event) => updateDraft('stockMeters', event.target.value)} required />
                </label>
                <label>
                  Minimum pesanan (m)
                  <input type="number" min="0" step="0.01" value={draft.moqRetail} onChange={(event) => updateDraft('moqRetail', event.target.value)} required />
                </label>
                <label>
                  Berat per meter (g)
                  <input type="number" min="1" step="1" value={draft.shippingWeightGramsPerMeter} onChange={(event) => updateDraft('shippingWeightGramsPerMeter', event.target.value)} required />
                </label>
                <label className={styles.fullWidth}>
                  Deskripsi
                  <textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} minLength={10} maxLength={4000} rows={4} required />
                </label>
                <label className={styles.fullWidth}>
                  Gambar produk
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => setPendingImages(Array.from(event.target.files ?? []).slice(0, 6))} />
                  <small>JPG, PNG, WebP, atau AVIF; maksimal 10 MB per gambar.</small>
                </label>
              </div>
              {draft.productId && (() => {
                const product = products.find((item) => item.id === draft.productId);
                return product?.images.length ? <div className={styles.imageList}>{product.images.map((image) => <figure key={image.id}><Image src={image.url} alt={image.altText || product.name} width={800} height={800} sizes="(max-width: 768px) 33vw, 240px" /><button type="button" onClick={() => removeImage(product, image.id)} disabled={isSaving}>Hapus</button></figure>)}</div> : null;
              })()}
              {draft.productId && (() => {
                const product = products.find((item) => item.id === draft.productId);
                return <section className={styles.variantSection}>
                  <strong>Varian warna</strong>
                  {product?.variants.length ? <ul>{product.variants.map((variant) => <li key={variant.id}><i style={{ backgroundColor: variant.colorHex ?? '#888' }} />{variant.colorName} · {variant.stockMeters.toLocaleString('id-ID')} m</li>)}</ul> : <p>Belum ada varian.</p>}
                  <div className={styles.variantForm}><input placeholder="Nama warna" value={variantDraft.colorName} onChange={(event) => setVariantDraft((current) => ({ ...current, colorName: event.target.value }))} /><input type="color" aria-label="Warna varian" value={variantDraft.colorHex} onChange={(event) => setVariantDraft((current) => ({ ...current, colorHex: event.target.value }))} /><input type="number" min="0" step="0.01" placeholder="Stok meter" value={variantDraft.stockMeters} onChange={(event) => setVariantDraft((current) => ({ ...current, stockMeters: event.target.value }))} /><button type="button" onClick={addVariant} disabled={isSaving || !variantDraft.colorName}>Tambah varian</button></div>
                </section>;
              })()}
              <div className={styles.checkboxRow}>
                <label><input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} /> Aktifkan pada katalog</label>
                <label><input type="checkbox" checked={draft.isCustomOnly} onChange={(event) => updateDraft('isCustomOnly', event.target.checked)} /> Hanya melalui RFQ</label>
              </div>
              {saveError && <p className={styles.formError} role="alert">{saveError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={closeModal} disabled={isSaving}>Batal</button>
                <button type="submit" className={styles.saveBtn} disabled={isSaving}>{isSaving ? 'Menyimpan…' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
