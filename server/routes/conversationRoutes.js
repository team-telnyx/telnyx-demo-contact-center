import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { getOrgTelnyxClient, getWebhookBaseUrl } from '../src/services/org-telnyx.js';
import Conversations from '../models/Conversations.js';
import Messages from '../models/Messages.js';
import { broadcast, sendToUser } from './websocket.js';
import { routeSmsToAgent } from '../src/services/auto-route.js';
import { broadcastPush } from './pushRoutes.js';
const router = express.Router();

function hash(arr) {
  const sorted = [...arr].sort();
  return crypto.createHash('sha256').update(sorted.join('')).digest('hex');
}

// E.164 validation: + followed by 1-15 digits
function isValidE164(phone) {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

// ========================= MEDIA UPLOAD =========================
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import axios from 'axios';
import heicConvert from 'heic-convert';

const UPLOAD_DIR = new URL('../../uploads', import.meta.url).pathname;
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Download a remote file and store it locally. Returns the local public URL.
 */
async function downloadAndStore(remoteUrl, contentType) {
  try {
    const webhookBase = await getWebhookBaseUrl();
    const response = await axios.get(remoteUrl, { responseType: 'arraybuffer' });
    const ext = (contentType || 'application/octet-stream').split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
    const name = `${randomUUID()}.${ext}`;
    writeFileSync(`${UPLOAD_DIR}/${name}`, Buffer.from(response.data));
    const localUrl = `${webhookBase}/api/conversations/media/${name}`;
    return { url: localUrl, content_type: contentType };
  } catch (err) {
    console.error('[Media] Failed to download:', remoteUrl, err.message);
    return { url: remoteUrl, content_type: contentType };
  }
}

router.post('/upload-media', async (req, res) => {
  const { data, filename, content_type } = req.body;
  if (!data) return res.status(400).json({ error: 'No data provided' });

  try {
    const webhookBase = await getWebhookBaseUrl();
    const ext = (filename || 'file').split('.').pop().toLowerCase() || 'bin';
    const base64 = data.replace(/^data:[^;]+;base64,/, '');
    let fileBuffer = Buffer.from(base64, 'base64');
    let finalExt = ext;
    let finalContentType = content_type;

    // Convert HEIC/HEIF to JPEG — carriers don't support HEIC for MMS
    if (ext === 'heic' || ext === 'heif' || content_type === 'image/heic' || content_type === 'image/heif') {
      console.log(`[Upload] Converting ${ext.toUpperCase()} to JPEG`);
      fileBuffer = Buffer.from(await heicConvert({ buffer: fileBuffer, format: 'JPEG', quality: 0.85 }));
      finalExt = 'jpg';
      finalContentType = 'image/jpeg';
    }

    const name = `${randomUUID()}.${finalExt}`;
    writeFileSync(`${UPLOAD_DIR}/${name}`, fileBuffer);
    const url = `${webhookBase}/api/conversations/media/${name}`;
    res.json({ url, filename: name, content_type: finalContentType });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/media/:filename', (req, res) => {
  const filePath = `${UPLOAD_DIR}/${req.params.filename}`;
  if (!existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

// ========================= COMPOSE MESSAGE =========================

router.post('/composeMessage', async (req, res) => {
  const fromPhoneNumber = req.body.From;
  const messageBody = req.body.Text;
  const dstNum = req.body.To;
  const mediaUrls = req.body.MediaUrls || [];

  if (!fromPhoneNumber || !dstNum) {
    return res.status(400).json({ error: 'From and To are required' });
  }
  if (!messageBody && mediaUrls.length === 0) {
    return res.status(400).json({ error: 'Text or media is required' });
  }

  if (!isValidE164(dstNum)) {
    return res.status(400).json({ error: 'Invalid destination number. Must be E.164 format (e.g. +12125551234)' });
  }

  // Ensure conversation exists so optimistic message can be stored immediately
  const phone_number_array = [fromPhoneNumber, dstNum];
  const conversation_id = hash(phone_number_array);

  let conversation = await Conversations.findOne({ where: { conversation_id } });
  if (!conversation) {
    conversation = await Conversations.create({
      id: uuidv4(),
      conversation_id,
      from_number: fromPhoneNumber,
      to_number: dstNum,
      agent_assigned: req.body.agent || null,
      assigned: !!req.body.agent,
      tag: null,
    });
    broadcast('NEW_CONVERSATION', conversation);
  }

  // Create an optimistic message record with status "sending"
  const messageId = uuidv4();
  const messageType = mediaUrls.length > 0 ? 'MMS' : 'SMS';
  const optimisticMessage = await Messages.create({
    id: messageId,
    direction: 'outbound',
    type: messageType,
    telnyx_number: fromPhoneNumber,
    destination_number: dstNum,
    text_body: messageBody || '',
    media: mediaUrls.length > 0 ? JSON.stringify(mediaUrls.map((u) => ({ url: u, content_type: 'image/jpeg' }))) : null,
    tag: null,
    status: 'sending',
    conversation_id: conversation.conversation_id,
  });

  // Update conversation last_message
  await Conversations.update(
    { last_message: messageBody },
    { where: { conversation_id: conversation.conversation_id } }
  );

  // Broadcast optimistic message so UI updates instantly
  broadcast('NEW_MESSAGE', {
    ...optimisticMessage.get({ plain: true }),
    isAssigned: conversation.assigned,
    assignedAgent: conversation.agent_assigned,
  });

  try {
    const sendBody = {
      from: fromPhoneNumber,
      to: dstNum,
      text: messageBody || '',
    };
    if (mediaUrls.length > 0) {
      sendBody.media_urls = mediaUrls;
      sendBody.type = 'MMS';
    }
    const telnyx = await getOrgTelnyxClient();
    const telnyxResponse = await telnyx.messages.send(sendBody);

    const telnyxMessageId = telnyxResponse?.data?.id || null;

    // Update message with Telnyx ID and status "sent"
    await Messages.update(
      { telnyx_message_id: telnyxMessageId, status: 'sent' },
      { where: { id: messageId } }
    );

    // Broadcast status update
    broadcast('MESSAGE_STATUS_UPDATE', {
      id: messageId,
      conversation_id: conversation.conversation_id,
      status: 'sent',
      telnyx_message_id: telnyxMessageId,
    });

    res.json({
      success: true,
      message: optimisticMessage.get({ plain: true }),
      telnyx_message_id: telnyxMessageId,
      status: 'sent',
    });
  } catch (err) {
    console.error('Error sending message:', err.raw?.errors || err.message);

    // Update status to failed
    await Messages.update(
      { status: 'failed' },
      { where: { id: messageId } }
    );

    broadcast('MESSAGE_STATUS_UPDATE', {
      id: messageId,
      conversation_id: conversation.conversation_id,
      status: 'failed',
    });

    res.status(500).json({
      error: 'Failed to send message',
      details: err.raw?.errors || err.message,
      messageId,
      status: 'failed',
    });
  }
});

// ========================= WEBHOOK =========================

router.post('/webhook', async (req, res) => {
  try {
  const payload = req.body.data.payload;
  const event_type = req.body.data.event_type;

  // --- Inbound message ---
  if (payload.direction === 'inbound' && event_type === 'message.received') {
    const fromPhoneNumber = payload.from.phone_number;
    const toPhoneNumber = payload.to[0].phone_number;
    const messageText = payload.text;
    const messageType = payload.type;
    const tags = payload.tags.length > 0 ? payload.tags[0] : null;

    const phone_number_array = [fromPhoneNumber, toPhoneNumber];
    const conversation_id = hash(phone_number_array);

    let conversation = await Conversations.findOne({
      where: { conversation_id }
    });

    if (!conversation) {
      conversation = await Conversations.create({
        id: uuidv4(),
        conversation_id,
        from_number: toPhoneNumber,
        to_number: fromPhoneNumber,
        agent_assigned: null,
        assigned: false,
        tag: tags
      });
        broadcast('NEW_CONVERSATION', conversation);
    }

    // Download and store MMS media locally
    const rawMedia = payload.media || [];
    const mediaUrls = [];
    for (const m of rawMedia) {
      const stored = await downloadAndStore(m.url, m.content_type);
      mediaUrls.push(stored);
    }

    const newMessage = await Messages.create({
      id: uuidv4(),
      direction: 'inbound',
      type: messageType,
      telnyx_number: toPhoneNumber,
      destination_number: fromPhoneNumber,
      text_body: messageText,
      media: mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
      tag: tags,
      status: 'delivered',
      telnyx_message_id: payload.id || null,
      conversation_id: conversation.conversation_id
    });

    broadcast('NEW_MESSAGE', {
      ...newMessage.get({ plain: true }),
      isAssigned: conversation.assigned,
      assignedAgent: conversation.agent_assigned
    });
    const hasMedia = rawMedia.length > 0;
    const pushBody = hasMedia && !messageText
      ? `${fromPhoneNumber}: [Image]`
      : hasMedia
        ? `${fromPhoneNumber}: ${messageText.substring(0, 80)} [Image]`
        : `${fromPhoneNumber}: ${(messageText || '').substring(0, 100)}`;
    const pushPayload = {
      title: 'New Message',
      body: pushBody,
      tag: 'sms-' + conversation.conversation_id,
      url: '/sms',
    };
    // Show image in the notification if available
    if (hasMedia && rawMedia[0]?.url) {
      pushPayload.image = rawMedia[0].url;
    }
    broadcastPush(pushPayload).catch(err => console.error('[Push] broadcastPush error:', err));

    await Conversations.update(
      { last_message: messageText },
      { where: { conversation_id: conversation.conversation_id } }
    );

    // Auto-route unassigned conversations to available agents
    if (!conversation.assigned) {
      routeSmsToAgent(conversation.conversation_id).catch(err =>
        console.error('[SMS-route] Error auto-routing:', err.message)
      );
    }
  }

  // --- Outbound delivery status updates ---
  if (payload.direction === 'outbound') {
    const telnyxMessageId = payload.id;

    // Map Telnyx event types to our status values
    let newStatus = null;
    if (event_type === 'message.sent') {
      newStatus = 'sent';
    } else if (event_type === 'message.delivered') {
      newStatus = 'delivered';
    } else if (event_type === 'message.finalized' && payload.errors && payload.errors.length > 0) {
      newStatus = 'failed';
    } else if (event_type === 'message.finalized') {
      newStatus = 'delivered';
    }

    if (newStatus && telnyxMessageId) {
      const message = await Messages.findOne({
        where: { telnyx_message_id: telnyxMessageId }
      });

      if (message) {
        // Don't downgrade, but 'failed' always overrides (terminal state)
        const STATUS_RANK = { queued: 1, sending: 2, sent: 3, delivered: 4 };
        const shouldUpdate = newStatus === 'failed' || (STATUS_RANK[newStatus] || 0) > (STATUS_RANK[message.status] || 0);
        if (shouldUpdate) {
          await Messages.update(
            { status: newStatus },
            { where: { id: message.id } }
          );

          broadcast('MESSAGE_STATUS_UPDATE', {
            id: message.id,
            conversation_id: message.conversation_id,
            status: newStatus,
            telnyx_message_id: telnyxMessageId,
          });
        }
      } else if (event_type === 'message.finalized') {
        const fromPhoneNumber = payload.from.phone_number;
        const toPhoneNumber = payload.to[0].phone_number;
        const messageText = payload.text;
        const messageType = payload.type;
        const tags = payload.tags && payload.tags.length > 0 ? payload.tags[0] : null;

        const phone_number_array = [fromPhoneNumber, toPhoneNumber];
        const conversation_id = hash(phone_number_array);

        let conversation = await Conversations.findOne({ where: { conversation_id } });

        if (!conversation) {
          conversation = await Conversations.create({
            id: uuidv4(),
            conversation_id,
            from_number: fromPhoneNumber,
            to_number: toPhoneNumber,
            agent_assigned: null,
            assigned: false,
            tag: tags
          });
          broadcast('NEW_CONVERSATION', conversation);
        }

        const newMessage = await Messages.create({
          id: uuidv4(),
          type: messageType,
          direction: 'outbound',
          telnyx_number: fromPhoneNumber,
          destination_number: toPhoneNumber,
          text_body: messageText,
          tag: tags,
          status: newStatus,
          telnyx_message_id: telnyxMessageId,
          conversation_id: conversation.conversation_id
        });

        broadcast('NEW_MESSAGE', newMessage);

        await Conversations.update(
          { last_message: messageText },
          { where: { conversation_id: conversation.conversation_id } }
        );
      }
    }
  }

  res.json({ status: "ok" });
  } catch (err) {
    console.error('[Webhook] Error processing webhook:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ========================= CONVERSATION QUERIES =========================

router.get('/unassignedConversations', async (req, res) => {
  try {
    const conversations = await Conversations.findAll({
      where: { agent_assigned: null },
    });
    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.post('/assignAgent', async (req, res) => {
  const { conversation_id, user } = req.body;
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

    await conversation.update({
      agent_assigned: user,
      assigned: true
    });

    broadcast('CONVERSATION_ASSIGNED', conversation);
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
      order: [['created_at', 'ASC']],
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
      order: [['updated_at', 'DESC']],
    });
    res.json(assignedConversations);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


export default router;
