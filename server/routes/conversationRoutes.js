import express from '#lib/router-shim';
import { getPrismaClient, getPrismaClientLocal } from '../lib/prisma.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { broadcast } from './websocket.js';

const router = express.Router();

// Initialize Prisma
let prisma;

const injectPrisma = (req, res, next) => {
  if (req.env && req.env.DB) {
    req.prisma = getPrismaClient(req.env.DB);
  } else {
    if (!prisma) {
      prisma = getPrismaClientLocal();
    }
    req.prisma = prisma;
  }
  next();
};

router.use(injectPrisma);

function normalizePhoneNumber(number) {
  if (!number) return '';
  const trimmed = number.trim();

  if (trimmed.toLowerCase().startsWith('sip:')) {
    return trimmed.toLowerCase();
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

function getConversationId(customerNumber) {
  return normalizePhoneNumber(customerNumber);
}

router.post('/composeMessage', async (req, res) => {
  const fromPhoneNumber = normalizePhoneNumber(req.body.From);
  const messageBody = req.body.Text;
  const dstNum = req.body.To;
  const agentUsername = req.body.agentUsername;

  try {
    // Send message via Telnyx
    const normalizedDestinationNumber = normalizePhoneNumber(dstNum);

    await axios.post('https://api.telnyx.com/v2/messages', {
      from: fromPhoneNumber,
      to: normalizedDestinationNumber,
      text: messageBody,
    }, {
      headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
    });
    console.log('Message composed and sent.');

    // Find or create conversation
    const conversation_id = getConversationId(normalizedDestinationNumber);

    let conversation = await req.prisma.conversation.findUnique({
      where: { conversation_id: conversation_id }
    });

    if (!conversation) {
      conversation = await req.prisma.conversation.create({
        data: {
          id: uuidv4(),
          conversation_id: conversation_id,
          from_number: normalizedDestinationNumber,
          to_number: fromPhoneNumber,
          agent_assigned: agentUsername || null,
          assigned: agentUsername ? true : false,
          tag: null
        }
      });
      console.log(`New conversation created and assigned to: ${agentUsername}`);
    } else if (!conversation.agent_assigned && agentUsername) {
      conversation = await req.prisma.conversation.update({
        where: { conversation_id: conversation_id },
        data: {
          agent_assigned: agentUsername,
          assigned: true,
          to_number: fromPhoneNumber
        }
      });
      console.log(`Existing conversation assigned to: ${agentUsername}`);
    }

    if (conversation) {
      const nowIso = new Date().toISOString();
      // Agent just sent a message, ensure the conversation is marked as read for them
      await req.prisma.$executeRaw`
        UPDATE Conversations
        SET last_read_at = ${nowIso}
        WHERE conversation_id = ${conversation.conversation_id}
      `;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error sending composed message:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Webhook for incoming messages
router.post('/webhook', async (req, res) => {
  const payload = req.body.data.payload;
  const event_type = req.body.data.event_type;

  if (payload.direction === 'inbound' && event_type === 'message.received') {
    const fromPhoneNumber = normalizePhoneNumber(payload.from.phone_number);
    const toPhoneNumber = normalizePhoneNumber(payload.to[0].phone_number);
    const messageText = payload.text;
    const messageType = payload.type;
    const tags = payload.tags.length > 0 ? payload.tags[0] : null;

    const conversation_id = getConversationId(fromPhoneNumber);

    let conversation = await req.prisma.conversation.findUnique({
      where: { conversation_id: conversation_id }
    });

    if (!conversation) {
      const newConversation = await req.prisma.conversation.create({
        data: {
          id: uuidv4(),
          conversation_id: conversation_id,
          from_number: fromPhoneNumber,
          to_number: toPhoneNumber,
          agent_assigned: null,
          assigned: false,
          tag: tags
        }
      });
      broadcast('NEW_CONVERSATION', newConversation, req.env);
      conversation = newConversation;
    } else {
      console.log("Conversation already exists. Skipping create operation.");
    }

    // Store the message
    let newMessage;
    try {
      newMessage = await req.prisma.message.create({
        data: {
          id: payload.id,
          direction: 'inbound',
          type: messageType,
          telnyx_number: toPhoneNumber,
          destination_number: fromPhoneNumber,
          text_body: messageText,
          tag: tags,
          conversation_id: conversation.conversation_id
        }
      });
    } catch (createError) {
      if (createError.code === 'P2002') {
        console.log('Duplicate inbound message detected, skipping broadcast:', payload.id);
        res.status(200).json({ status: 'ok', duplicate: true });
        return;
      }
      throw createError;
    }

    broadcast('NEW_MESSAGE', {
      ...newMessage,
      isAssigned: conversation.assigned,
      assignedAgent: conversation.agent_assigned
    }, req.env);

    console.log(conversation.assigned);

    // Update conversation metadata to reflect the latest inbound message
    const inboundTimestamp = new Date().toISOString();
    await req.prisma.$executeRaw`
      UPDATE Conversations
      SET last_message = ${messageText},
          updatedAt = ${inboundTimestamp}
      WHERE conversation_id = ${conversation.conversation_id}
    `;
  }

  // Handle finalized outbound messages
  if (payload.direction === 'outbound' && event_type === 'message.finalized') {
    const fromPhoneNumber = normalizePhoneNumber(payload.from.phone_number);
    const toPhoneNumber = normalizePhoneNumber(payload.to[0].phone_number);
    const messageText = payload.text;
    const messageType = payload.type;
    const messageId = payload.id;
    const tags = payload.tags.length > 0 ? payload.tags[0] : null;

    const conversation_id = getConversationId(toPhoneNumber);

    let conversation = await req.prisma.conversation.findUnique({
      where: { conversation_id: conversation_id }
    });

    if (!conversation) {
      const newConversation = await req.prisma.conversation.create({
        data: {
          id: uuidv4(),
          conversation_id: conversation_id,
          from_number: toPhoneNumber,
          to_number: fromPhoneNumber,
          agent_assigned: null,
          assigned: false,
          tag: tags
        }
      });
      broadcast('NEW_CONVERSATION', newConversation, req.env);
      conversation = newConversation;
    } else {
      console.log("Conversation already exists. Skipping create operation.");
    }

    // Create message record
    let newMessage;
    try {
      newMessage = await req.prisma.message.create({
        data: {
          id: messageId,
          type: messageType,
          direction: 'outbound',
          telnyx_number: fromPhoneNumber,
          destination_number: toPhoneNumber,
          text_body: messageText,
          tag: tags,
          conversation_id: conversation.conversation_id
        }
      });
    } catch (createError) {
      if (createError.code === 'P2002') {
        console.log('Duplicate outbound message detected, skipping broadcast:', messageId);
        res.status(200).json({ status: 'ok', duplicate: true });
        return;
      }
      throw createError;
    }
    broadcast('NEW_MESSAGE', newMessage, req.env);

    // Update the last message and mark the outbound update as read for the agent
    const outboundTimestamp = new Date().toISOString();
    await req.prisma.$executeRaw`
      UPDATE Conversations
      SET last_message = ${messageText},
          last_read_at = ${outboundTimestamp},
          updatedAt = ${outboundTimestamp}
      WHERE conversation_id = ${conversation.conversation_id}
    `;
  }

  res.json({ status: "ok" });
});

router.get('/unassignedConversations', async (req, res) => {
  try {
    console.log('Fetching unassigned conversations from database...');
    const conversations = await req.prisma.conversation.findMany({
      where: {
        agent_assigned: null,
      },
    });
    console.log('Found unassigned conversations:', conversations.length);
    console.log('Conversations data:', JSON.stringify(conversations, null, 2));
    res.json(conversations);
  } catch (err) {
    console.error('Error in unassignedConversations:', err);
    res.status(500).send('Server Error');
  }
});

router.post('/assignAgent', async (req, res) => {
  const { conversation_id, user } = req.body;

  console.log('👤 [assignAgent] Assigning conversation:', conversation_id, 'to agent:', user);

  if (!conversation_id) {
    return res.status(400).json({ message: 'Conversation ID is required' });
  }

  try {
    const conversation = await req.prisma.conversation.findUnique({
      where: { conversation_id }
    });

    if (!conversation) {
      console.log('❌ [assignAgent] Conversation not found');
      return res.status(404).json({ message: 'Conversation not found' });
    }

    console.log('👤 [assignAgent] Before update:', {
      agent_assigned: conversation.agent_assigned,
      updatedAt: conversation.updatedAt,
      last_read_at: conversation.last_read_at
    });

    // Update without modifying updatedAt
    const updatedConversation = await req.prisma.$executeRaw`
      UPDATE Conversations
      SET agent_assigned = ${user}, assigned = 1
      WHERE conversation_id = ${conversation_id}
    `;

    const finalConversation = await req.prisma.conversation.findUnique({
      where: { conversation_id }
    });

    console.log('👤 [assignAgent] After update:', {
      agent_assigned: finalConversation.agent_assigned,
      updatedAt: finalConversation.updatedAt,
      last_read_at: finalConversation.last_read_at
    });

    res.json({ message: 'Successfully assigned', conversation: finalConversation });
  } catch (error) {
    console.error('❌ [assignAgent] Error:', error);
    res.status(500).send('Server Error');
  }
});

// Mark conversation as read
router.post('/markAsRead', async (req, res) => {
  const { conversation_id } = req.body;

  console.log('📖 [markAsRead] Request received');
  console.log('📖 [markAsRead] conversation_id:', conversation_id);

  if (!conversation_id) {
    console.log('❌ [markAsRead] No conversation_id provided');
    return res.status(400).json({ message: 'conversation_id is required' });
  }

  try {
    const conversation = await req.prisma.conversation.findUnique({
      where: { conversation_id }
    });

    console.log('📖 [markAsRead] Conversation found:', !!conversation);

    if (!conversation) {
      console.log('❌ [markAsRead] Conversation not found');
      return res.status(404).json({ message: 'Conversation not found' });
    }

    console.log('📖 [markAsRead] Before update:');
    console.log('  - updatedAt:', conversation.updatedAt);
    console.log('  - last_read_at:', conversation.last_read_at);

    // Update last_read_at without changing updatedAt using raw SQL
    const nowIso = new Date().toISOString();
    await req.prisma.$executeRaw`
      UPDATE Conversations
      SET last_read_at = ${nowIso}
      WHERE conversation_id = ${conversation_id}
    `;

    const updatedConversation = await req.prisma.conversation.findUnique({
      where: { conversation_id }
    });

    console.log('📖 [markAsRead] After update:');
    console.log('  - updatedAt:', updatedConversation.updatedAt);
    console.log('  - last_read_at:', updatedConversation.last_read_at);
    console.log('✅ [markAsRead] Conversation marked as read successfully');

    res.json({ success: true, conversation: updatedConversation });
  } catch (err) {
    console.error('❌ [markAsRead] Error:', err);
    res.status(500).send('Server Error');
  }
});

router.get('/conversationMessages/:conversation_id', async (req, res) => {
  try {
    const messages = await req.prisma.message.findMany({
      where: {
        conversation_id: req.params.conversation_id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.get('/assignedTo/:agentUsername', async (req, res) => {
  try {
    const assignedConversations = await req.prisma.conversation.findMany({
      where: {
        agent_assigned: req.params.agentUsername
      },
    });
    res.json(assignedConversations);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Debug logging endpoint
router.post('/debug/log', (req, res) => {
  const { message, data, timestamp } = req.body;
  console.log(`\n🌐 [FRONTEND LOG] ${timestamp || new Date().toISOString()}`);
  console.log(`   ${message}`);
  if (data) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
  res.status(200).json({ received: true });
});

export default router;
