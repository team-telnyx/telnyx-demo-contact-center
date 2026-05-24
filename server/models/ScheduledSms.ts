import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function ScheduledSms(sequelize: Sequelize) {
  return sequelize.define(
    'ScheduledSms',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      fromNumber: { type: DataTypes.STRING, allowNull: false },
      toNumber: { type: DataTypes.STRING, allowNull: false },
      text: { type: DataTypes.TEXT, allowNull: false },
      scheduledAt: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed', 'cancelled'),
        defaultValue: 'pending',
      },
      conversationId: { type: DataTypes.UUID, allowNull: true },
      agentId: { type: DataTypes.UUID, allowNull: true },
      sentAt: { type: DataTypes.DATE, allowNull: true },
      error: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      timestamps: true,
      indexes: [{ fields: ['status', 'scheduledAt'] }],
    },
  );
}
