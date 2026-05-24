import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function CaseNote(sequelize: Sequelize) {
  return sequelize.define('CaseNote', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    callId: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'Calls', key: 'id' } },
    callerName: { type: DataTypes.STRING },
    summary: { type: DataTypes.TEXT },
    keyPoints: { type: DataTypes.ARRAY(DataTypes.TEXT), defaultValue: [] },
    sentiment: { type: DataTypes.ENUM('positive', 'neutral', 'negative', 'urgent'), defaultValue: 'neutral' },
    rawLlmOutput: { type: DataTypes.JSONB },
  }, {
    timestamps: true,
  });
}
