export const resetSecurityHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'no-store' },
] as const;

export const resetSecurityPaths = [
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
] as const;
