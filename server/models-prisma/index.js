/**
 * Prisma Model Adapters
 *
 * These adapters provide a Sequelize-compatible API for existing routes
 * while using Prisma under the hood. This allows gradual migration.
 */

class ModelAdapter {
  constructor(prisma, modelName) {
    this.prisma = prisma;
    this.modelName = modelName;
    this.model = prisma[modelName];
  }

  // Sequelize: Model.findOne({ where: { field: value } })
  async findOne(options) {
    const where = options.where || {};
    return await this.model.findFirst({ where });
  }

  // Sequelize: Model.findByPk(id)
  async findByPk(id) {
    const primaryKey = this.getPrimaryKey();
    return await this.model.findUnique({ where: { [primaryKey]: id } });
  }

  // Sequelize: Model.findAll(options)
  async findAll(options = {}) {
    const prismaOptions = {};

    if (options.where) {
      prismaOptions.where = this.convertWhere(options.where);
    }

    if (options.order) {
      prismaOptions.orderBy = this.convertOrder(options.order);
    }

    if (options.limit) {
      prismaOptions.take = options.limit;
    }

    if (options.offset) {
      prismaOptions.skip = options.offset;
    }

    if (options.attributes) {
      prismaOptions.select = {};
      options.attributes.forEach(attr => {
        prismaOptions.select[attr] = true;
      });
    }

    return await this.model.findMany(prismaOptions);
  }

  // Sequelize: Model.create({ field: value })
  async create(data) {
    return await this.model.create({ data });
  }

  // Sequelize: Model.update({ field: value }, { where: { id: 1 } })
  async update(data, options) {
    const where = options.where || {};

    // Prisma doesn't support mass update with findMany, so we need to handle this
    if (Object.keys(where).length === 1 && where[this.getPrimaryKey()]) {
      // Single record update
      return await this.model.update({
        where: { [this.getPrimaryKey()]: where[this.getPrimaryKey()] },
        data
      });
    } else {
      // Mass update - update all matching records
      return await this.model.updateMany({
        where: this.convertWhere(where),
        data
      });
    }
  }

  // Sequelize: Model.destroy({ where: { id: 1 } })
  async destroy(options) {
    const where = options.where || {};

    if (Object.keys(where).length === 1 && where[this.getPrimaryKey()]) {
      return await this.model.delete({
        where: { [this.getPrimaryKey()]: where[this.getPrimaryKey()] }
      });
    } else {
      return await this.model.deleteMany({
        where: this.convertWhere(where)
      });
    }
  }

  // Sequelize: Model.count({ where: { field: value } })
  async count(options = {}) {
    const where = options.where ? this.convertWhere(options.where) : {};
    return await this.model.count({ where });
  }

  // Convert Sequelize where clauses to Prisma format
  convertWhere(where) {
    const converted = {};

    for (const [key, value] of Object.entries(where)) {
      if (value && typeof value === 'object' && value.constructor.name === 'Object') {
        // Handle Sequelize operators
        if (value.gte !== undefined) {
          converted[key] = { gte: value.gte };
        } else if (value.lte !== undefined) {
          converted[key] = { lte: value.lte };
        } else if (value.gt !== undefined) {
          converted[key] = { gt: value.gt };
        } else if (value.lt !== undefined) {
          converted[key] = { lt: value.lt };
        } else if (value.in !== undefined) {
          converted[key] = { in: value.in };
        } else if (value.notIn !== undefined) {
          converted[key] = { notIn: value.notIn };
        } else if (value.not !== undefined) {
          converted[key] = { not: value.not };
        } else if (value.contains !== undefined) {
          converted[key] = { contains: value.contains };
        } else {
          converted[key] = value;
        }
      } else {
        converted[key] = value;
      }
    }

    return converted;
  }

  // Convert Sequelize order to Prisma orderBy
  convertOrder(order) {
    if (!order || order.length === 0) return undefined;

    // Sequelize: order: [['field', 'DESC']]
    // Prisma: orderBy: { field: 'desc' }
    if (Array.isArray(order[0])) {
      const [field, direction] = order[0];
      return { [field]: direction.toLowerCase() };
    }

    return undefined;
  }

  // Get primary key for this model
  getPrimaryKey() {
    const keys = {
      user: 'id',
      voice: 'uuid',
      callSession: 'id',
      callLeg: 'id',
      conversation: 'id',
      message: 'id'
    };
    return keys[this.modelName] || 'id';
  }

  // Instance methods for compatibility
  async save() {
    // Used after modifications to an instance
    // In Prisma, we don't have instances, so this is a no-op
    return this;
  }

  async reload() {
    // Reload data from database
    return this;
  }

  get(options) {
    // Sequelize: instance.get({ plain: true })
    if (options && options.plain) {
      return { ...this };
    }
    return this;
  }
}

// Create adapter instances
function createModelAdapters(prisma) {
  return {
    User: new ModelAdapter(prisma, 'user'),
    Voice: new ModelAdapter(prisma, 'voice'),
    CallSession: new ModelAdapter(prisma, 'callSession'),
    CallLeg: new ModelAdapter(prisma, 'callLeg'),
    Conversation: new ModelAdapter(prisma, 'conversation'),
    Conversations: new ModelAdapter(prisma, 'conversation'), // Alias
    Message: new ModelAdapter(prisma, 'message'),
    Messages: new ModelAdapter(prisma, 'message'), // Alias
  };
}

module.exports = { ModelAdapter, createModelAdapters };
