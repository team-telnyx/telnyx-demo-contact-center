import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Agent(sequelize: Sequelize) {
  const model = sequelize.define('Agent', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'Users', key: 'id' } },
    priority: { type: DataTypes.INTEGER, defaultValue: 99, allowNull: false },  // lower = higher priority
    status: {
      type: DataTypes.ENUM('online', 'away', 'busy', 'break', 'dnd', 'offline', 'wrap_up'),
      defaultValue: 'offline',
      allowNull: false,
    },
    queues: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },  // queue names this agent belongs to
    sipUsername: { type: DataTypes.STRING },  // for matching WebRTC registrations
    activeCallId: { type: DataTypes.UUID, allowNull: true },
    skills: { type: DataTypes.JSONB, defaultValue: [] },  // [{name: 'billing', level: 1-5}, ...]
    extension: { type: DataTypes.STRING, unique: true },  // internal dialing extension (e.g. '1001')
    wrapUpUntil: { type: DataTypes.DATE, allowNull: true },
    totalCallsHandled: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastCallEndedAt: { type: DataTypes.DATE, allowNull: true },
    active: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
    presence: { type: DataTypes.ENUM('online', 'available', 'busy', 'away', 'offline'), defaultValue: 'offline' },
  }, {
    timestamps: true,
  });

  return model;
}
