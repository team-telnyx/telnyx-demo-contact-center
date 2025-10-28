const sequelize = require('../config/database'); // Make sure to point this to your actual database config file
const User = require('../models/User');  // Again, make sure this points to your actual User model file
const bcrypt = require('bcryptjs');
const Conversations = require('../models/Conversations');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const secretKey = crypto.createHash('sha256').update(process.env.ENCRYPTION_SECRET || 'dev-encryption-secret-key-change-in-production-32-chars-long').digest();

// Modern encryption utility function
const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return iv.toString('hex') + ':' + crypted;
};

const decrypt = (text) => {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = textParts.join(':');
  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
  let dec = decipher.update(encryptedText, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
};

const seedDatabase = async () => {
  // Sync the User model with the database, create the table if it doesn't exist
  await sequelize.sync({ force: true });

  // Seed data
  const userData = [
    { username: 'john', password: 'password1', firstName: 'John', lastName: 'Doe', status: true, sipUsername: 'john_sip', 
    sipPassword: 'sip_password1'  },
    { username: 'phillip1995', password: 'password2', firstName: 'Phillip', lastName: 'Smith', status: true, sipUsername: 'phillip1995', 
    sipPassword: 'avaya123'  },
    { username: 'test1991', password: 'password3', firstName: 'Steve', lastName: 'Johnson', status: true, sipUsername: 'steve_sip', 
    sipPassword: 'sip_password3'   },
  ];

  const conversationData = [
    { conversation_id: uuidv4(), from_number: '+1234567890', to_number: '+0987654321', agent_assigned: 'agent1', assigned: true, tag: 'outbound' },
    { conversation_id: uuidv4(), from_number: '+0987654321', to_number: '+1234567890', agent_assigned: 'agent2', assigned: false, tag: 'inbound' },
    // Add more records as needed
  ];

  // Hash passwords and create user records
  for (const user of userData) {
    const { username, password, firstName, lastName, sipUsername, sipPassword, status } = user;
    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = null; // Optionally you can add logic to create a default avatar based on firstName and lastName here
    const encryptedSipPassword = encrypt(sipPassword)
    await User.create({
      username,
      password: hashedPassword,
      firstName,
      lastName,
      status,
      avatar,
      sipUsername,
      sipPassword: encryptedSipPassword,
    }).catch(err => {
      console.log(err);
    });
  }

  for (const convo of conversationData) {
    await Conversations.create({
      id: uuidv4(),
      conversation_id: convo.conversation_id,
      from_number: convo.from_number,
      to_number: convo.to_number,
      agent_assigned: convo.agent_assigned,
      assigned: convo.assigned,
      tag: convo.tag
    }).catch(err => {
      console.log(err);
    });
  }

  console.log('Database seeded!');
};

module.exports = seedDatabase;