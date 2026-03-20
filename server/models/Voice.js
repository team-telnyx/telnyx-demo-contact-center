import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Voice extends Model {}

Voice.init({
  uuid: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  direction: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telnyx_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  destination_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  queue_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  accept_agent: {
    type: DataTypes.STRING,
    allowNull: true
  },
  transfer_agent: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bridge_uuid: {
    type: DataTypes.STRING,
    allowNull: true
  },
  queue_uuid: {
    type: DataTypes.STRING,
    allowNull: true
  },
  conference_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
}, {
  sequelize,
  modelName: 'Voice',
});

export default Voice;
