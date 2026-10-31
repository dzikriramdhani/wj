import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import { resetSecurityHeaders, resetSecurityPaths } from './src/lib/reset-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseImagePattern = supabaseUrl ? new URL('/storage/v1/object/public/**', supabaseUrl) : null;
const scriptSrc = process.env.NODE_ENV === 'development'
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'avatar.vercel.sh', pathname: '/**' }, { protocol: 'https', hostname: 'cdn.simpleicons.org', pathname: '/**' }, ...(supabaseImagePattern ? [supabaseImagePattern] : [])] },
  async headers() {
    const globalHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; ${scriptSrc}; connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io; frame-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com https://maps.google.com https://www.google.com; upgrade-insecure-requests`,
      },
    ];

    return [
      { source: '/:path*', headers: globalHeaders },
      ...resetSecurityPaths.map((source) => ({ source, headers: resetSecurityHeaders })),
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
