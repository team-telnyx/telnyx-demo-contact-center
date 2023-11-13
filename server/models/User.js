const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

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
    allowNull: false
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,  
  },
  avatar: {
    type: DataTypes.BLOB,
    allowNull: true
  },
  sipUsername: {
    type: DataTypes.STRING,
    allowNull: false 
  },
  sipPassword: {
    type: DataTypes.STRING,
    allowNull: false 
  }
}, {
  sequelize,
  modelName: 'User'
});

module.exports = User;
