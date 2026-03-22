import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { encrypt } from '../src/utils/encryption.js';

const generateRandomString = (length) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const seedDatabase = async () => {
  const ulid = Date.now().toString(36) + generateRandomString(8);
  const sipUsername = `admin${ulid}`;
  const sipPassword = generateRandomString(32);
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const encryptedSipPassword = encrypt(sipPassword);

  await User.create({
    username: 'admin',
    password: hashedPassword,
    firstName: 'System',
    lastName: 'Administrator',
    role: 'admin',
    status: 'offline',
    sipUsername,
    sipPassword: encryptedSipPassword,
    routingPriority: 1,
  }).catch(err => console.log('Admin seed error:', err.message));

  console.log('Database seeded with admin account!');
  console.log('Username: admin');
  console.log('Password: admin123 (change this immediately)');
};

export default seedDatabase;
