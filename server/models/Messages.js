import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Messages extends Model {}

Messages.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
  },
  direction: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telnyx_number: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  destination_number: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  text_body: {
    type: DataTypes.STRING,
    allowNull: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  media: {
    type: DataTypes.TEXT,  // Can use JSON or array type based on your database
    allowNull: true,
  },
  tag: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  conversation_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'Conversations',
      key: 'conversation_id'
    }
  }
}, {
  sequelize,
  modelName: 'Messages'
});

export default Messages;
