import { DataTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';
import { encrypt, decrypt } from '../utils/crypto.js';

export function User(sequelize: Sequelize) {
  const model = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false }, // bcrypt hash
    displayName: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'agent', 'supervisor'), defaultValue: 'agent' },

    // Encrypted Telnyx credentials (per-user storage)
    telnyxApiKeyEncrypted: { type: DataTypes.TEXT },
    telnyxAppConnectionIdEncrypted: { type: DataTypes.TEXT },
    sipUsernameEncrypted: { type: DataTypes.TEXT },
    sipPasswordEncrypted: { type: DataTypes.TEXT },
  }, {
    timestamps: true,
    paranoid: true,
  });

  // Helpers — these need the encryption key at call time
  (model.prototype as any).setEncryptedField = function (field: string, plaintext: string | null, key: string) {
    this.setDataValue(field, plaintext ? encrypt(plaintext, key) : null);
  };

  (model.prototype as any).getEncryptedField = function (field: string, key: string) {
    const val = this.getDataValue(field);
    return val ? decrypt(val, key) : null;
  };

  return model;
}
