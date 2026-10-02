'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LookbookAdminClient({ images }: { images: Array<{ path: string; url: string }> }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const upload = async () => {
    if (!files.length) return;
    setBusy(true); setMessage('');
    try { const form = new FormData(); files.forEach((file) => form.append('files', file)); const response = await fetch('/api/admin/lookbook', { method: 'POST', body: form }); const result = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) return setMessage(result.error ?? 'Unggahan gagal.'); setFiles([]); router.refresh(); } catch { setMessage('Koneksi ke server terputus.'); } finally { setBusy(false); }
  };
  const remove = async (path: string) => { setBusy(true); setMessage(''); try { const response = await fetch(`/api/admin/lookbook?path=${encodeURIComponent(path)}`, { method: 'DELETE' }); const result = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) return setMessage(result.error ?? 'Penghapusan gagal.'); router.refresh(); } catch { setMessage('Koneksi ke server terputus.'); } finally { setBusy(false); } };
  return <section className={styles.page}><header><div><p>MEDIA</p><h1>Lookbook</h1></div><a href="/lookbook" target="_blank" rel="noreferrer">Lihat publik →</a></header><div className={styles.upload}><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 12))} /><button type="button" onClick={upload} disabled={busy || !files.length}>Unggah gambar</button>{message && <span role="status">{message}</span>}</div><div className={styles.grid}>{images.map((image) => <figure key={image.path}><Image src={image.url} alt="Lookbook" width={800} height={1000} sizes="(max-width: 768px) 100vw, 25vw" /><button type="button" onClick={() => remove(image.path)} disabled={busy}>Hapus</button></figure>)}{!images.length && <p>Belum ada gambar lookbook.</p>}</div></section>;
}
