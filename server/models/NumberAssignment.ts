import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function NumberAssignment(sequelize: Sequelize) {
  return sequelize.define('NumberAssignment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    phoneNumber: { type: DataTypes.STRING, unique: true, allowNull: false },
    ivrFlowId: { type: DataTypes.UUID, allowNull: true, references: { model: 'IvrFlows', key: 'id' } },
    connectionId: { type: DataTypes.STRING },
    lastUsedAt: { type: DataTypes.DATE, allowNull: true },
    // Messaging profile fields for 10DLC / toll-free / short-code routing
    messagingProfileId: { type: DataTypes.STRING, allowNull: true },
    countryCode: { type: DataTypes.STRING(2), allowNull: true }, // ISO 3166-1 alpha-2, e.g. 'US', 'AU'
    numberType: {
      type: DataTypes.ENUM('local', 'toll_free', 'short_code', 'alphanumeric'),
      allowNull: true,
    },
    smsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    label: { type: DataTypes.STRING, allowNull: true }, // human-readable e.g. '10DLC - Marketing'
  }, {
    timestamps: true,
  });
}
