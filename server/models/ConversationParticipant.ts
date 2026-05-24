import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function ConversationParticipant(sequelize: Sequelize) {
  return sequelize.define('ConversationParticipant', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    conversationId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Conversations', key: 'id' } },
    agentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Agents', key: 'id' } },
    lastReadAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    unreadCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  }, {
    timestamps: true,
    indexes: [
      { unique: true, fields: ['conversationId', 'agentId'] },
    ],
  });
}
