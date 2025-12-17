/**
 * Prisma Client for Cloudflare D1
 *
 * This module initializes Prisma with the D1 adapter for use in Cloudflare Workers
 * Documentation: https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1
 */

import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

/**
 * Initialize Prisma Client with D1 adapter
 *
 * @param {D1Database} d1Database - The D1 database binding from env.DB
 * @returns {PrismaClient} Configured Prisma Client instance
 *
 * Usage in Cloudflare Worker:
 *
 * const prisma = getPrismaClient(env.DB);
 * const users = await prisma.user.findMany();
 */
export function getPrismaClient(d1Database) {
  // Create D1 adapter
  const adapter = new PrismaD1(d1Database);

  // Initialize Prisma Client with adapter
  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

  return prisma;
}

/**
 * For local development with SQLite
 * Uses DATABASE_URL from .env
 */
export function getPrismaClientLocal() {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

  return prisma;
}
