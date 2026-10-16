'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import { CartProvider } from '@/lib/cart-context';

const internalPortalPattern = /^\/(admin|sales|finance|warehouse|content|super-admin)(?:\/|$)/;

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isInternalPortal = internalPortalPattern.test(pathname);
  const isStandaloneCheckout = pathname === '/checkout' || pathname.startsWith('/payments/');
  const isStandaloneAuth = pathname === '/login' || pathname === '/register' || pathname === '/reset-password' || pathname === '/forgot-password';

  if (isInternalPortal) {
    return children;
  }

  return (
    <CartProvider>
      {isStandaloneCheckout || isStandaloneAuth ? children : <>
      <Navbar />
      <main>{children}</main>
      </>}
    </CartProvider>
  );
}
