import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';
import User from '../models/User.js';
import Conversations from '../models/Conversations.js';
import IvrFlow from '../models/IvrFlow.js';
import { encrypt } from '../src/utils/encryption.js';

const seedDatabase = async () => {
  // Tables already synced by server.js

  // Seed data
  const userData = [
    { username: 'john', password: 'password1', firstName: 'John', lastName: 'Doe', status: 'online', sipUsername: 'phillip1991',
    sipPassword: 'sip_password1', appConnectionId: null, webrtcConnectionId: null,
    telnyxApiKey: null, telnyxPublicKey: null, routingPriority: 2 },
    { username: 'phillip1995', password: 'password2', firstName: 'Phillip', lastName: 'Smith', status: 'online', sipUsername: 'phillip1995',
    sipPassword: 'avaya123', appConnectionId: null, webrtcConnectionId: null,
    telnyxApiKey: null, telnyxPublicKey: null, routingPriority: 1 },
    { username: 'test1991', password: 'password3', firstName: 'Steve', lastName: 'Johnson', status: 'offline', sipUsername: 'steve_sip',
    sipPassword: 'sip_password3', appConnectionId: null, webrtcConnectionId: null,
    telnyxApiKey: null, telnyxPublicKey: null, routingPriority: 10 },
  ];

  const conversationData = [
    { conversation_id: uuidv4(), from_number: '+1234567890', to_number: '+0987654321', agent_assigned: 'agent1', assigned: true, tag: 'outbound' },
    { conversation_id: uuidv4(), from_number: '+0987654321', to_number: '+1234567890', agent_assigned: 'agent2', assigned: false, tag: 'inbound' },
  ];

  // Hash passwords and create user records
  for (const user of userData) {
    const { username, password, firstName, lastName, sipUsername, sipPassword, status, appConnectionId, webrtcConnectionId, telnyxApiKey, telnyxPublicKey, routingPriority } = user;
    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = null;
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
      appConnectionId: appConnectionId || null,
      webrtcConnectionId: webrtcConnectionId || null,
      telnyxApiKey: telnyxApiKey || null,
      telnyxPublicKey: telnyxPublicKey || null,
      routingPriority: routingPriority || 10,
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

  // Seed default IVR flows
  const defaultFlows = [
    {
      name: 'Default Queue Flow',
      description: 'Answers the call, greets the caller, and places them in the General Queue for an agent to accept.',
      createdBy: 'phillip1995',
      active: false,
      flowData: {
        nodes: [
          { id: '1', type: 'incomingCall', position: { x: 350, y: 0 }, data: { label: 'Incoming Call', direction: 'incoming' } },
          { id: '2', type: 'answer', position: { x: 350, y: 100 }, data: { label: 'Answer' } },
          { id: '3', type: 'speak', position: { x: 350, y: 200 }, data: { label: 'Welcome', payload: 'Thank you for calling. Please hold while we connect you with an agent.', voice: 'female', language: 'en-US' } },
          { id: '4', type: 'enqueue', position: { x: 350, y: 330 }, data: { label: 'Agent Queue', queueName: 'General_Queue' } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#00a37a' } },
          { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#2563eb' } },
          { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#9333ea' } },
        ],
      },
    },
    {
      name: 'IVR Menu Example',
      description: 'Greets the caller with a menu — Press 1 for Sales, Press 2 for Support. Routes to different queues.',
      createdBy: 'phillip1995',
      active: false,
      flowData: {
        nodes: [
          { id: '1', type: 'incomingCall', position: { x: 350, y: 0 }, data: { label: 'Incoming Call', direction: 'incoming' } },
          { id: '2', type: 'answer', position: { x: 350, y: 100 }, data: { label: 'Answer' } },
          { id: '3', type: 'gather', position: { x: 350, y: 220 }, data: { label: 'Main Menu', method: 'speak', payload: 'Welcome. Press 1 for Sales, press 2 for Support, or press 3 to leave a voicemail.', maxDigits: '1', timeout: 10, digits: '1,2,3', voice: 'female', language: 'en-US' } },
          { id: '4', type: 'enqueue', position: { x: 80, y: 420 }, data: { label: 'Sales Queue', queueName: 'Sales_Queue' } },
          { id: '5', type: 'enqueue', position: { x: 350, y: 420 }, data: { label: 'Support Queue', queueName: 'Support_Queue' } },
          { id: '6', type: 'speak', position: { x: 620, y: 420 }, data: { label: 'Voicemail Prompt', payload: 'Please leave your message after the tone.', voice: 'female', language: 'en-US' } },
          { id: '7', type: 'recordStart', position: { x: 620, y: 550 }, data: { label: 'Record Voicemail', format: 'mp3', channels: 'single', maxLength: 120, trimSilence: 'true' } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#00a37a' } },
          { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#2563eb' } },
          { id: 'e3-4', source: '3', sourceHandle: 'digit-1', target: '4', label: '#1 Sales', style: { stroke: '#d97706' } },
          { id: 'e3-5', source: '3', sourceHandle: 'digit-2', target: '5', label: '#2 Support', style: { stroke: '#d97706' } },
          { id: 'e3-6', source: '3', sourceHandle: 'digit-3', target: '6', label: '#3 Voicemail', style: { stroke: '#d97706' } },
          { id: 'e6-7', source: '6', target: '7', animated: true, style: { stroke: '#e11d48' } },
        ],
      },
    },
  ];

  for (const flow of defaultFlows) {
    await IvrFlow.create({
      name: flow.name,
      description: flow.description,
      flowData: flow.flowData,
      createdBy: flow.createdBy,
      active: flow.active,
      phoneNumber: flow.phoneNumber || null,
    }).catch(err => console.log('Error seeding IVR flow:', err.message));
  }

  console.log('Database seeded!');
};

export default seedDatabase;
