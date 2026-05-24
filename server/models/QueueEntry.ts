import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function QueueEntry(sequelize: Sequelize) {
  return sequelize.define('QueueEntry', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    queueName: { type: DataTypes.STRING, allowNull: false },
    callId: { type: DataTypes.STRING },
    callSessionId: { type: DataTypes.STRING },
    callerNumber: { type: DataTypes.STRING },
    callerName: { type: DataTypes.STRING },
    enqueuedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    priority: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('waiting', 'routing', 'answered', 'abandoned', 'timed_out'),
      defaultValue: 'waiting',
      allowNull: false,
    },
    assignedAgentId: { type: DataTypes.UUID, allowNull: true, references: { model: 'Agents', key: 'id' } },
    answeredAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['queueName', 'status'] },
      { fields: ['callId'] },
      { fields: ['status'] },
    ],
  });
}
