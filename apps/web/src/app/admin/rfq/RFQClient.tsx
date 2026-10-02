'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import { getRFQStatusInfo, formatDate } from '@/lib/routing-logic';
import type { RFQ, RFQStatus } from '@/types';

export default function AdminRFQ({ rfqs: initialRFQs }: { rfqs: RFQ[] }) {
  const [rfqs, setRfqs] = useState(initialRFQs);
  const [activeTab, setActiveTab] = useState<RFQStatus | 'SEMUA'>('SEMUA');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<RFQStatus>('SUBMITTED');
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteTerms, setQuoteTerms] = useState('Pembayaran sesuai kesepakatan kedua pihak.');
  const [quoteValidUntil, setQuoteValidUntil] = useState('');

  const filteredRFQs = activeTab === 'SEMUA' 
    ? rfqs 
    : rfqs.filter(rfq => rfq.status === activeTab);

  const tabs: { label: string; value: RFQStatus | 'SEMUA' }[] = [
    { label: 'Semua', value: 'SEMUA' },
    { label: 'Diajukan', value: 'SUBMITTED' },
    { label: 'Ditinjau', value: 'REVIEWED' },
    { label: 'Penawaran Dikirim', value: 'QUOTED' },
    { label: 'Diterima', value: 'ACCEPTED' },
    { label: 'Ditolak', value: 'REJECTED' },
  ];

  const allStatuses: { label: string; value: RFQStatus }[] = [
    { label: 'Diajukan', value: 'SUBMITTED' },
    { label: 'Ditinjau', value: 'REVIEWED' },
    { label: 'Penawaran Dikirim', value: 'QUOTED' },
    { label: 'Diterima', value: 'ACCEPTED' },
    { label: 'Ditolak', value: 'REJECTED' },
  ];

  const handleViewDetail = (rfq: RFQ) => {
    setSelectedRFQ(rfq);
    setStatusUpdate(rfq.status);
  };

  const handleUpdateStatus = async () => {
    if (!selectedRFQ) return;
    const response = await fetch(`/api/rfq/${selectedRFQ.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusUpdate }),
    });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error ?? 'Perubahan status RFQ gagal disimpan.');
      return;
    }
    const updatedRFQ = { ...selectedRFQ, status: statusUpdate };
    setRfqs((items) => items.map((item) => item.id === selectedRFQ.id ? updatedRFQ : item));
    setSelectedRFQ(updatedRFQ);
    alert(`Status berhasil diubah menjadi: ${statusUpdate}`);
  };

  const handleCreateQuotation = async () => {
    if (!selectedRFQ || !quotePrice || !quoteValidUntil) return alert('Isi harga per meter dan masa berlaku quotation.');
    const response = await fetch('/api/quotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfqId: selectedRFQ.id, paymentTerms: quoteTerms, validUntil: new Date(quoteValidUntil).toISOString(), items: [{ description: selectedRFQ.productName ?? 'Permintaan kain', quantity: selectedRFQ.qtyRequested, unitPrice: Number(quotePrice) }] }),
    });
    const result = await response.json();
    if (!response.ok) return alert(result.error ?? 'Quotation belum dapat dibuat. Pastikan RFQ sudah berstatus Ditinjau.');
    const sent = await fetch(`/api/quotations/${result.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send' }) });
    if (!sent.ok) return alert('Draft quotation dibuat, tetapi belum dapat dikirim.');
    const updated = { ...selectedRFQ, status: 'QUOTED' as RFQStatus };
    setRfqs((items) => items.map((item) => item.id === updated.id ? updated : item)); setSelectedRFQ(updated);
    alert('Quotation berhasil dikirim ke portal perusahaan.');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>RFQ &amp; Penawaran</h1>
      </header>

      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button 
            key={tab.value}
            className={`${styles.tab} ${activeTab === tab.value ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>No</th>
              <th>ID RFQ</th>
              <th>Produk</th>
              <th>Jumlah (m)</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Tanggal Masuk</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredRFQs.map((rfq, index) => {
              const statusInfo = getRFQStatusInfo(rfq.status);
              return (
                <tr key={rfq.id}>
                  <td>{index + 1}</td>
                  <td style={{ fontWeight: 600 }}>{rfq.id}</td>
                  <td>{rfq.productName}</td>
                  <td>{rfq.qtyRequested.toLocaleString('id-ID')}</td>
                  <td>{rfq.deadline ? formatDate(rfq.deadline) : '-'}</td>
                  <td>
                    <span 
                      className={styles.statusBadge}
                      style={{ backgroundColor: statusInfo.color + '20', color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                  </td>
                  <td>{formatDate(rfq.createdAt)}</td>
                  <td>
                    <button 
                      className={styles.detailBtn}
                      onClick={() => handleViewDetail(rfq)}
                    >
                      Lihat Detail
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredRFQs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  Tidak ada RFQ untuk status ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRFQ && (
        <div className={styles.modalOverlay} onClick={() => setSelectedRFQ(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Detail RFQ: {selectedRFQ.id}</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedRFQ(null)}>✕</button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.detailSection}>
                <h3 className={styles.sectionTitle}>Informasi Pemesan</h3>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>User ID</span>
                    <span className={styles.detailValue}>{selectedRFQ.userId}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Tanggal Pengajuan</span>
                    <span className={styles.detailValue}>{formatDate(selectedRFQ.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className={styles.detailSection}>
                <h3 className={styles.sectionTitle}>Spesifikasi Pesanan</h3>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Produk / Jenis Kain</span>
                    <span className={styles.detailValue}>{selectedRFQ.productName}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Jumlah (Meter)</span>
                    <span className={styles.detailValue}>{selectedRFQ.qtyRequested.toLocaleString('id-ID')} m</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Target Selesai (Deadline)</span>
                    <span className={styles.detailValue}>{selectedRFQ.deadline ? formatDate(selectedRFQ.deadline) : 'Fleksibel'}</span>
                  </div>
                </div>
                
                <div className={styles.detailItem} style={{ marginTop: '1rem' }}>
                  <span className={styles.detailLabel}>Kebutuhan Khusus / Catatan</span>
                  <p className={styles.detailValue} style={{ 
                    backgroundColor: 'var(--color-bg)', 
                    padding: '1rem', 
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '4px'
                  }}>
                    {selectedRFQ.specDetails?.catatan || '-'}
                  </p>
                </div>
              </div>

              <div className={styles.detailSection}>
                <h3 className={styles.sectionTitle}>Update Status</h3>
                <div className={styles.statusUpdateArea}>
                  <span style={{ fontWeight: 500 }}>Ubah Status RFQ:</span>
                  <select 
                    className={styles.statusSelect}
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value as RFQStatus)}
                  >
                    {allStatuses.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                  <button className={styles.updateBtn} onClick={handleUpdateStatus}>
                    Simpan Perubahan
                  </button>
                </div>
              </div>

              {selectedRFQ.status === 'REVIEWED' && (
                <div className={styles.detailSection}>
                  <h3 className={styles.sectionTitle}>Terbitkan Quotation</h3>
                  <div className={styles.statusUpdateArea}>
                    <input className={styles.statusSelect} type="number" min="0" placeholder="Harga per meter (IDR)" value={quotePrice} onChange={(event) => setQuotePrice(event.target.value)} />
                    <input className={styles.statusSelect} type="datetime-local" value={quoteValidUntil} onChange={(event) => setQuoteValidUntil(event.target.value)} />
                    <input className={styles.statusSelect} value={quoteTerms} onChange={(event) => setQuoteTerms(event.target.value)} placeholder="Syarat pembayaran" />
                    <button className={styles.updateBtn} onClick={handleCreateQuotation}>Kirim Quotation</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
