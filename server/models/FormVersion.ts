import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export default function (sequelize: Sequelize) {
  const FormVersion = sequelize.define('FormVersion', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Forms', key: 'id' } },
    version: { type: DataTypes.INTEGER, allowNull: false },
    schema: { type: DataTypes.JSONB, allowNull: false },
    variables: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    changeNote: { type: DataTypes.STRING, allowNull: true },
    createdBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    indexes: [
      { fields: ['formId', 'version'], unique: true },
      { fields: ['formId'] },
    ],
  });
  return FormVersion;
}
