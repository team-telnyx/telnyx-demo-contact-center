const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class CallSession extends Model {}

CallSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Telnyx customer/bridge leg call_control_id used as stable session key
    sessionKey: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('queued', 'ringing', 'active', 'ended', 'failed'),
      allowNull: false,
      defaultValue: 'queued',
    },
    direction: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    from_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    to_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'CallSession',
    tableName: 'call_sessions',
  }
);

module.exports = CallSession;

