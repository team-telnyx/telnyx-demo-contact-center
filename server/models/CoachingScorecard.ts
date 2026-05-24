import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function CoachingScorecard(sequelize: Sequelize) {
  return sequelize.define('CoachingScorecard', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Agents', key: 'id' },
    },
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
    },
    callId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Calls', key: 'id' },
    },
    categoryScores: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    categoryNotes: { type: DataTypes.JSONB, defaultValue: {} },
    overallScore: { type: DataTypes.FLOAT, allowNull: false },
    notes: { type: DataTypes.TEXT },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['agentId'] },
      { fields: ['reviewerId'] },
      { fields: ['createdAt'] },
    ],
  });
}
