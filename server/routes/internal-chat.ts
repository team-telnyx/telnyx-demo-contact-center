import path from 'node:path';
import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import { getIO } from '../services/socket.js';
import fs from 'node:fs/promises';
import { upload, getFileCategory, getFileUrl, validateFileMagic } from '../services/file-storage.js';

/**
 * Internal chat routes — agent-to-agent and group chat.
 *
 * Socket.IO rooms:
 *  - `internal:conversation:<id>` — participants of an internal conversation
 *  - `agent:<agentId>` — targeted delivery for 1:1 + unread badges
 *  - `agents` — broadcast for presence
 */
export function createInternalChatRouter(models: any) {
  const router = Router();

  // ── Helpers ──────────────────────────────────────────────────────────────

  function emitToConversation(conversationId, event, payload) {
    try {
      getIO().to(`internal:conversation:${conversationId}`).emit(event, payload);
    } catch { /* socket not ready */ }
  }

  function emitToAgent(agentId, event, payload) {
    try {
      getIO().to(`agent:${agentId}`).emit(event, payload);
    } catch { /* socket not ready */ }
  }

  function emitToAgents(event, payload) {
    try {
      getIO().to('agents').emit(event, payload);
    } catch { /* socket not ready */ }
  }

  // ── List internal conversations for current agent ───────────────────
  router.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      // Find conversations where this agent is a participant
      const participations = await models.ConversationParticipant.findAll({
        where: { agentId: myAgent.id },
        include: [
          {
            model: models.Conversation,
            as: 'conversation',
            include: [
              { model: models.Message, as: 'messages', limit: 1, order: [['createdAt', 'DESC']] },
            ],
          },
          {
            model: models.Agent,
            as: 'agent',
            include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName'] }],
          },
        ],
        order: [[{ model: models.Conversation, as: 'conversation' }, 'lastMessageAt', 'DESC']],
      });

      const result = participations.map((p) => {
        const conv = p.conversation?.toJSON?.() || p.conversation;
        return {
          ...conv,
          unreadCount: p.unreadCount || 0,
          lastReadAt: p.lastReadAt,
        };
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── Create internal conversation (1:1 or group) ──────────────────────
  const createSchema = z.object({
    participantIds: z.array(z.string().uuid()).min(1, 'At least one participant required'),
    subject: z.string().max(500).optional(),
    initialMessage: z.string().max(8000).optional(),
  });

  router.post('/conversations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body || {});
      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      // All participant IDs (includes self)
      const allParticipantIds = Array.from(new Set([myAgent.id, ...data.participantIds]));
      const isGroup = allParticipantIds.length > 2;

      // For 1:1, check if a conversation already exists between these two agents
      if (!isGroup) {
        const existing = await models.ConversationParticipant.findOne({
          where: { agentId: myAgent.id },
          include: [
            {
              model: models.Conversation,
              as: 'conversation',
              where: { channel: 'internal', status: { [Op.ne]: 'closed' } },
              include: [{ model: models.ConversationParticipant, as: 'participants' }],
            },
          ],
        });

        if (existing?.conversation) {
          const otherParticipants = existing.conversation.participants.filter(
            (p) => p.agentId !== myAgent.id
          );
          const hasSameParticipant = otherParticipants.some(
            (p) => p.agentId === data.participantIds[0]
          );
          if (hasSameParticipant) {
            // Return existing conversation
            const conv = await models.Conversation.findByPk(existing.conversation.id, {
              include: [
                { model: models.Message, as: 'messages', order: [['createdAt', 'ASC']] },
                { model: models.ConversationParticipant, as: 'participants',
                  include: [{ model: models.Agent, as: 'agent',
                    include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName'] }]
                  }]
                },
              ],
            });
            return res.json(conv);
          }
        }
      }

      // Create conversation
      const conversation = await models.Conversation.create({
        channel: 'internal',
        status: 'active',
        subject: data.subject || (isGroup ? 'Group Chat' : 'Direct Message'),
        visitorName: isGroup ? 'Group Chat' : 'Direct Message',
        startedAt: new Date(),
        lastMessageAt: new Date(),
      });

      // Add participants
      for (const agentId of allParticipantIds) {
        await models.ConversationParticipant.create({
          conversationId: conversation.id,
          agentId,
          unreadCount: agentId === myAgent.id ? 0 : 0,
        });
      }

      // Create initial message if provided
      if (data.initialMessage) {
        const message = await models.Message.create({
          conversationId: conversation.id,
          sender: 'agent',
          senderName: myAgent.user?.displayName || myAgent.user?.username || 'Agent',
          content: data.initialMessage,
        });

        await conversation.update({
          lastMessageAt: new Date(),
          messageCount: 1,
        });

        // Notify all participants via Socket.IO
        for (const agentId of allParticipantIds) {
          if (agentId !== myAgent.id) {
            await models.ConversationParticipant.update(
              { unreadCount: models.sequelize
                ? await models.ConversationParticipant.sequelize.literal('unread_count + 1')
                : 1 },
              { where: { conversationId: conversation.id, agentId } }
            );
          }
        }

        emitToConversation(conversation.id, 'internal:chat:message', {
          conversationId: conversation.id,
          ...message.toJSON(),
        });
      }

      // Notify all participants about the new conversation
      for (const agentId of allParticipantIds) {
        emitToAgent(agentId, 'internal:chat:new', {
          conversationId: conversation.id,
          subject: conversation.subject,
          createdBy: myAgent.id,
        });
      }

      // Load full conversation with participants
      const fullConv = await models.Conversation.findByPk(conversation.id, {
        include: [
          { model: models.Message, as: 'messages', order: [['createdAt', 'ASC']] },
          { model: models.ConversationParticipant, as: 'participants',
            include: [{ model: models.Agent, as: 'agent',
              include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName'] }]
            }]
          },
        ],
      });

      res.status(201).json(fullConv);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Get single internal conversation ─────────────────────────────────
  router.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const participation = await models.ConversationParticipant.findOne({
        where: { conversationId: (req.params as any).id, agentId: myAgent.id },
      });
      if (!participation) return res.status(403).json({ error: 'Not a participant' });

      const conversation = await models.Conversation.findByPk((req.params as any).id, {
        include: [
          { model: models.Message, as: 'messages', order: [['createdAt', 'ASC']] },
          { model: models.ConversationParticipant, as: 'participants',
            include: [{ model: models.Agent, as: 'agent',
              include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName'] }]
            }]
          },
        ],
      });
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      res.json(conversation);
    } catch (err) {
      next(err);
    }
  });

  // ── Send message in internal conversation ────────────────────────────
  const messageSchema = z.object({
    content: z.string().min(1).max(8000),
    contentType: z.enum(['text', 'html', 'file', 'image']).optional(),
  });

  router.post('/conversations/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = messageSchema.parse(req.body || {});
      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const participation = await models.ConversationParticipant.findOne({
        where: { conversationId: (req.params as any).id, agentId: myAgent.id },
      });
      if (!participation) return res.status(403).json({ error: 'Not a participant' });

      const conversation = await models.Conversation.findByPk((req.params as any).id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status === 'closed') return res.status(410).json({ error: 'Conversation is closed' });

      const senderName = myAgent.user?.displayName || myAgent.user?.username || 'Agent';

      const message = await models.Message.create({
        conversationId: conversation.id,
        sender: 'agent',
        senderName,
        content: data.content,
        contentType: data.contentType || 'text',
        metadata: { agentId: myAgent.id },  // track which agent sent it
      });

      await conversation.update({
        lastMessageAt: new Date(),
        messageCount: (conversation.messageCount || 0) + 1,
      });

      // Increment unread count for other participants
      await models.ConversationParticipant.update(
        { unreadCount: models.sequelize.literal('unread_count + 1') },
        { where: { conversationId: conversation.id, agentId: { [Op.ne]: myAgent.id } } }
      );

      // Emit to conversation room + each participant's agent room
      emitToConversation(conversation.id, 'internal:chat:message', {
        conversationId: conversation.id,
        ...message.toJSON(),
      });

      // Also emit to each participant's agent room for badge updates
      const participants = await models.ConversationParticipant.findAll({
        where: { conversationId: conversation.id, agentId: { [Op.ne]: myAgent.id } },
      });
      for (const p of participants) {
        emitToAgent(p.agentId, 'internal:chat:unread', {
          conversationId: conversation.id,
          unreadCount: p.unreadCount + 1,
        });
      }

      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Mark conversation as read ───────────────────────────────────────
  router.post('/conversations/:id/read', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const participation = await models.ConversationParticipant.findOne({
        where: { conversationId: (req.params as any).id, agentId: myAgent.id },
      });
      if (!participation) return res.status(403).json({ error: 'Not a participant' });

      await participation.update({ unreadCount: 0, lastReadAt: new Date() });

      // Mark messages as read
      await models.Message.update(
        { readAt: new Date() },
        { where: { conversationId: (req.params as any).id, readAt: null } }
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ── Close internal conversation ─────────────────────────────────────
  router.post('/conversations/:id/close', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const participation = await models.ConversationParticipant.findOne({
        where: { conversationId: (req.params as any).id, agentId: myAgent.id },
      });
      if (!participation) return res.status(403).json({ error: 'Not a participant' });

      const conversation = await models.Conversation.findByPk((req.params as any).id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      await conversation.update({ status: 'closed', endedAt: new Date() });

      emitToConversation(conversation.id, 'internal:chat:closed', {
        conversationId: conversation.id,
      });

      res.json(conversation);
    } catch (err) {
      next(err);
    }
  });

  // ── Agent directory (for starting chats / seeing who's online) ──────
  router.get('/directory', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agents = await models.Agent.findAll({
        include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName', 'role'] }],
        order: [['priority', 'ASC']],
      });

      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });

      const directory = agents
        .filter((a) => a.id !== myAgent?.id)  // exclude self
        .map((a) => ({
          id: a.id,
          extension: a.extension,
          presence: a.presence || a.status,
          status: a.status,
          displayName: a.user?.displayName || a.user?.username || 'Agent',
          role: a.user?.role,
          sipUsername: a.sipUsername,
        }));

      res.json(directory);
    } catch (err) {
      next(err);
    }
  });

  // ── Presence update ─────────────────────────────────────────────────
  router.patch('/presence', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const presenceSchema = z.object({
        presence: z.enum(['online', 'available', 'busy', 'away', 'offline']),
      });
      const { presence } = presenceSchema.parse(req.body || {});

      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      await myAgent.update({ presence });

      // Broadcast presence change to all agents
      emitToAgents('internal:presence', {
        agentId: myAgent.id,
        presence,
      });

      res.json({ success: true, presence });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Typing indicator ─────────────────────────────────────────────────
  router.post('/conversations/:id/typing', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const participation = await models.ConversationParticipant.findOne({
        where: { conversationId: (req.params as any).id, agentId: myAgent.id },
      });
      if (!participation) return res.status(403).json({ error: 'Not a participant' });

      const typingData = z.object({ isTyping: z.boolean().optional().default(false) }).parse(req.body || {});
      const { isTyping } = typingData;

      emitToConversation((req.params as any).id, 'internal:chat:typing', {
        conversationId: (req.params as any).id,
        agentId: myAgent.id,
        name: myAgent.user?.displayName || myAgent.user?.username || 'Agent',
        isTyping: !!isTyping,
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ── Upload file to internal conversation ──────────────────────────
  router.post('/conversations/:id/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      // Validate magic bytes match the declared MIME type
      const validMagic = await validateFileMagic(req.file.path, req.file.mimetype);
      if (!validMagic) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ error: 'File content does not match its declared type' });
      }

      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const participation = await models.ConversationParticipant.findOne({
        where: { conversationId: (req.params as any).id, agentId: myAgent.id },
      });
      if (!participation) return res.status(403).json({ error: 'Not a participant' });

      const conversation = await models.Conversation.findByPk((req.params as any).id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status === 'closed') return res.status(410).json({ error: 'Conversation is closed' });

      const fileUrl = getFileUrl(req.file.path);
      const category = getFileCategory(req.file.mimetype);
      const senderName = myAgent.user?.displayName || myAgent.user?.username || 'Agent';

      const message = await models.Message.create({
        conversationId: conversation.id,
        sender: 'agent',
        senderName,
        content: req.file.originalname,
        contentType: category === 'image' ? 'image' : 'file',
        metadata: {
          agentId: myAgent.id,
          fileUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });

      // Track upload in UploadRecord
      await models.UploadRecord.create({
        originalName: req.file.originalname,
        storedPath: req.file.path,
        fileUrl,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category,
        uploadedBy: myAgent.id,
        conversationId: conversation.id,
        messageId: message.id,
      });

      await conversation.update({
        lastMessageAt: new Date(),
        messageCount: (conversation.messageCount || 0) + 1,
      });

      // Increment unread count for other participants
      await models.ConversationParticipant.update(
        { unreadCount: models.sequelize.literal('unread_count + 1') },
        { where: { conversationId: conversation.id, agentId: { [Op.ne]: myAgent.id } } }
      );

      emitToConversation(conversation.id, 'internal:chat:message', {
        conversationId: conversation.id,
        ...message.toJSON(),
      });

      const participants = await models.ConversationParticipant.findAll({
        where: { conversationId: conversation.id, agentId: { [Op.ne]: myAgent.id } },
      });
      for (const p of participants) {
        emitToAgent(p.agentId, 'internal:chat:unread', {
          conversationId: conversation.id,
          unreadCount: p.unreadCount + 1,
        });
      }

      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
