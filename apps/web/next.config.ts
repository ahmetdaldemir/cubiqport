import type { NextConfig } from 'next';

// In production the API runs on the same machine, rewrite goes to localhost.
// In dev it falls back to NEXT_PUBLIC_API_URL.
const API_INTERNAL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@cubiqport/shared'],
  // Standalone output lets PM2 run the built app without the dev server
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
