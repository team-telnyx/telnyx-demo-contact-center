import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Callback(sequelize: Sequelize) {
  return sequelize.define('Callback', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    phoneNumber: { type: DataTypes.STRING, allowNull: false },
    callerName: { type: DataTypes.STRING },
    queueName: { type: DataTypes.STRING },
    requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    scheduledFor: { type: DataTypes.DATE },
    status: {
      type: DataTypes.ENUM('pending', 'calling', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    maxAttempts: { type: DataTypes.INTEGER, defaultValue: 3 },
    lastAttemptAt: { type: DataTypes.DATE },
    completedAt: { type: DataTypes.DATE },
    agentId: { type: DataTypes.UUID, allowNull: true },
    notes: { type: DataTypes.TEXT },
  }, { timestamps: true });
}
