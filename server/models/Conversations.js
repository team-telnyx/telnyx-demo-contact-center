import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import Messages from './Messages.js';

class Conversations extends Model {}

Conversations.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
  },
  conversation_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  from_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  to_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  agent_assigned: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  assigned: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  tag: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  last_message: {
    type: DataTypes.STRING(1024),
    allowNull: true,
  }
}, {
  sequelize,
  modelName: 'Conversations'
});

Conversations.hasMany(Messages, {
  foreignKey: 'conversation_id',
  as: 'messages'
});

Messages.belongsTo(Conversations, {
  foreignKey: 'conversation_id',
  as: 'conversation'
});

export default Conversations;
