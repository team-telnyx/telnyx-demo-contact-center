import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function CannedResponse(sequelize: Sequelize) {
  return sequelize.define('CannedResponse', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    shortcut: { type: DataTypes.STRING, unique: true, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.STRING },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    usageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { timestamps: true });
}
