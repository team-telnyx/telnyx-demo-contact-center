import { Sequelize } from 'sequelize';

let sequelize: Sequelize | null = null;

/**
 * Initialise Sequelize with production-ready settings:
 *  - Connection pool (min: 2, max: 10)
 *  - Retry logic with exponential backoff
 *  - SSL for production (when DATABASE_URL contains sslmode=require)
 *  - Slow query logging in production (>1s)
 */
export function initDatabase(dbUrl: string): Sequelize {
  const isProduction = process.env.NODE_ENV === 'production';
  const sslRequired = isProduction && dbUrl.includes('sslmode=require');

  sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectOptions: sslRequired
      ? { ssl: { rejectUnauthorized: false } }
      : undefined,
    pool: {
      min: 2,
      max: 10,
      acquire: 30000,   // 30s to get a connection from the pool
      idle: 10000,      // 10s before an idle connection is released
    },
    retry: {
      max: 3,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /ECONNREFUSED/,
        /ECONNRESET/,
        /ETIMEDOUT/,
      ],
      backoffBase: 1000,   // initial retry delay: 1s
      backoffExponent: 1.5, // exponential factor
    },
    logging: isProduction
      ? (sql: string, timing?: number) => {
          // Log slow queries (>1s) in production
          if (typeof timing === 'number' && timing > 1000) {
            console.warn(`[DB SLOW QUERY] ${timing}ms: ${sql.slice(0, 200)}`);
          }
        }
      : false,
  });

  return sequelize;
}

export function getSequelize(): Sequelize {
  if (!sequelize) throw new Error('Database not initialized — call initDatabase() first');
  return sequelize;
}
