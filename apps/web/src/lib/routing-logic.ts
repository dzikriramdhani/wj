// ============================================================
// WINA JAYA — Business Logic: Purchase Route Determination
// Sesuai PRD Teknis §6
// ============================================================

import { Product, PurchaseRoute } from '@/types';

/**
 * Menentukan jalur pembelian berdasarkan produk dan kuantitas yang diminta.
 * 
 * Rules:
 * 1. Jika produk hanya custom → RFQ
 * 2. Jika kuantitas > MOQ retail → RFQ (volume besar)
 * 3. Jika kuantitas ≤ stok tersedia → RETAIL (beli langsung)
 * 4. Jika stok tidak cukup → RFQ
 */
export function tentukanJalurPembelian(
  product: Pick<Product, 'isCustomOnly' | 'moqRetail' | 'stockMeters'>,
  requestedQty: number
): PurchaseRoute {
  if (product.isCustomOnly) {
    return 'RFQ';
  }
  if (requestedQty > product.moqRetail) {
    return 'RFQ';
  }
  if (requestedQty <= product.stockMeters) {
    return 'RETAIL';
  }
  return 'RFQ'; // stok tidak cukup untuk retail langsung
}

/**
 * Menentukan apakah tombol "Beli Sekarang" harus ditampilkan.
 * Tombol muncul jika ada skenario qty yang menghasilkan "RETAIL".
 */
export function shouldShowBuyNow(
  product: Pick<Product, 'isCustomOnly' | 'moqRetail' | 'stockMeters'>
): boolean {
  if (product.isCustomOnly) return false;
  if (product.stockMeters <= 0) return false;
  // Ada kemungkinan beli retail jika stok > 0 dan MOQ retail memungkinkan
  return true;
}

/**
 * Tombol "Ajukan Penawaran" selalu ditampilkan.
 */
export function shouldShowRFQ(): boolean {
  return true;
}

/**
 * Format harga ke Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format tanggal ke Indonesia locale
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Get status label & color for RFQ status
 */
export function getRFQStatusInfo(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    SUBMITTED: { label: 'Diajukan', color: 'info' },
    REVIEWED: { label: 'Sedang Ditinjau', color: 'warning' },
    QUOTED: { label: 'Penawaran Dikirim', color: 'accent' },
    NEGOTIATING: { label: 'Negosiasi', color: 'warning' },
    ACCEPTED: { label: 'Diterima', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    IN_PRODUCTION: { label: 'Dalam Produksi', color: 'info' },
    COMPLETED: { label: 'Selesai', color: 'success' },
  };
  return map[status] || { label: status, color: 'info' };
}
