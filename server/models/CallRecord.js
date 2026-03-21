import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CallRecord = sequelize.define('CallRecord', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  telnyxCallControlId: { type: DataTypes.STRING, allowNull: false },
  direction: { type: DataTypes.ENUM('inbound', 'outbound'), allowNull: false },
  fromNumber: { type: DataTypes.STRING, allowNull: false },
  toNumber: { type: DataTypes.STRING, allowNull: false },
  agentUsername: { type: DataTypes.STRING },
  queueName: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('queued', 'ringing', 'active', 'completed', 'missed', 'failed'), defaultValue: 'queued' },
  disposition: { type: DataTypes.STRING },
  startedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  answeredAt: { type: DataTypes.DATE },
  endedAt: { type: DataTypes.DATE },
  durationSeconds: { type: DataTypes.INTEGER },
  waitTimeSeconds: { type: DataTypes.INTEGER },
  recordingUrl: { type: DataTypes.STRING },
  transferredToAgent: { type: DataTypes.STRING },
  transferType: { type: DataTypes.ENUM('cold', 'warm') },
  metadata: { type: DataTypes.JSON },
});

export default CallRecord;
