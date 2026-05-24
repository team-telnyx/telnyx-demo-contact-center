import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export default function (sequelize: Sequelize) {
  const FormApproval = sequelize.define('FormApproval', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formSubmissionId: { type: DataTypes.UUID, allowNull: false, references: { model: 'FormSubmissions', key: 'id' } },
    formId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Forms', key: 'id' } },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'changes_requested'),
      allowNull: false, defaultValue: 'pending',
    },
    requestedBy: { type: DataTypes.UUID, allowNull: false },
    reviewedBy: { type: DataTypes.UUID, allowNull: true },
    reviewNote: { type: DataTypes.TEXT, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'), defaultValue: 'medium' },
    dueBy: { type: DataTypes.DATE, allowNull: true },
  }, {
    indexes: [
      { fields: ['formSubmissionId'] },
      { fields: ['status'] },
      { fields: ['requestedBy'] },
      { fields: ['reviewedBy'] },
    ],
  });
  return FormApproval;
}
