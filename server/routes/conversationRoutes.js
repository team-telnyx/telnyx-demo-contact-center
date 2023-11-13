const express = require('express');
const Conversations = require('../models/Conversations'); // Import your model
const Messages = require('../models/Messages'); // Import your model
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const telnyx = require('telnyx')(dotenv.config().parsed.TELNYX_API);const crypto = require('crypto');
const { Op } = require("sequelize");
const { broadcast } = require('./websocket');


function hash(arr) {
  const str = arr.join('');
  const hash = crypto.createHash('sha256');
  hash.update(str);
  return hash.digest('hex');
}

router.post('/composeMessage', (req, res) => {
    const fromPhoneNumber = req.body.From; // Agent's number
    const messageBody = req.body.Text; // The message body
    const dstNum = req.body.To; // Destination number (Customer's number)

    telnyx.messages.create({
      from: fromPhoneNumber,
      to: dstNum,
      text: messageBody,
    })
      .then(() => {
        console.log('Message composed and sent.');
        res.sendStatus(200);
      })
      .catch((err) => {
        console.error('Error sending composed message:', err.raw.errors);
        res.sendStatus(500);
      });
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
  if (payload.direction === 'outbound' && event_type === 'message.finalized') {
    const fromPhoneNumber = payload.from.phone_number;
    const toPhoneNumber = payload.to[0].phone_number;
    const messageText = payload.text;  // Add this line to capture the message text
    const messageType = payload.type;  // Add this line to capture the message type
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
        conversation_id: uuidv4(),
        from_number: fromPhoneNumber,
        to_number: toPhoneNumber,
        agent_assigned: "agent1",
        assigned: true,
        tag: tags
      });
      broadcast('NEW_CONVERSATION', newConversation);
      conversation = newConversation;
    } else {
       console.log("Conversation already exists. Skipping create operation.");
    }

    const newMessage = await Messages.create({
      id: uuidv4(),
      type: messageType,
      direction: 'outbound',
      telnyx_number: fromPhoneNumber,
      destination_number: toPhoneNumber,
      text_body: messageText,
      tag: tags,
      conversation_id: conversation.conversation_id  // Link the message to the conversation
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

  res.json({ status: "ok" });
});

//Assign agent to conversation

router.get('/unassignedConversations', async (req, res) => {
  try {
    const conversations = await Conversations.findAll({
      where: {
        agent_assigned: null,
      },
    });
    res.json(conversations);
  } catch (err) {
    console.error(err);
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


module.exports = router;