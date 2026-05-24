/**
 * Database migration — syncs all models.
 * In production, use proper Sequelize migrations.
 */
import 'dotenv/config';
import { loadEnv } from '../config/env.js';
import { initDatabase } from '../config/database.js';
import { initModels } from '../models/index.js';

async function migrate() {
  const env = loadEnv();
  const sequelize = initDatabase(env.DATABASE_URL);
  const models = initModels(sequelize);

  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    await sequelize.sync({ alter: true });
    console.log('✅ All models synced');

    await sequelize.close();
    console.log('Done.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
