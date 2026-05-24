import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export default function (sequelize: Sequelize) {
  const FormSubmission = sequelize.define('FormSubmission', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Forms', key: 'id' } },
    data: { type: DataTypes.JSONB, allowNull: false },
    prefilledContext: { type: DataTypes.JSONB, allowNull: true },
    submittedBy: { type: DataTypes.UUID, allowNull: true },
    workflowExecutionId: { type: DataTypes.UUID, allowNull: true },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected', 'changes_requested'),
      defaultValue: 'submitted',
    },
    version: { type: DataTypes.INTEGER, allowNull: true },
    duration: { type: DataTypes.INTEGER, allowNull: true },
    ipAddress: { type: DataTypes.STRING, allowNull: true },
    userAgent: { type: DataTypes.STRING, allowNull: true },
  }, {
    indexes: [
      { fields: ['formId'] },
      { fields: ['submittedBy'] },
      { fields: ['createdAt'] },
    ],
  });

  return FormSubmission;
}
