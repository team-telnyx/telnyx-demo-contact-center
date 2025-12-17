/**
 * Sequelize to D1 Migration Helper
 *
 * This module provides a compatibility layer to help migrate from Sequelize to D1.
 * It wraps the D1Adapter to provide a more Sequelize-like API where possible.
 *
 * For production, consider using Drizzle ORM or Prisma with D1 adapter instead:
 * - Drizzle ORM: https://orm.drizzle.team/docs/get-started-sqlite#cloudflare-d1
 * - Prisma: https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1
 */

const { D1Adapter } = require('./d1-adapter');

/**
 * Create a Sequelize-like model wrapper for D1
 */
class ModelWrapper {
  constructor(db, tableName, primaryKey = 'id') {
    this.db = db;
    this.tableName = tableName;
    this.primaryKey = primaryKey;
  }

  /**
   * Find one record by primary key
   * Similar to: Model.findByPk(id)
   */
  async findByPk(pk) {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    return await this.db.queryOne(sql, [pk]);
  }

  /**
   * Find one record by conditions
   * Similar to: Model.findOne({ where: { field: value } })
   */
  async findOne(where) {
    const keys = Object.keys(where);
    const values = Object.values(where);
    const whereClause = keys.map(k => `${k} = ?`).join(' AND ');
    const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
    return await this.db.queryOne(sql, values);
  }

  /**
   * Find all records matching conditions
   * Similar to: Model.findAll({ where: { field: value } })
   */
  async findAll(options = {}) {
    let sql = `SELECT * FROM ${this.tableName}`;
    const values = [];

    if (options.where) {
      const keys = Object.keys(options.where);
      const whereValues = Object.values(options.where);
      const whereClause = keys.map(k => `${k} = ?`).join(' AND ');
      sql += ` WHERE ${whereClause}`;
      values.push(...whereValues);
    }

    if (options.order) {
      // Support simple order: [['field', 'DESC']]
      if (Array.isArray(options.order) && options.order.length > 0) {
        const [field, direction] = options.order[0];
        sql += ` ORDER BY ${field} ${direction || 'ASC'}`;
      }
    }

    if (options.limit) {
      sql += ` LIMIT ?`;
      values.push(options.limit);
    }

    const result = await this.db.query(sql, values);
    return result.results || [];
  }

  /**
   * Create a new record
   * Similar to: Model.create({ field: value })
   */
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;

    const result = await this.db.execute(sql, values);

    // Return the created record with ID
    return {
      [this.primaryKey]: result.meta.last_row_id,
      ...data
    };
  }

  /**
   * Update records
   * Similar to: Model.update({ field: value }, { where: { id: 1 } })
   */
  async update(data, options) {
    const updateKeys = Object.keys(data);
    const updateValues = Object.values(data);
    const setClause = updateKeys.map(k => `${k} = ?`).join(', ');

    const whereKeys = Object.keys(options.where);
    const whereValues = Object.values(options.where);
    const whereClause = whereKeys.map(k => `${k} = ?`).join(' AND ');

    const sql = `UPDATE ${this.tableName} SET ${setClause}, updatedAt = datetime('now') WHERE ${whereClause}`;

    await this.db.execute(sql, [...updateValues, ...whereValues]);
    return [1]; // Return count of affected rows (simplified)
  }

  /**
   * Delete records
   * Similar to: Model.destroy({ where: { id: 1 } })
   */
  async destroy(options) {
    const keys = Object.keys(options.where);
    const values = Object.values(options.where);
    const whereClause = keys.map(k => `${k} = ?`).join(' AND ');
    const sql = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;

    const result = await this.db.execute(sql, values);
    return result.meta.changes || 0;
  }

  /**
   * Count records
   * Similar to: Model.count({ where: { field: value } })
   */
  async count(options = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const values = [];

    if (options.where) {
      const keys = Object.keys(options.where);
      const whereValues = Object.values(options.where);
      const whereClause = keys.map(k => `${k} = ?`).join(' AND ');
      sql += ` WHERE ${whereClause}`;
      values.push(...whereValues);
    }

    const result = await this.db.queryOne(sql, values);
    return result ? result.count : 0;
  }
}

/**
 * Initialize models with D1 adapter
 * Usage in your routes:
 *
 * const { User, CallSession, Conversation } = initModels(env.DB);
 * const user = await User.findOne({ where: { username: 'john' } });
 */
function initModels(d1Database) {
  const db = new D1Adapter(d1Database);

  return {
    User: new ModelWrapper(db, 'Users', 'id'),
    Voice: new ModelWrapper(db, 'Voices', 'uuid'),
    CallSession: new ModelWrapper(db, 'call_sessions', 'id'),
    CallLeg: new ModelWrapper(db, 'call_legs', 'id'),
    Conversation: new ModelWrapper(db, 'Conversations', 'id'),
    Message: new ModelWrapper(db, 'Messages', 'id'),

    // Also expose the raw D1 adapter for complex queries
    db
  };
}

module.exports = { ModelWrapper, initModels };
