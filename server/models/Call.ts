import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Call(sequelize: Sequelize) {
  return sequelize.define('Call', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    callControlId: { type: DataTypes.STRING, unique: true, allowNull: false },
    callSessionId: { type: DataTypes.STRING },
    direction: { type: DataTypes.ENUM('inbound', 'outbound'), allowNull: false },
    from: { type: DataTypes.STRING },
    to: { type: DataTypes.STRING },
    status: {
      type: DataTypes.ENUM('ringing', 'queued', 'active', 'on_hold', 'transferring', 'ended'),
      defaultValue: 'ringing',
    },
    agentId: { type: DataTypes.UUID, allowNull: true, references: { model: 'Agents', key: 'id' } },
    queueName: { type: DataTypes.STRING },
    queueId: { type: DataTypes.UUID, allowNull: true, references: { model: 'Queues', key: 'id' } },
   ivrFlowId: { type: DataTypes.UUID, allowNull: true },
    callerName: { type: DataTypes.STRING },
    startedAt: { type: DataTypes.DATE },
    endedAt: { type: DataTypes.DATE },
    recordingUrl: { type: DataTypes.TEXT },
    parentCallId: { type: DataTypes.UUID, allowNull: true },
    callPurpose: {
      type: DataTypes.ENUM('primary', 'whisper', 'transfer', 'agent_answer', 'monitor', 'barge'),
      defaultValue: 'primary',
    },
    dispositionId: { type: DataTypes.UUID, allowNull: true },
    contactId: { type: DataTypes.UUID, allowNull: true },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    notes: { type: DataTypes.TEXT },
    amdResult: { type: DataTypes.STRING, allowNull: true },
    transferType: { type: DataTypes.ENUM('cold', 'warm'), allowNull: true },
    transferredToAgentId: { type: DataTypes.UUID, allowNull: true, references: { model: 'Agents', key: 'id' } },
    isInternal: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['agentId', 'status'] },
    ],
  });
}
