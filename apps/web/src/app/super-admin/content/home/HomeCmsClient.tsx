'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ChevronRight, Clock3, Eye, History, ImagePlus, LoaderCircle, Plus, Save, Send, Smartphone, Trash2, Undo2 } from 'lucide-react';
import { defaultHomeContent, getHomeAssetUrl, type HomeContent } from '@/lib/home-content';
import styles from './page.module.css';

type ProductOption = { name: string; slug: string };
type Revision = { revision: number; saved_at: string; saved_by: string | null };
type SectionKey = 'hero' | 'catalog' | 'trusted' | 'about' | 'certifications' | 'cta' | 'seo';
type CmsResponse = {
  draft: HomeContent;
  published: HomeContent;
  draftRevision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  revisions: Revision[];
};

const sections: Array<{ id: SectionKey; title: string }> = [
  { id: 'hero', title: 'Hero & pengantar' },
  { id: 'catalog', title: 'Katalog unggulan' },
  { id: 'trusted', title: 'Dipercaya brand' },
  { id: 'about', title: 'Tentang perusahaan' },
  { id: 'certifications', title: 'Sertifikasi' },
  { id: 'cta', title: 'Ajakan tindakan' },
  { id: 'seo', title: 'SEO beranda' },
];

export default function HomeCmsClient({ products, productsError }: { products: ProductOption[]; productsError: boolean }) {
  const [content, setContent] = useState<HomeContent>(defaultHomeContent);
  const [activeSection, setActiveSection] = useState<SectionKey>('hero');
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [draftRevision, setDraftRevision] = useState(0);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const fetchContent = useCallback(async () => {
    const response = await fetch('/api/super-admin/content/home', { cache: 'no-store' });
    const result = await response.json() as Partial<CmsResponse> & { error?: string };
    if (!response.ok || !result.draft) throw new Error(result.error ?? 'Konten beranda belum dapat dimuat.');
    return result as CmsResponse;
  }, []);

  const loadContent = useCallback(async () => {
    try {
      const result = await fetchContent();
      setContent(result.draft);
      setDraftRevision(result.draftRevision ?? 0);
      setPublishedRevision(result.publishedRevision ?? null);
      setPublishedAt(result.publishedAt ?? null);
      setRevisions(result.revisions ?? []);
      setMessage('');
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Konten beranda belum dapat dimuat.');
      setIsError(true);
    } finally {
      setLoaded(true);
      setBusy(false);
    }
  }, [fetchContent]);

  useEffect(() => {
    let cancelled = false;
    fetchContent().then((result) => {
      if (cancelled) return;
      setContent(result.draft);
      setDraftRevision(result.draftRevision ?? 0);
      setPublishedRevision(result.publishedRevision ?? null);
      setPublishedAt(result.publishedAt ?? null);
      setRevisions(result.revisions ?? []);
      setMessage('');
      setIsError(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setMessage(error instanceof Error ? error.message : 'Konten beranda belum dapat dimuat.');
      setIsError(true);
    }).finally(() => {
      if (cancelled) return;
      setLoaded(true);
      setBusy(false);
    });
    return () => { cancelled = true; };
  }, [fetchContent]);

  const active = sections.find((section) => section.id === activeSection) ?? sections[0];
  const previewImage = activeSection === 'about' ? content.about.imagePath : content.hero.imagePath;
  const previewTitle = activeSection === 'about' ? content.about.title : activeSection === 'cta' ? content.cta.title : activeSection === 'catalog' ? content.catalog.title : activeSection === 'trusted' ? content.trusted.title : activeSection === 'certifications' ? content.certifications.title : content.hero.title;
  const previewBody = activeSection === 'about' ? content.about.body : activeSection === 'cta' ? content.cta.description : activeSection === 'trusted' ? '' : content.tagline;
  const previewUrl = useMemo(() => getHomeAssetUrl(previewImage), [previewImage]);

  const saveDraft = async () => {
    const response = await fetch('/api/super-admin/content/home', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
    const result = await response.json() as { error?: string; revision?: number };
    if (!response.ok) throw new Error(result.error ?? 'Draft belum dapat disimpan.');
    if (typeof result.revision === 'number') setDraftRevision(result.revision);
    return result.revision;
  };

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const revision = await saveDraft();
      await loadContent();
      setMessage(`Draft tersimpan${revision === undefined ? '.' : ` sebagai revisi ${revision}.`}`);
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft belum dapat disimpan.');
      setIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setMessage('');
    try {
      await saveDraft();
      const response = await fetch('/api/super-admin/content/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      });
      const result = await response.json() as { error?: string; revision?: number };
      if (!response.ok) throw new Error(result.error ?? 'Konten beranda belum dapat diterbitkan.');
      setPublishedRevision(result.revision ?? null);
      setPublishedAt(new Date().toISOString());
      await loadContent();
      setMessage('Perubahan beranda berhasil diterbitkan.');
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Konten beranda belum dapat diterbitkan.');
      setIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const restoreRevision = async (revision: number) => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/super-admin/content/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', revision }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Revisi belum dapat dipulihkan.');
      await loadContent();
      setMessage(`Revisi ${revision} dipulihkan ke draft. Terbitkan untuk menampilkannya di beranda.`);
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Revisi belum dapat dipulihkan.');
      setIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (file: File, target: 'hero' | 'about' | 'trustedLogo') => {
    setBusy(true);
    setMessage('');
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch('/api/super-admin/content/home/assets', { method: 'POST', body: form });
      const result = await response.json() as { error?: string; path?: string };
      if (!response.ok || !result.path) throw new Error(result.error ?? 'Gambar belum dapat diunggah.');
      setContent((current) => {
        if (target === 'hero') return { ...current, hero: { ...current.hero, imagePath: result.path! } };
        if (target === 'about') return { ...current, about: { ...current.about, imagePath: result.path! } };
        if (current.trusted.logos.length >= 12) return current;
        return { ...current, trusted: { ...current.trusted, logos: [...current.trusted.logos, result.path!] } };
      });
      setMessage('Gambar siap disimpan bersama draft.');
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gambar belum dapat diunggah.');
      setIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, onChange: (value: string) => void, options?: { multiline?: boolean; hint?: string; maxLength?: number }) => (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {options?.multiline
        ? <textarea className={styles.textarea} value={value} maxLength={options.maxLength} onChange={(event) => onChange(event.target.value)} />
        : <input className={styles.input} value={value} maxLength={options?.maxLength} onChange={(event) => onChange(event.target.value)} />}
      {options?.hint && <small>{options.hint}</small>}
    </label>
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div><h1>Konten Beranda</h1></div>
        <a className={styles.viewLink} href="/" target="_blank" rel="noreferrer"><Eye size={15} /> Lihat beranda <ChevronRight size={14} /></a>
      </header>

      <div className={styles.statusRow}>
        <p className={styles.status}><span className={publishedRevision === draftRevision ? styles.statusDotReady : styles.statusDot} />
          {publishedRevision === draftRevision ? 'Draft dan publikasi sudah sama' : `Draft revisi ${draftRevision} belum diterbitkan`}
        </p>
        <span className={styles.revisionMeta}><Clock3 size={13} />
          {publishedAt ? `Publikasi terakhir ${new Date(publishedAt).toLocaleString('id-ID')}` : 'Belum ada waktu publikasi'}
        </span>
      </div>
      {message && <p className={`${styles.message} ${isError ? styles.messageError : styles.messageSuccess}`} role={isError ? 'alert' : 'status'}>{message}</p>}

      <div className={styles.workspace}>
        <aside className={styles.sectionNav} aria-label="Bagian konten beranda">
          {sections.map((section) => <button key={section.id} type="button" className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ''}`} onClick={() => setActiveSection(section.id)}>
            <span><strong>{section.title}</strong></span><ChevronRight size={15} />
          </button>)}
          <div className={styles.historyBox}>
            <label><History size={14} /> Riwayat draft</label>
            {revisions.slice(0, 5).map((revision) => <div className={styles.revisionItem} key={revision.revision}>
              <span><strong>Revisi {revision.revision}</strong><small>{new Date(revision.saved_at).toLocaleString('id-ID')}</small></span>
              <button type="button" aria-label={`Pulihkan revisi ${revision.revision}`} title="Pulihkan ke draft" disabled={busy || revision.revision === draftRevision} onClick={() => void restoreRevision(revision.revision)}><Undo2 size={14} /></button>
            </div>)}
            {!revisions.length && <small className={styles.noRevision}>Riwayat belum tersedia.</small>}
          </div>
        </aside>

        <section className={styles.editorPanel}>
          <div className={styles.panelHeading}><h2>{active.title}</h2><span className={styles.draftBadge}>Draft {draftRevision}</span></div>
          <div className={styles.fields}>
            {activeSection === 'hero' && <>
              {field('Judul utama', content.hero.title, (value) => setContent((current) => ({ ...current, hero: { ...current.hero, title: value } })), { multiline: true, maxLength: 180, hint: 'Gunakan baris baru untuk mengatur pemenggalan judul.' })}
              {field('Tagline', content.tagline, (value) => setContent((current) => ({ ...current, tagline: value })), { multiline: true, maxLength: 500 })}
              <div className={styles.field}><span className={styles.fieldLabel}>Gambar hero</span><span className={styles.assetRow}><label className={styles.uploadButton}><ImagePlus size={15} /> Pilih gambar<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, 'hero'); event.currentTarget.value = ''; }} /></label><span className={styles.assetPreview}>{content.hero.imagePath || 'Belum ada gambar'}</span></span><small>JPG, PNG, atau WebP. Maksimal 10 MB.</small></div>
            </>}

            {activeSection === 'catalog' && <>
              {field('Judul katalog', content.catalog.title, (value) => setContent((current) => ({ ...current, catalog: { ...current.catalog, title: value } })), { multiline: true, maxLength: 100 })}
              {field('Label tautan katalog', content.catalog.linkLabel, (value) => setContent((current) => ({ ...current, catalog: { ...current.catalog, linkLabel: value } })), { maxLength: 60 })}
              <div className={styles.field}><span className={styles.fieldLabel}>Produk unggulan <small>(maksimal 8 produk)</small></span>
                {productsError && <small className={styles.fieldError}>Daftar produk belum dapat dimuat. Produk yang sudah dipilih tetap tersimpan.</small>}
                <div className={styles.productPicker}>{products.map((product) => <label className={styles.productOption} key={product.slug}>
                  <input type="checkbox" checked={content.catalog.productSlugs.includes(product.slug)} disabled={!content.catalog.productSlugs.includes(product.slug) && content.catalog.productSlugs.length >= 8} onChange={(event) => setContent((current) => ({ ...current, catalog: { ...current.catalog, productSlugs: event.target.checked ? [...current.catalog.productSlugs, product.slug] : current.catalog.productSlugs.filter((slug) => slug !== product.slug) } }))} />
                  <span>{product.name}<small>/{product.slug}</small></span>
                </label>)}{!products.length && <p>Belum ada produk aktif untuk dipilih.</p>}</div>
              </div>
            </>}

            {activeSection === 'trusted' && <>
              {field('Judul bagian', content.trusted.title, (value) => setContent((current) => ({ ...current, trusted: { ...current.trusted, title: value } })), { multiline: true, maxLength: 100 })}
              <div className={styles.field}>
                <div className={styles.repeatHeader}>
                  <span className={styles.fieldLabel}>Logo brand ({content.trusted.logos.length}/12)</span>
                  <label className={`${styles.uploadButton} ${content.trusted.logos.length >= 12 || busy ? styles.uploadDisabled : ''}`}>
                    <ImagePlus size={15} /> Tambah logo
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || content.trusted.logos.length >= 12} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, 'trustedLogo'); event.currentTarget.value = ''; }} />
                  </label>
                </div>
                <small>Unggah file logo JPG, PNG, atau WebP. Maksimal 10 MB per file.</small>
                {content.trusted.logos.length > 0
                  ? <div className={styles.logoGrid}>{content.trusted.logos.map((logoPath, index) => <div className={styles.logoItem} key={`${logoPath}-${index}`}>
                      <div className={styles.logoPreview}>
                        {getHomeAssetUrl(logoPath) && <Image src={getHomeAssetUrl(logoPath)} alt={`Logo brand ${index + 1}`} fill sizes="(max-width: 760px) 40vw, 160px" />}
                      </div>
                      <button type="button" className={styles.removeButton} aria-label={`Hapus logo ${index + 1}`} title="Hapus logo" disabled={busy} onClick={() => setContent((current) => ({ ...current, trusted: { ...current.trusted, logos: current.trusted.logos.filter((_, itemIndex) => itemIndex !== index) } }))}><Trash2 size={13} /> Hapus</button>
                    </div>)}</div>
                  : <p className={styles.note}>Belum ada logo. Tambahkan file gambar logo brand yang telah disetujui.</p>}
              </div>
            </>}

            {activeSection === 'about' && <>
              {field('Judul', content.about.title, (value) => setContent((current) => ({ ...current, about: { ...current.about, title: value } })), { multiline: true, maxLength: 120 })}
              {field('Deskripsi', content.about.body, (value) => setContent((current) => ({ ...current, about: { ...current.about, body: value } })), { multiline: true, maxLength: 900 })}
              <div className={styles.field}><span className={styles.fieldLabel}>Gambar perusahaan</span><span className={styles.assetRow}><label className={styles.uploadButton}><ImagePlus size={15} /> Pilih gambar<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, 'about'); event.currentTarget.value = ''; }} /></label><span className={styles.assetPreview}>{content.about.imagePath || 'Belum ada gambar'}</span></span><small>JPG, PNG, atau WebP. Maksimal 10 MB.</small></div>
            </>}

            {activeSection === 'certifications' && <>
              {field('Judul bagian', content.certifications.title, (value) => setContent((current) => ({ ...current, certifications: { ...current.certifications, title: value } })), { maxLength: 100 })}
              <div className={styles.repeatHeader}><span className={styles.fieldLabel}>Sertifikasi ({content.certifications.items.length}/8)</span><button className={styles.secondaryButton} type="button" disabled={content.certifications.items.length >= 8} onClick={() => setContent((current) => ({ ...current, certifications: { ...current.certifications, items: [...current.certifications.items, { name: '', description: '' }] } }))}><Plus size={14} /> Tambah sertifikasi</button></div>
              {content.certifications.items.map((item, index) => <div className={styles.repeatItem} key={`cert-${index}`}><b>Sertifikasi {index + 1}</b><div className={styles.twoColumns}>
                {field('Nama', item.name, (value) => setContent((current) => ({ ...current, certifications: { ...current.certifications, items: current.certifications.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: value } : entry) } })), { maxLength: 80 })}
                {field('Deskripsi', item.description, (value) => setContent((current) => ({ ...current, certifications: { ...current.certifications, items: current.certifications.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, description: value } : entry) } })), { maxLength: 240 })}
              </div><button type="button" className={styles.removeButton} disabled={content.certifications.items.length <= 1} onClick={() => setContent((current) => ({ ...current, certifications: { ...current.certifications, items: current.certifications.items.filter((_, itemIndex) => itemIndex !== index) } }))}><Trash2 size={13} /> Hapus</button></div>)}
            </>}

            {activeSection === 'cta' && <>
              {field('Judul ajakan', content.cta.title, (value) => setContent((current) => ({ ...current, cta: { ...current.cta, title: value } })), { multiline: true, maxLength: 180 })}
              {field('Deskripsi', content.cta.description, (value) => setContent((current) => ({ ...current, cta: { ...current.cta, description: value } })), { multiline: true, maxLength: 700 })}
              <div className={styles.twoColumns}>
                {field('Label tombol', content.cta.buttonLabel, (value) => setContent((current) => ({ ...current, cta: { ...current.cta, buttonLabel: value } })), { maxLength: 80 })}
                {field('Tautan internal', content.cta.buttonHref, (value) => setContent((current) => ({ ...current, cta: { ...current.cta, buttonHref: value } })), { maxLength: 240, hint: 'Gunakan path internal, misalnya /rfq/new.' })}
              </div>
            </>}

            {activeSection === 'seo' && <>
              {field('Judul SEO', content.seo.title, (value) => setContent((current) => ({ ...current, seo: { ...current.seo, title: value } })), { maxLength: 90 })}
              {field('Deskripsi SEO', content.seo.description, (value) => setContent((current) => ({ ...current, seo: { ...current.seo, description: value } })), { multiline: true, maxLength: 240 })}
              <p className={styles.note}>Informasi SEO digunakan pada metadata halaman utama dan tidak mengubah desain halaman publik.</p>
            </>}
          </div>
          <footer className={styles.editorFooter}><span>Revisi {draftRevision}</span><div>
            <button className={styles.saveButton} type="button" disabled={busy || !loaded} onClick={() => void save()}>{busy ? <LoaderCircle size={15} className={styles.spinning} /> : <Save size={15} />} Simpan draft</button>
            <button className={styles.publishButton} type="button" disabled={busy || !loaded} onClick={() => void publish()}>{busy ? <LoaderCircle size={15} className={styles.spinning} /> : <Send size={15} />} Terbitkan</button>
          </div></footer>
        </section>

        <aside className={styles.previewPanel}>
          <div className={styles.previewHeading}><strong>Pratinjau</strong><span className={styles.previewDevice}><Smartphone size={14} /></span></div>
          <div className={`${styles.previewCanvas} ${previewUrl ? styles.previewWithImage : ''}`} style={previewUrl ? { backgroundImage: `linear-gradient(180deg, rgb(0 0 0 / 18%), rgb(0 0 0 / 76%)), url("${previewUrl}")` } : undefined}>
            <span className={styles.previewBrand}>WINA JAYA TEXTILE</span><h3>{previewTitle}</h3>{previewBody && <p>{previewBody}</p>}
            {activeSection === 'trusted' && <div className={styles.previewLogoList}>{content.trusted.logos.length ? content.trusted.logos.map((logoPath, index) => <span key={`${logoPath}-${index}`}>{getHomeAssetUrl(logoPath) && <Image src={getHomeAssetUrl(logoPath)} alt="" fill sizes="120px" />}</span>) : <small>Logo akan tampil di area ini.</small>}</div>}
            {activeSection !== 'trusted' && <span className={styles.previewAction}>{activeSection === 'cta' ? content.cta.buttonLabel : activeSection === 'catalog' ? content.catalog.linkLabel : 'Jelajahi koleksi'} <ChevronRight size={13} /></span>}
          </div>
        </aside>
      </div>
    </section>
  );
}
