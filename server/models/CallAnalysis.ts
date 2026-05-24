import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function CallAnalysis(sequelize: Sequelize) {
  return sequelize.define('CallAnalysis', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    callRecordId: { type: DataTypes.UUID, unique: true, references: { model: 'CallRecords', key: 'id' } },
    agentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Agents', key: 'id' } },
    audioUrl: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM('pending', 'transcribing', 'analyzing', 'complete', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    transcriptText: { type: DataTypes.TEXT },
    durationSeconds: { type: DataTypes.INTEGER },
    talkToListenRatio: { type: DataTypes.FLOAT },
    agentTalkPercent: { type: DataTypes.FLOAT },
    customerTalkPercent: { type: DataTypes.FLOAT },
    silencePercent: { type: DataTypes.FLOAT },
    interruptionCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    questionCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    fillerWordCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    sentimentOverall: {
      type: DataTypes.ENUM('positive', 'neutral', 'negative'),
      allowNull: true,
    },
    sentimentTrajectory: { type: DataTypes.JSONB, defaultValue: [] },
    overallScore: { type: DataTypes.FLOAT },
    scoreBreakdown: { type: DataTypes.JSONB, defaultValue: {} },
    keyMoments: { type: DataTypes.JSONB, defaultValue: [] },
    objections: { type: DataTypes.JSONB, defaultValue: [] },
    coachingTips: { type: DataTypes.JSONB, defaultValue: [] },
    summary: { type: DataTypes.TEXT },
    keywords: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    competitorMentions: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    scriptAdherenceScore: { type: DataTypes.FLOAT },
    closingAttempted: { type: DataTypes.BOOLEAN, defaultValue: false },
    closingSuccessful: { type: DataTypes.BOOLEAN, defaultValue: false },
    nextSteps: { type: DataTypes.JSONB, defaultValue: [] },
    rawLlmOutput: { type: DataTypes.JSONB },
    analyzedAt: { type: DataTypes.DATE },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['agentId', 'status'] },
      { fields: ['agentId', 'overallScore'] },
      { fields: ['overallScore'] },
    ],
  });
}
