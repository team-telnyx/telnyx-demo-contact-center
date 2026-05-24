import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';

export function Queue(sequelize: Sequelize) {
  return sequelize.define(
    'Queue',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, unique: true, allowNull: false },
      displayName: { type: DataTypes.STRING },
      strategy: {
        type: DataTypes.ENUM(
          'round-robin',
          'least-recent',
          'most-idle',
          'skills-weighted',
          'priority',
        ),
        defaultValue: 'round-robin',
      },
      maxWaitSeconds: { type: DataTypes.INTEGER, defaultValue: 300 },
      wrapUpSeconds: { type: DataTypes.INTEGER, defaultValue: 30 },
      slaTargetSeconds: { type: DataTypes.INTEGER, defaultValue: 20 },
      slaThresholdPct: { type: DataTypes.INTEGER, defaultValue: 80 },
      priority: { type: DataTypes.INTEGER, defaultValue: 50 },
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      musicOnHoldUrl: { type: DataTypes.STRING },
      maxQueueSize: { type: DataTypes.INTEGER, defaultValue: 50 },
      overflowAction: {
        type: DataTypes.ENUM('voicemail', 'callback', 'hangup', 'transfer'),
        defaultValue: 'voicemail',
      },
      overflowTarget: { type: DataTypes.STRING },
      requiredSkills: { type: DataTypes.JSONB, defaultValue: [] },
      metadata: { type: DataTypes.JSONB, defaultValue: {} },
    },
    { timestamps: true },
  );
}
