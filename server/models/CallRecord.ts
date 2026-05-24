import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function CallRecord(sequelize: Sequelize) {
  return sequelize.define('CallRecord', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    callId: { type: DataTypes.UUID, allowNull: true, references: { model: 'Calls', key: 'id' } },
    agentId: { type: DataTypes.UUID, allowNull: true },
    direction: { type: DataTypes.ENUM('inbound', 'outbound'), allowNull: false },
    from: { type: DataTypes.STRING },
    to: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING },
    queueName: { type: DataTypes.STRING },
    duration: { type: DataTypes.INTEGER },  // seconds
    recordingUrl: { type: DataTypes.TEXT },
    startedAt: { type: DataTypes.DATE },
    endedAt: { type: DataTypes.DATE },
    timeToAnswer: { type: DataTypes.INTEGER, allowNull: true },
    answeredWithinSla: { type: DataTypes.BOOLEAN, allowNull: true },
    caseNotesStatus: {
      type: DataTypes.STRING,
      defaultValue: 'pending',
      allowNull: false,
    },
    dispositionId: { type: DataTypes.UUID, allowNull: true },
    contactId: { type: DataTypes.UUID, allowNull: true },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    notes: { type: DataTypes.TEXT },
    // Telnyx CDR sync metadata
    telnyxRecordId: { type: DataTypes.STRING, allowNull: true, unique: true },
    source: { type: DataTypes.STRING, defaultValue: 'webhook', allowNull: false }, // 'webhook' | 'telnyx_cdr'
    lastSyncedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['queueName', 'startedAt'] },
    ],
  });
}
