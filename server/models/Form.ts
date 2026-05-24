import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export default function (sequelize: Sequelize) {
  const Form = sequelize.define('Form', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    schema: { type: DataTypes.JSONB, allowNull: false, defaultValue: { version: 1, pages: [], actions: [] } },
    variables: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    category: { type: DataTypes.STRING, defaultValue: 'general' },
    tags: { type: DataTypes.JSONB, defaultValue: [] },
    settings: { type: DataTypes.JSONB, defaultValue: {} },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    updatedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    indexes: [
      { fields: ['name'] },
      { fields: ['enabled'] },
    ],
  });

  return Form;
}
