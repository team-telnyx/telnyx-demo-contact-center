import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function WorkflowExecution(sequelize: Sequelize) {
  return sequelize.define(
    'WorkflowExecution',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      workflowId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Workflows', key: 'id' },
      },
      triggerEvent: { type: DataTypes.STRING, allowNull: false },
      context: { type: DataTypes.JSONB, defaultValue: {} },
      results: { type: DataTypes.JSONB, defaultValue: [] },
      status: {
        type: DataTypes.ENUM('success', 'partial', 'failed'),
        defaultValue: 'success',
      },
      executedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      timestamps: true,
      indexes: [
        { fields: ['workflowId'] },
        { fields: ['executedAt'] },
      ],
    },
  );
}
