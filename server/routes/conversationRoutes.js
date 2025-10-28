const express = require('express');
const Conversations = require('../models/Conversations'); // Import your model
const Messages = require('../models/Messages'); // Import your model
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const axios = require('axios');
const { Op } = require("sequelize");
const { broadcast } = require('./websocket');


function hash(arr) {
  const str = arr.join('');
  const hash = crypto.createHash('sha256');
  hash.update(str);
  return hash.digest('hex');
}

router.post('/composeMessage', async (req, res) => {
    const fromPhoneNumber = req.body.From; // Agent's number
    const messageBody = req.body.Text; // The message body
    const dstNum = req.body.To; // Destination number (Customer's number)
    const agentUsername = req.body.agentUsername; // Agent username for assignment

    try {
      // Send message via Telnyx
      await axios.post('https://api.telnyx.com/v2/messages', {
        from: fromPhoneNumber,
        to: dstNum,
        text: messageBody,
      }, {
        headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
      });
      console.log('Message composed and sent.');

      // Find or create conversation
      const phone_number_array = [fromPhoneNumber, dstNum].sort();
      const conversation_id = hash(phone_number_array);

      let conversation = await Conversations.findOne({
        where: { conversation_id: conversation_id }
      });

      if (!conversation) {
        // Create new conversation and auto-assign to the composing agent
        conversation = await Conversations.create({
          id: uuidv4(),
          conversation_id: conversation_id,
          from_number: fromPhoneNumber,
          to_number: dstNum,
          agent_assigned: agentUsername || null,
          assigned: agentUsername ? true : false,
          tag: null
        });
        console.log(`New conversation created and assigned to: ${agentUsername}`);
      } else if (!conversation.agent_assigned && agentUsername) {
        // If conversation exists but unassigned, assign it to the composing agent
        await conversation.update({
          agent_assigned: agentUsername,
          assigned: true
        });
        console.log(`Existing conversation assigned to: ${agentUsername}`);
      }

      // Don't create message here - let message.sent webhook handle it
      // Just return success so UI knows the request went through
      res.status(200).json({
        success: true
      });
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
    const fromPhoneNumber = payload.from.phone_number;
    const toPhoneNumber = payload.to[0].phone_number;
    const messageText = payload.text;  // Add this line to capture the message text
    const messageType = payload.type;  // Add this line to capture the message type 
    const tags = payload.tags.length > 0 ? payload.tags[0] : null;
  
    const phone_number_array = [fromPhoneNumber, toPhoneNumber].sort();
    const conversation_id = hash(phone_number_array);

    // Query to look for existing conversation that matches the generated conversation_id
    let conversation = await Conversations.findOne({
      where: { 
        conversation_id: conversation_id
      }
    });

    if (!conversation) {
      const newConversation = await Conversations.create({
        id: uuidv4(),
        conversation_id: conversation_id,
        from_number: toPhoneNumber,
        to_number: fromPhoneNumber,
        agent_assigned: null,
        assigned: false,
        tag: tags
      });
      broadcast('NEW_CONVERSATION', newConversation);
      conversation = newConversation;
    } else {
      console.log("Conversation already exists. Skipping create operation.");
    }

    // Store the message
    const newMessage = await Messages.create({
      id: uuidv4(),
      direction: 'inbound',
      type: messageType,
      telnyx_number: toPhoneNumber,
      destination_number: fromPhoneNumber,
      text_body: messageText,
      tag: tags,
      conversation_id: conversation.conversation_id  // Link the message to the conversation
    });
    broadcast('NEW_MESSAGE', {
      ...newMessage.get({ plain: true }), // Assuming newMessage is a Sequelize instance
      isAssigned: conversation.assigned,
      assignedAgent: conversation.agent_assigned
    });
    console.log(conversation.assigned);
    // Update the last message in the conversation
    await Conversations.update({
      last_message: messageText,
    }, {
      where: {
        conversation_id: conversation.conversation_id
      }
    });
  }
  // Handle message.sent - create the message record with text from this event
  if (payload.direction === 'outbound' && event_type === 'message.sent') {
    const fromPhoneNumber = payload.from.phone_number;
    const toPhoneNumber = payload.to[0].phone_number;
    const messageText = payload.text;  // Use text from message.sent
    const messageType = payload.type;
    const messageId = payload.id;  // Telnyx message ID to track it
    const tags = payload.tags.length > 0 ? payload.tags[0] : null;

    const phone_number_array = [fromPhoneNumber, toPhoneNumber].sort();
    const conversation_id = hash(phone_number_array);

    let conversation = await Conversations.findOne({
      where: {
        conversation_id: conversation_id
      }
    });

    if (!conversation) {
      const newConversation = await Conversations.create({
        id: uuidv4(),
        conversation_id: conversation_id,
        from_number: fromPhoneNumber,
        to_number: toPhoneNumber,
        agent_assigned: null,
        assigned: false,
        tag: tags
      });
      broadcast('NEW_CONVERSATION', newConversation);
      conversation = newConversation;
    } else {
       console.log("Conversation already exists. Skipping create operation.");
    }

    // Create message record using text from message.sent
    const newMessage = await Messages.create({
      id: messageId,  // Use Telnyx message ID so we can find it for updates
      type: messageType,
      direction: 'outbound',
      telnyx_number: fromPhoneNumber,
      destination_number: toPhoneNumber,
      text_body: messageText,
      tag: tags,
      conversation_id: conversation.conversation_id
    });
    broadcast('NEW_MESSAGE', newMessage);

    // Update the last message in the conversation
    await Conversations.update({
      last_message: messageText,
    }, {
      where: {
        conversation_id: conversation.conversation_id
      }
    });
  }

  // Handle message.finalized - update the message status
  if (payload.direction === 'outbound' && event_type === 'message.finalized') {
    const messageId = payload.id;
    const status = payload.to[0].status;  // Final delivery status

    console.log(`Message finalized: ${messageId}, status: ${status}`);

    // Update existing message with final status (optional - you can add a status column)
    // For now we'll just log it, but you could add a 'status' column to Messages model
  }

  res.json({ status: "ok" });
});

//Assign agent to conversation

router.get('/unassignedConversations', async (req, res) => {
  try {
    console.log('Fetching unassigned conversations from database...');
    const conversations = await Conversations.findAll({
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
  const { conversation_id } = req.body;
  const { user } = req.body; 
  console.log("agent: "+user)
  if (!conversation_id) {
    return res.status(400).json({ message: 'Conversation ID is required' });
  }

  try {
    const conversation = await Conversations.findOne({
      where: { conversation_id }
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Update the conversation to be assigned to the current agent
    await conversation.update({
      agent_assigned: user,
      assigned: true
    });

    res.json({ message: 'Successfully assigned', conversation });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});


router.get('/conversationMessages/:conversation_id', async (req, res) => {
  try {
    const messages = await Messages.findAll({
      where: {
        conversation_id: req.params.conversation_id,
      },
      order: [
        ['createdAt', 'ASC'],
      ],
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.get('/assignedTo/:agentUsername', async (req, res) => {
  try {
    const assignedConversations = await Conversations.findAll({
      where: {
        agent_assigned: req.params.agentUsername
      },
      // include other necessary attributes
    });
    res.json(assignedConversations);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});



module.exports = router;