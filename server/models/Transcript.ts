import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Transcript(sequelize: Sequelize) {
  return sequelize.define('Transcript', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    callId: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'Calls', key: 'id' } },
    fullText: { type: DataTypes.TEXT },
    segments: { type: DataTypes.JSONB, defaultValue: [] },
  }, {
    timestamps: true,
  });
}
