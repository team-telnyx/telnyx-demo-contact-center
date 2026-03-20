import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class IvrFlow extends Model {}

IvrFlow.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  flowData: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const raw = this.getDataValue('flowData');
      return raw ? JSON.parse(raw) : null;
    },
    set(val) {
      this.setDataValue('flowData', typeof val === 'string' ? val : JSON.stringify(val));
    },
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'IvrFlow',
});

export default IvrFlow;
