import type { NextConfig } from "next";
import path from "path";

// Override console.log to filter out SSE logs
const originalLog = console.log;
console.log = (...args: any[]) => {
  const message = args.join(' ');
  // Filter out SSE event logs
  if (message.includes('GET /api/events/calls')) {
    return;
  }
  originalLog(...args);
};

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Reduce bundle size
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Experimental features for faster builds
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
};

export default nextConfig;
