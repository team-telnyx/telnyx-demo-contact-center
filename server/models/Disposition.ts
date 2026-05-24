import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Disposition(sequelize: Sequelize) {
  return sequelize.define('Disposition', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING },
    color: { type: DataTypes.STRING, defaultValue: '#6366f1' },
    icon: { type: DataTypes.STRING, defaultValue: 'tag' },
    requireNotes: { type: DataTypes.BOOLEAN, defaultValue: false },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  }, { timestamps: true });
}
