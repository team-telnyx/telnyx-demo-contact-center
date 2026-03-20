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
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  destination_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  text_body: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  media: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tag: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'queued',
  },
  telnyx_message_id: {
    type: DataTypes.STRING,
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
