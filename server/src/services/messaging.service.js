import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Conversations from '../../models/Conversations.js';
import Messages from '../../models/Messages.js';
import TelnyxService from './telnyx.service.js';
import { broadcast } from '../../routes/websocket.js';

function hashPhoneNumbers(arr) {
  const str = arr.join('');
  const hash = crypto.createHash('sha256');
  hash.update(str);
  return hash.digest('hex');
}

const MessagingService = {
  async sendMessage(from, to, text) {
    try {
      await TelnyxService.sendMessage(from, to, text);
      console.log('Message composed and sent.');
    } catch (error) {
      console.error('MessagingService.sendMessage error:', error.message);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  },

  async handleInboundWebhook(payload) {
    const fromPhoneNumber = payload.from.phone_number;
    const toPhoneNumber = payload.to[0].phone_number;
    const messageText = payload.text;
    const messageType = payload.type;
    const tags = payload.tags.length > 0 ? payload.tags[0] : null;

    const phone_number_array = [fromPhoneNumber, toPhoneNumber].sort();
    const conversation_id = hashPhoneNumbers(phone_number_array);

    let conversation = await Conversations.findOne({
      where: { conversation_id },
    });

    if (!conversation) {
      const newConversation = await Conversations.create({
        id: uuidv4(),
        conversation_id,
        from_number: toPhoneNumber,
        to_number: fromPhoneNumber,
        agent_assigned: null,
        assigned: false,
        tag: tags,
      });
      broadcast('NEW_CONVERSATION', newConversation);
      conversation = newConversation;
    } else {
      console.log('Conversation already exists. Skipping create operation.');
    }

    const newMessage = await Messages.create({
      id: uuidv4(),
      direction: 'inbound',
      type: messageType,
      telnyx_number: toPhoneNumber,
      destination_number: fromPhoneNumber,
      text_body: messageText,
      tag: tags,
      conversation_id: conversation.conversation_id,
    });

    broadcast('NEW_MESSAGE', {
      ...newMessage.get({ plain: true }),
      isAssigned: conversation.assigned,
      assignedAgent: conversation.agent_assigned,
    });

    await Conversations.update(
      { last_message: messageText },
      { where: { conversation_id: conversation.conversation_id } }
    );

    return newMessage;
  },

  async handleOutboundWebhook(payload) {
    const fromPhoneNumber = payload.from.phone_number;
    const toPhoneNumber = payload.to[0].phone_number;
    const messageText = payload.text;
    const messageType = payload.type;
    const tags = payload.tags.length > 0 ? payload.tags[0] : null;

    const phone_number_array = [fromPhoneNumber, toPhoneNumber].sort();
    const conversation_id = hashPhoneNumbers(phone_number_array);

    let conversation = await Conversations.findOne({
      where: { conversation_id },
    });

    if (!conversation) {
      const newConversation = await Conversations.create({
        id: uuidv4(),
        conversation_id: uuidv4(),
        from_number: fromPhoneNumber,
        to_number: toPhoneNumber,
        agent_assigned: 'agent1',
        assigned: true,
        tag: tags,
      });
      broadcast('NEW_CONVERSATION', newConversation);
      conversation = newConversation;
    } else {
      console.log('Conversation already exists. Skipping create operation.');
    }

    const newMessage = await Messages.create({
      id: uuidv4(),
      type: messageType,
      direction: 'outbound',
      telnyx_number: fromPhoneNumber,
      destination_number: toPhoneNumber,
      text_body: messageText,
      tag: tags,
      conversation_id: conversation.conversation_id,
    });

    broadcast('NEW_MESSAGE', newMessage);

    await Conversations.update(
      { last_message: messageText },
      { where: { conversation_id: conversation.conversation_id } }
    );

    return newMessage;
  },

  async getConversations(agentUsername) {
    try {
      const conversations = await Conversations.findAll({
        where: { agent_assigned: agentUsername },
      });
      return conversations;
    } catch (error) {
      console.error('MessagingService.getConversations error:', error.message);
      throw new Error(`Failed to get conversations: ${error.message}`);
    }
  },

  async getUnassignedConversations() {
    try {
      const conversations = await Conversations.findAll({
        where: { agent_assigned: null },
      });
      return conversations;
    } catch (error) {
      console.error('MessagingService.getUnassignedConversations error:', error.message);
      throw new Error(`Failed to get unassigned conversations: ${error.message}`);
    }
  },

  async assignAgent(conversationId, username) {
    try {
      const conversation = await Conversations.findOne({
        where: { conversation_id: conversationId },
      });

      if (!conversation) {
        throw Object.assign(new Error('Conversation not found'), { status: 404 });
      }

      await conversation.update({
        agent_assigned: username,
        assigned: true,
      });

      return conversation;
    } catch (error) {
      if (error.status) throw error;
      console.error('MessagingService.assignAgent error:', error.message);
      throw new Error(`Failed to assign agent: ${error.message}`);
    }
  },
};

export default MessagingService;
