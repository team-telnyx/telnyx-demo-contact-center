import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Task(sequelize: Sequelize) {
  return sequelize.define('Task', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    caseNoteId: { type: DataTypes.UUID, allowNull: false, references: { model: 'CaseNotes', key: 'id' } },
    callId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Calls', key: 'id' } },
    type: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), defaultValue: 'medium' },
    due: { type: DataTypes.DATE },
    completed: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    timestamps: true,
  });
}
