/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // disabled — server uses `next start` directly
  // outputFileTracingRoot: path.join(__dirname, '../../'), // not needed without standalone
  async rewrites() {
    return [
      // Socket.IO polling must not get a trailing-slash 308 redirect
      {
        source: '/api/socket.io',
        destination: 'http://localhost:3001/api/socket.io',
        has: [{ type: 'query', key: 'EIO' }],
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
