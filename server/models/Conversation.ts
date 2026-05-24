import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Conversation(sequelize: Sequelize) {
  return sequelize.define(
    'Conversation',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      channel: {
        type: DataTypes.ENUM('voice', 'webchat', 'sms', 'email', 'internal'),
        allowNull: false,
        defaultValue: 'webchat',
      },
      status: {
        type: DataTypes.ENUM('waiting', 'active', 'closed', 'offline', 'invited'),
        defaultValue: 'waiting',
      },
      agentId: { type: DataTypes.UUID, allowNull: true },
      contactId: { type: DataTypes.UUID, allowNull: true },
      queueName: { type: DataTypes.STRING },
      visitorName: { type: DataTypes.STRING, defaultValue: 'Visitor' },
      visitorPhone: { type: DataTypes.STRING, allowNull: true },
      visitorEmail: { type: DataTypes.STRING },
      subject: { type: DataTypes.STRING },
      metadata: { type: DataTypes.JSONB, defaultValue: {} },
      startedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      endedAt: { type: DataTypes.DATE },
      lastMessageAt: { type: DataTypes.DATE },
      messageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      satisfaction: { type: DataTypes.INTEGER },
      slaResponseBy: { type: DataTypes.DATE, allowNull: true },
      transcriptSentAt: { type: DataTypes.DATE, allowNull: true },
      telnyxNumber: { type: DataTypes.STRING, allowNull: true },
    },
    { timestamps: true, indexes: [{ fields: ['channel', 'status'] }, { fields: ['status', 'queueName'] }] },
  );
}
