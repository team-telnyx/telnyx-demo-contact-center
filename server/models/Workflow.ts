import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Workflow(sequelize: Sequelize) {
  return sequelize.define(
    'Workflow',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, defaultValue: '' },
      trigger: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      actions: { type: DataTypes.JSONB, defaultValue: [] },
      enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      lastRunAt: { type: DataTypes.DATE, allowNull: true },
      runCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { timestamps: true },
  );
}
