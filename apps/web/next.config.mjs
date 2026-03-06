// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@cubiqport/shared'],
  output: 'standalone',
  async rewrites() {
    const apiBase =
      process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
