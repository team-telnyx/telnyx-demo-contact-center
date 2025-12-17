// Stub for Sequelize models in Cloudflare Workers
// Workers use Prisma, so these are only for type compatibility

export default class SequelizeStub {
  static async findOne() { throw new Error('Use Prisma in Workers'); }
  static async findAll() { throw new Error('Use Prisma in Workers'); }
  static async create() { throw new Error('Use Prisma in Workers'); }
  static async update() { throw new Error('Use Prisma in Workers'); }
  static async destroy() { throw new Error('Use Prisma in Workers'); }
  static async findOrCreate() { throw new Error('Use Prisma in Workers'); }
}
