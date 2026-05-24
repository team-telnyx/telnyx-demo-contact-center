import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Contact(sequelize: Sequelize) {
  return sequelize.define('Contact', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    phoneNumber: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    company: { type: DataTypes.STRING },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    notes: { type: DataTypes.TEXT },
    metadata: { type: DataTypes.JSONB, defaultValue: {} },
    totalCalls: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastCallAt: { type: DataTypes.DATE },
    sentiment: { type: DataTypes.ENUM('positive', 'neutral', 'negative', 'unknown'), defaultValue: 'unknown' },
  }, { timestamps: true });
}
