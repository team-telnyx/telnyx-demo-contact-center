require('dotenv').config();
const crypto = require('crypto');

// Encryption settings (same as in userRoutes.js)
const algorithm = 'aes-256-gcm';
const secretKey = Buffer.from(process.env.ENCRYPTION_SECRET, 'utf8').slice(0, 32);

const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes256', secretKey);
  let crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + crypted;
};

// Encrypt the password
const encryptedPassword = encrypt('avaya123');
console.log('Encrypted password for avaya123:', encryptedPassword);
console.log('');
console.log('Now run this SQL command to update the database:');
console.log(`UPDATE Users SET sipPassword = '${encryptedPassword}' WHERE sipUsername = 'phillip1995';`);