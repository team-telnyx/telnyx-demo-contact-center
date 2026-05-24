import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function AgentSession(sequelize: Sequelize) {
  return sequelize.define('AgentSession', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    agentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Agents', key: 'id' } },
    status: {
      type: DataTypes.ENUM('offline', 'available', 'busy', 'wrap_up', 'break', 'lunch'),
      defaultValue: 'offline',
      allowNull: false,
    },
    currentCallId: { type: DataTypes.STRING, allowNull: true },
    statusChangedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    lastHeartbeat: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['agentId'], unique: true },
      { fields: ['status'] },
    ],
  });
}
