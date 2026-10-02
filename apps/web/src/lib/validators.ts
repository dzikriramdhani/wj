// ============================================================
// WINA JAYA — Zod Validators
// Server-side validation for all API endpoints
// ============================================================

import { z } from 'zod';

// ---- Auth Validators ----
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter'),
  email: z
    .string()
    .email('Format email tidak valid'),
  phone: z
    .string()
    .min(10, 'Nomor telepon minimal 10 digit')
    .max(15, 'Nomor telepon maksimal 15 digit')
    .optional(),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(128, 'Password maksimal 128 karakter'),
});

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

// ---- Product Validators ----
export const createProductSchema = z.object({
  name: z.string().min(3, 'Nama produk minimal 3 karakter'),
  slug: z.string().min(3, 'Slug minimal 3 karakter').regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan strip'),
  sku: z.string().min(2, 'SKU minimal 2 karakter'),
  category: z.string().min(2, 'Kategori wajib diisi'),
  composition: z.string().min(2, 'Komposisi wajib diisi'),
  gsm: z.number().int().min(1, 'GSM harus lebih dari 0'),
  widthCm: z.number().int().min(1, 'Lebar kain harus lebih dari 0'),
  pricePerMeter: z.number().min(0, 'Harga tidak boleh negatif'),
  stockMeters: z.number().min(0, 'Stok tidak boleh negatif'),
  moqRetail: z.number().min(0, 'MOQ tidak boleh negatif'),
  isCustomOnly: z.boolean().default(false),
  description: z.string().min(10, 'Deskripsi minimal 10 karakter'),
  certifications: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
});

export const updateProductSchema = createProductSchema.partial();

// ---- RFQ Validators ----
export const createRFQSchema = z.object({
  productId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  specDetails: z.object({
    warna: z.string().max(100).optional(),
    motif: z.string().max(200).optional(),
    jenisKain: z.string().max(100).optional(),
    nama: z.string().min(2).max(120),
    email: z.string().email(),
    telepon: z.string().min(8).max(32),
    perusahaan: z.string().min(2).max(200),
    gramasiTarget: z.number().positive().max(2000).optional(),
    catatan: z.string().max(5000).optional(),
  }),
  qtyRequested: z.number().min(1, 'Jumlah minimal 1 meter'),
  deadline: z.string().datetime().optional(),
  attachments: z.array(z.string().min(1).max(500)).max(0).default([]),
});

export const updateRFQStatusSchema = z.object({
  status: z.enum([
    'SUBMITTED',
    'REVIEWED',
    'QUOTED',
    'NEGOTIATING',
    'ACCEPTED',
    'REJECTED',
    'IN_PRODUCTION',
    'COMPLETED',
  ]),
});

// ---- Contact Form Validator ----
export const contactFormSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  subject: z.string().min(3, 'Subjek minimal 3 karakter'),
  message: z.string().min(10, 'Pesan minimal 10 karakter'),
});

// ---- Product Filters ----
export const productFiltersSchema = z.object({
  category: z.string().optional(),
  color: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minGsm: z.number().optional(),
  maxGsm: z.number().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(12),
});
