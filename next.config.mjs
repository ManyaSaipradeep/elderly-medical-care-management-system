/** @type {import('next').NextConfig} */
const security = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
];
export default {
  output: 'standalone',
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  async headers() { return [{ source: '/:path*', headers: security }]; },
};
