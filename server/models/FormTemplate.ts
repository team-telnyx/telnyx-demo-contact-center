import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export default function (sequelize: Sequelize) {
  const FormTemplate = sequelize.define('FormTemplate', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'general' },
    schema: { type: DataTypes.JSONB, allowNull: false },
    variables: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    isBuiltIn: { type: DataTypes.BOOLEAN, defaultValue: false },
    usageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    icon: { type: DataTypes.STRING, allowNull: true },
  }, {
    indexes: [
      { fields: ['category'] },
      { fields: ['isBuiltIn'] },
    ],
  });
  return FormTemplate;
}
