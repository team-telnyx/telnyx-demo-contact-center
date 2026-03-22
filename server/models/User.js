import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class User extends Model {}

User.init({
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isNumeric: true,
    }
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'offline',
  },
  avatar: {
    type: DataTypes.BLOB,
    allowNull: true
  },
  sipUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sipPassword: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  telnyxApiKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  telnyxPublicKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  appConnectionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  webrtcConnectionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  onboardingComplete: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  assignedQueue: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'General_Queue',
  },
  routingPriority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  role: {
    type: DataTypes.ENUM('admin', 'agent'),
    allowNull: false,
    defaultValue: 'agent',
  },
  maxCalls: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  maxConversations: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
  },
  messagingProfileId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  outboundVoiceProfileId: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  sequelize,
  modelName: 'User'
});

export default User;
