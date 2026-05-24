import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import { sendSms } from '../services/telnyx.js';
import { emitChatMessage, emitChatNew } from '../services/socket.js';

export function createSmsRouter(models: any) {
  const router = Router();

  // Get all numbers available for SMS (pulls from the Numbers section)
  router.get('/numbers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const numbers = await models.NumberAssignment.findAll({
        order: [['phoneNumber', 'ASC']],
      });
      res.json(
        numbers.map((n: any) => ({
          id: n.id,
          phoneNumber: n.phoneNumber,
          label: n.label,
          countryCode: n.countryCode,
        })),
      );
    } catch (err) {
      next(err);
    }
  });

  // Start a new outbound SMS conversation
  router.post('/new', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        to: z.string().min(1),
        from: z.string().min(1),
        text: z.string().min(1).max(1600),
        visitorName: z.string().optional(),
      });
      const { to, from, text, visitorName } = schema.parse(req.body);

      // Validate from number exists in NumberAssignments
      const fromNumber = await models.NumberAssignment.findOne({
        where: { phoneNumber: from },
      });
      if (!fromNumber) {
        return res.status(400).json({ error: 'Invalid sender number — not found in Numbers' });
      }

      // Check opt-out
      const contact = await models.Contact.findOne({ where: { phoneNumber: to } });
      if (contact?.metadata?.optOut) {
        return res.status(403).json({ error: 'Recipient has opted out of SMS' });
      }

      // Send via Telnyx (pass messaging profile if set on the number)
      const result = (await sendSms(from, to, text, undefined, fromNumber.messagingProfileId || undefined)) as any;
      const telnyxMsgId = result?.data?.id;

      // Get current agent
      const myAgent = await models.Agent.findOne({ where: { userId: (req as any).user.id } });

      // Create conversation
      const conversation = await models.Conversation.create({
        channel: 'sms',
        status: 'active',
        visitorPhone: to,
        telnyxNumber: from,
        visitorName: visitorName || to,
        agentId: myAgent?.id || null,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 1,
      });

      // Create first message
      const message = await models.Message.create({
        conversationId: conversation.id,
        sender: 'agent',
        senderName: (req as any).user.displayName || (req as any).user.username,
        content: text,
        externalId: telnyxMsgId,
        status: 'sent',
      });

      // Emit socket events
      const conversationData = {
        id: conversation.id,
        channel: conversation.channel,
        status: conversation.status,
        visitorPhone: conversation.visitorPhone,
        visitorName: conversation.visitorName,
        telnyxNumber: conversation.telnyxNumber,
        agentId: conversation.agentId,
        startedAt: conversation.startedAt,
        lastMessageAt: conversation.lastMessageAt,
        messageCount: conversation.messageCount,
      };
      emitChatNew(conversationData);
      emitChatMessage(conversation.id, {
        id: message.id,
        conversationId: conversation.id,
        senderType: 'agent',
        senderName: message.senderName,
        content: text,
        createdAt: message.createdAt,
      });

      logger.info({ conversationId: conversation.id, to, from }, 'New outbound SMS conversation started');

      res.json(conversationData);
    } catch (err) {
      next(err);
    }
  });

  // Send an outbound SMS reply to a conversation
  router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        conversationId: z.string().uuid(),
        text: z.string().min(1).max(1600),
      });
      const { conversationId, text } = schema.parse(req.body);

      const conversation = await models.Conversation.findByPk(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.channel !== 'sms') return res.status(400).json({ error: 'Not an SMS conversation' });

      // Get the Telnyx number from the conversation or first available NumberAssignment
      const fromPhone = conversation.telnyxNumber || await getDefaultSmsNumber(models);
      if (!fromPhone) return res.status(400).json({ error: 'No Telnyx number configured for SMS' });

      const toNumber = conversation.visitorPhone;
      if (!toNumber) return res.status(400).json({ error: 'No destination phone number' });

      // Look up messaging profile for this number
      const fromNumberRecord = await models.NumberAssignment.findOne({ where: { phoneNumber: fromPhone } });

      // Check opt-out before sending
      const contact = await models.Contact.findOne({ where: { phoneNumber: toNumber } });
      if (contact?.metadata?.optOut) {
        return res.status(403).json({ error: 'Recipient has opted out of SMS' });
      }

      // Send via Telnyx
      const result = await sendSms(fromPhone, toNumber, text, undefined, fromNumberRecord?.messagingProfileId || undefined) as any;
      const telnyxMsgId = result?.data?.id;

      // Store message
      const message = await models.Message.create({
        conversationId,
        sender: 'agent',
        senderName: req.user.displayName || req.user.username,
        content: text,
        externalId: telnyxMsgId,
        status: 'sent',
      });

      // Update conversation status
      if (conversation.status === 'waiting') {
        const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
        await conversation.update({ status: 'active', agentId: myAgent?.id || null });
      }

      // Emit
      emitChatMessage(conversationId, {
        id: message.id,
        conversationId,
        senderType: 'agent',
        senderName: message.senderName,
        content: text,
        createdAt: message.createdAt,
      });

      res.json({ id: message.id, status: 'sent' });
    } catch (err) { next(err); }
  });

  return router;
}

async function getDefaultSmsNumber(models: any) {
  const num = await models.NumberAssignment.findOne();
  return num?.phoneNumber || null;
}
