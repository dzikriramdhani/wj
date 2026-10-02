'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import { CartProvider } from '@/lib/cart-context';

const PaymentsSandboxContext = createContext(true);

export function usePaymentsSandbox() {
  return useContext(PaymentsSandboxContext);
}

const internalPortalPattern = /^\/(admin|sales|finance|warehouse|content|super-admin)(?:\/|$)/;

export default function SiteShell({
  children,
  paymentsSandbox,
}: {
  children: React.ReactNode;
  paymentsSandbox: boolean;
}) {
  const pathname = usePathname();
  const isInternalPortal = internalPortalPattern.test(pathname);

  if (isInternalPortal) {
    return (
      <PaymentsSandboxContext.Provider value={paymentsSandbox}>
        {children}
      </PaymentsSandboxContext.Provider>
    );
  }

  return (
    <PaymentsSandboxContext.Provider value={paymentsSandbox}>
      <CartProvider>
        {paymentsSandbox && (
          <p role="status" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, margin: 0, padding: '8px 16px', fontSize: 13, textAlign: 'center', background: '#111', color: '#fff' }}>
            Pembayaran Midtrans dan ongkir RajaOngkir memakai sandbox. Transaksi ini belum settlement produksi.
          </p>
        )}
        <Navbar offsetTop={paymentsSandbox ? 36 : 0} />
        <main style={paymentsSandbox ? { paddingTop: 36 } : undefined}>{children}</main>
      </CartProvider>
    </PaymentsSandboxContext.Provider>
  );
}
