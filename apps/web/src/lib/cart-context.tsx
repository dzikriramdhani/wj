// ============================================================
// WINA JAYA — Cart Context (Client-Side State Management)
// Fase 2 — Shopping cart with React Context
// ============================================================

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface CartItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  category: string;
  qtyMeters: number;
  minQtyMeters?: number;
  pricePerMeter: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQty: (productId: string, qtyMeters: number, variantId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  isReady: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const cartStorageKey = 'wj_cart_v1';

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return typeof item.productId === 'string'
    && typeof item.productName === 'string'
    && typeof item.category === 'string'
    && typeof item.qtyMeters === 'number'
    && Number.isFinite(item.qtyMeters)
    && item.qtyMeters > 0
    && (item.minQtyMeters === undefined || (typeof item.minQtyMeters === 'number' && Number.isFinite(item.minQtyMeters) && item.minQtyMeters > 0))
    && typeof item.pricePerMeter === 'number'
    && Number.isFinite(item.pricePerMeter)
    && item.pricePerMeter >= 0
    && (item.variantId === undefined || typeof item.variantId === 'string')
    && (item.variantName === undefined || typeof item.variantName === 'string');
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(cartStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as unknown;
          if (Array.isArray(parsed)) setItems(parsed.filter(isCartItem).slice(0, 30));
        }
      } catch {
        window.localStorage.removeItem(cartStorageKey);
      } finally {
        setIsReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(items));
    } catch {
      // The current checkout remains usable if browser storage is unavailable.
    }
  }, [isReady, items]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems(prev => {
      const existing = prev.find(
        i => i.productId === newItem.productId && i.variantId === newItem.variantId
      );
      if (existing) {
        return prev.map(i =>
          i.productId === newItem.productId && i.variantId === newItem.variantId
            ? { ...i, qtyMeters: i.qtyMeters + newItem.qtyMeters }
            : i
        );
      }
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId?: string) => {
    setItems(prev =>
      prev.filter(i => !(i.productId === productId && i.variantId === variantId))
    );
  }, []);

  const updateQty = useCallback((productId: string, qtyMeters: number, variantId?: string) => {
    if (qtyMeters <= 0) {
      removeItem(productId, variantId);
      return;
    }
    setItems(prev =>
      prev.map(i =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, qtyMeters }
          : i
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.qtyMeters, 0);
  const totalAmount = items.reduce((sum, i) => sum + i.pricePerMeter * i.qtyMeters, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalAmount, isReady }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
