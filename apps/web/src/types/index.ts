// ============================================================
// WINA JAYA — Shared TypeScript Types
// ============================================================

// ---- User & Auth ----
export type Role = 'RETAIL' | 'BUSINESS' | 'SALES' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  companyName?: string;
  npwp?: string;
  businessVerifiedAt?: string;
  createdAt: string;
}

// ---- Product ----
export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: string;
  composition: string;
  gsm: number;
  widthCm: number;
  pricePerMeter: number;
  stockMeters: number;
  moqRetail: number;
  isCustomOnly: boolean;
  images: string[];
  description: string;
  certifications: string[];
  variants: ProductVariant[];
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  colorName: string;
  colorHex?: string;
  stock: number;
}

// ---- Product Filters ----
export interface ProductFilters {
  category?: string;
  color?: string;
  minGsm?: number;
  maxGsm?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

// ---- RFQ ----
export type RFQStatus =
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'QUOTED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'IN_PRODUCTION'
  | 'COMPLETED';

export interface RFQSpecDetails {
  warna?: string;
  motif?: string;
  gramasiTarget?: number;
  catatan?: string;
}

export interface RFQ {
  id: string;
  userId: string;
  productId?: string;
  productName?: string;
  specDetails: RFQSpecDetails;
  qtyRequested: number;
  deadline?: string;
  status: RFQStatus;
  attachments: string[];
  createdAt: string;
  user?: User;
  product?: Product;
}

// ---- Order (Fase 2+) ----
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: string;
  paymentStatus: string;
  trackingNumber?: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  qtyMeters: number;
  pricePerUnit: number;
}

// ---- Quotation (Fase 2+) ----
export interface Quotation {
  id: string;
  rfqId: string;
  salesUserId: string;
  pricePerUnit: number;
  totalPrice: number;
  paymentTerms: string;
  validUntil: string;
  status: string;
  createdAt: string;
}

// ---- Business Logic ----
export type PurchaseRoute = 'RETAIL' | 'RFQ';

// ---- Navigation ----
export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

// ---- Company Info ----
export interface CompanyInfo {
  name: string;
  tagline: string;
  description: string;
  founded: number;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  certifications: string[];
  capacity: string;
  totalClients: number;
  totalProducts: number;
}
