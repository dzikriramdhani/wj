'use client';

import { useState } from 'react';
import styles from './AdminPagination.module.css';

export type AdminPageSize = 10 | 20 | 'all';

export function useAdminPagination<T>(items: T[]) {
  const [pageSize, setPageSize] = useState<AdminPageSize>(10);
  const [page, setPage] = useState(1);
  const pageCount = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = items.length === 0 ? 0 : pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const endIndex = pageSize === 'all' ? items.length : Math.min(startIndex + pageSize, items.length);

  return {
    items: items.slice(startIndex, endIndex),
    page: currentPage,
    pageCount,
    pageSize,
    total: items.length,
    start: items.length === 0 ? 0 : startIndex + 1,
    end: endIndex,
    setPage: (nextPage: number) => setPage(Math.min(Math.max(nextPage, 1), pageCount)),
    setPageSize: (nextPageSize: AdminPageSize) => {
      setPageSize(nextPageSize);
      setPage(1);
    },
    resetPage: () => setPage(1),
  };
}

export default function AdminPagination({
  page,
  pageCount,
  pageSize,
  total,
  start,
  end,
  onPageChange,
  onPageSizeChange,
  label,
}: {
  page: number;
  pageCount: number;
  pageSize: AdminPageSize;
  total: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: AdminPageSize) => void;
  label: string;
}) {
  return (
    <div className={styles.bar}>
      <span className={styles.summary}>Menampilkan {start}–{end} dari {total}</span>
      <div className={styles.controls}>
        <label className={styles.pageSizeControl}>
          <span>Tampilkan</span>
          <select
            aria-label={`Jumlah ${label} per halaman`}
            value={pageSize}
            onChange={(event) => onPageSizeChange(event.target.value === 'all' ? 'all' : Number(event.target.value) as 10 | 20)}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="all">Semua</option>
          </select>
        </label>
        {pageSize !== 'all' && (
          <nav className={styles.navigation} aria-label={`Navigasi ${label}`}>
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Sebelumnya</button>
            <span>Halaman {page} dari {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Berikutnya</button>
          </nav>
        )}
      </div>
    </div>
  );
}
