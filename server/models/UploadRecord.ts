import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function UploadRecord(sequelize: Sequelize) {
  return sequelize.define(
    'UploadRecord',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      originalName: { type: DataTypes.STRING, allowNull: false },
      storedPath: { type: DataTypes.STRING, allowNull: false },
      fileUrl: { type: DataTypes.STRING, allowNull: false },
      mimeType: { type: DataTypes.STRING, allowNull: false },
      size: { type: DataTypes.INTEGER, allowNull: false },
      category: {
        type: DataTypes.ENUM('image', 'audio', 'pdf', 'file'),
        allowNull: false,
        defaultValue: 'file',
      },
      uploadedBy: { type: DataTypes.UUID, allowNull: true },
      conversationId: { type: DataTypes.UUID, allowNull: true },
      messageId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      timestamps: true,
      indexes: [
        { fields: ['conversationId'] },
        { fields: ['uploadedBy'] },
        { fields: ['category'] },
      ],
    },
  );
}
