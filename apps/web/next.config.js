/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: { instrumentationHook: true },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      { source: '/api/proxy/:path*', destination: `${apiUrl}/api/v1/:path*` },
    ];
  },
};
module.exports = nextConfig;
