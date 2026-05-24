import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function SmsTemplate(sequelize: Sequelize) {
  return sequelize.define(
    'SmsTemplate',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      category: { type: DataTypes.STRING, allowNull: true },
      isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      usageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      lastUsedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { timestamps: true },
  );
}
