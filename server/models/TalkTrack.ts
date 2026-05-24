import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function TalkTrack(sequelize: Sequelize) {
  return sequelize.define('TalkTrack', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    category: {
      type: DataTypes.ENUM('Opening', 'Objection Handling', 'Closing', 'Compliance', 'Escalation'),
      allowNull: false,
      defaultValue: 'Opening',
    },
    script: { type: DataTypes.TEXT },
    tips: { type: DataTypes.TEXT },
    steps: { type: DataTypes.JSONB, defaultValue: [] },
    usageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    timestamps: true,
  });
}
