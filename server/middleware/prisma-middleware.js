/**
 * Universal Prisma Middleware
 *
 * This middleware injects Prisma client into all requests and provides
 * a compatibility layer for legacy Sequelize model imports.
 */

import { getPrismaClient, getPrismaClientLocal } from '../lib/prisma.js';

// Singleton prisma instance for local development
let prisma;

/**
 * Inject Prisma client into request object
 */
export function injectPrismaMiddleware(req, res, next) {
  if (req.env && req.env.DB) {
    // Cloudflare Workers environment
    req.prisma = getPrismaClient(req.env.DB);
  } else {
    // Local development environment
    if (!prisma) {
      console.log('🔌 Initializing local Prisma client...');
      prisma = getPrismaClientLocal();
    }
    req.prisma = prisma;
  }

  if (!req.prisma) {
    console.error('❌ CRITICAL: req.prisma is undefined in middleware!');
  } else {
    // console.log('✅ req.prisma injected successfully');
  }

  // Make prisma available globally for routes that don't use req.prisma yet
  global.prisma = req.prisma;

  next();
}
