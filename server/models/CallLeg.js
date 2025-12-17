import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import CallSession from './CallSession';

class CallLeg extends Model {}

CallLeg.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Telnyx call_control_id for this leg
    call_control_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    // Associates this leg to a session by the session's sessionKey
    sessionKey: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    leg_type: {
      type: DataTypes.ENUM('customer', 'agent'),
      allowNull: false,
    },
    direction: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('new', 'ringing', 'active', 'ended', 'failed'),
      allowNull: false,
      defaultValue: 'new',
    },
    accepted_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hangup_source: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hangup_cause: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'CallLeg',
    tableName: 'call_legs',
  }
);

// Define association using non-primary unique key on CallSession
CallSession.hasMany(CallLeg, { foreignKey: 'sessionKey', sourceKey: 'sessionKey' });
CallLeg.belongsTo(CallSession, { foreignKey: 'sessionKey', targetKey: 'sessionKey' });

export default CallLeg;

