import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Message(sequelize: Sequelize) {
  return sequelize.define(
    'Message',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      conversationId: { type: DataTypes.UUID, allowNull: false },
      sender: {
        type: DataTypes.ENUM('visitor', 'agent', 'system'),
        allowNull: false,
      },
      senderName: { type: DataTypes.STRING },
      content: { type: DataTypes.TEXT, allowNull: false },
      contentType: {
        type: DataTypes.ENUM('text', 'html', 'file', 'image'),
        defaultValue: 'text',
      },
      metadata: { type: DataTypes.JSONB, defaultValue: {} },
      externalId: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: true, defaultValue: 'received' },
      readAt: { type: DataTypes.DATE },
    },
    { timestamps: true, indexes: [{ fields: ['conversationId', 'createdAt'] }] },
  );
}
