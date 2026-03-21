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
  routingPriority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  }
}, {
  sequelize,
  modelName: 'User'
});

export default User;
