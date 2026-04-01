const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  allowedDevOrigins: ['app.telnyx.solutions', 'cpaas.telnyx.solutions'],
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
