import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function IvrFlow(sequelize: Sequelize) {
  return sequelize.define('IvrFlow', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    nodes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    edges: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    published: { type: DataTypes.BOOLEAN, defaultValue: false },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
  }, {
    timestamps: true,
  });
}
