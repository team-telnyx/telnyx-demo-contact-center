import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function AgentScorecard(sequelize: Sequelize) {
  return sequelize.define('AgentScorecard', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    agentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Agents', key: 'id' } },
    period: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
      allowNull: false,
    },
    periodStart: { type: DataTypes.DATE, allowNull: false },
    periodEnd: { type: DataTypes.DATE, allowNull: false },
    totalCalls: { type: DataTypes.INTEGER, defaultValue: 0 },
    totalMinutes: { type: DataTypes.FLOAT, defaultValue: 0 },
    avgScore: { type: DataTypes.FLOAT },
    scoreBreakdown: { type: DataTypes.JSONB, defaultValue: {} },
    avgTalkToListenRatio: { type: DataTypes.FLOAT },
    avgSilencePercent: { type: DataTypes.FLOAT },
    avgInterruptionRate: { type: DataTypes.FLOAT },
    avgQuestionRate: { type: DataTypes.FLOAT },
    topStrengths: { type: DataTypes.JSONB, defaultValue: [] },
    topWeaknesses: { type: DataTypes.JSONB, defaultValue: [] },
    coachingSummary: { type: DataTypes.TEXT },
    trend: {
      type: DataTypes.ENUM('improving', 'declining', 'stable'),
      defaultValue: 'stable',
    },
    rank: { type: DataTypes.INTEGER },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['agentId', 'period', 'periodStart'], unique: true },
    ],
  });
}
