import crypto from 'node:crypto';
import path from 'node:path';
import { Router, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import { getIO } from '../services/socket.js';
import bus from '../services/event-bus.js';
import fs from 'node:fs/promises';
import { upload, getFileCategory, getFileUrl, validateFileMagic } from '../services/file-storage.js';
import { sendSms } from '../services/telnyx.js';

/**
 * Web chat routes — visitor endpoints (no auth) and agent endpoints (auth).
 *
 * Returns { publicRouter, agentRouter }:
 *  - publicRouter: mounted at `/api/chat` BEFORE auth (visitor flow)
 *  - agentRouter:  mounted at `/chat`     INSIDE the authenticated /api router
 *
 * Socket.IO rooms:
 *  - `conversation:<id>` — both visitor + agent join for a given chat
 *  - `agents` — broadcast new chats waiting
 */

// ── Config constants ──────────────────────────────────────────────────────

const AUTO_RESPONDER_TEMPLATE =
  'Thanks for reaching out! An agent will be with you shortly. Your estimated wait time is {{estimatedWaitMinutes}} minutes.';
const OFFLINE_AUTO_RESPONDER_TEMPLATE =
  'Our agents are currently offline. Your message has been received and we will get back to you as soon as possible. You can also leave a message using the offline form.';
const DEFAULT_SLA_SECONDS = 60; // default SLA for first response
const SLA_REAPER_INTERVAL_MS = 30 * 1000; // 30 seconds
const ESTIMATED_WAIT_SECONDS_PER_POSITION = 90; // rough estimate: 90s per queued conversation ahead

// ── Per-IP rate limiter for visitor chat endpoints (tighter than global) ──
const visitorLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 20,                 // 20 messages per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages — please slow down' },
});

// ── Spam detection: track repeated content per IP ───────────────────────
// Simple in-memory Map with TTL cleanup. Key: `${ip}:${contentHash}`
const spamMap = new Map(); // key → { count, expiresAt }
const SPAM_WINDOW_MS = 60 * 1000; // 1 minute
const SPAM_THRESHOLD = 3; // same content 3+ times = spam

function isSpam(ip: string, content: string) {
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  const key = `${ip}:${hash}`;
  const now = Date.now();

  // Lazy cleanup of expired entries
  if (spamMap.size > 5000) {
    for (const [k, v] of spamMap) {
      if (v.expiresAt < now) spamMap.delete(k);
    }
  }

  const entry = spamMap.get(key);
  if (!entry || entry.expiresAt < now) {
    spamMap.set(key, { count: 1, expiresAt: now + SPAM_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count >= SPAM_THRESHOLD;
}

// ── Session tokens: map token → { conversationId, ip, expiresAt } ─────────
const sessionTokens = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function createSessionToken(conversationId: string, ip: string) {
  const token = crypto.randomUUID();
  sessionTokens.set(token, { conversationId, ip, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function validateSessionToken(token: string, conversationId: string, ip: string) {
  if (!token) return false;
  const entry = sessionTokens.get(token);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    sessionTokens.delete(token);
    return false;
  }
  if (entry.conversationId !== conversationId) return false;
  // Allow same IP or skip IP check in dev (IP may change behind proxies)
  return true;
}

// ── Helper: check if any agents are online for a queue ────────────────────

async function areAgentsOnline(models: any, queueName?: string): Promise<boolean> {
  const where: any = {
    status: 'online',
    activeCallId: null,
  };
  if (queueName) {
    where.queues = { [Op.overlap]: [queueName] };
  }
  const count = await models.Agent.count({ where });
  return count > 0;
}

// ── SLA Breach Reaper ─────────────────────────────────────────────────────

let _slaReaperTimer: NodeJS.Timeout | null = null;
let _reaperModels: any = null;

async function checkSlaBreaches() {
  const models = _reaperModels;
  if (!models) return;

  try {
    const now = new Date();
    // Find waiting conversations where SLA has been breached
    const breached = await models.Conversation.findAll({
      where: {
        status: 'waiting',
        slaResponseBy: { [Op.lt]: now },
      },
    });

    for (const conv of breached) {
      try {
        const io = getIO();
        io.to('agents').emit('chat:sla_breach', {
          conversationId: conv.id,
          queueName: conv.queueName,
          visitorName: conv.visitorName,
          slaResponseBy: conv.slaResponseBy,
          waitedSeconds: Math.round((now.getTime() - new Date(conv.startedAt).getTime()) / 1000),
        });
        io.to('supervisors').emit('chat:sla_breach', {
          conversationId: conv.id,
          queueName: conv.queueName,
          visitorName: conv.visitorName,
          slaResponseBy: conv.slaResponseBy,
          waitedSeconds: Math.round((now.getTime() - new Date(conv.startedAt).getTime()) / 1000),
        });
        bus.emit('chat:sla_breach', {
          conversationId: conv.id,
          queueName: conv.queueName,
          slaResponseBy: conv.slaResponseBy,
        });
      } catch {
        /* socket not ready */
      }
    }

    if (breached.length > 0) {
      logger.info({ count: breached.length }, 'SLA breach check: breached conversations found');
    }
  } catch (err) {
    logger.error({ err }, 'SLA breach reaper error');
  }
}

function startSlaReaper(models: any) {
  if (_slaReaperTimer) return;
  _reaperModels = models;
  _slaReaperTimer = setInterval(() => {
    checkSlaBreaches().catch((err: any) => {
      logger.error({ err }, 'SLA breach reaper tick failed');
    });
  }, SLA_REAPER_INTERVAL_MS);
  if (typeof _slaReaperTimer.unref === 'function') _slaReaperTimer.unref();
  logger.info({ intervalMs: SLA_REAPER_INTERVAL_MS }, 'Chat SLA breach reaper started');
}

function stopSlaReaper() {
  if (_slaReaperTimer) {
    clearInterval(_slaReaperTimer);
    _slaReaperTimer = null;
  }
}

export function createChatRouter(models: any) {
  const publicRouter = Router();
  const agentRouter = Router();

  // Start SLA reaper
  startSlaReaper(models);

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function tryAutoAssign(conversation: any) {
    // If a queue has agents available, auto-assign.
    const queueName = conversation.queueName || 'chat';
    const where: any = {
      status: 'online',
      activeCallId: null,
    };
    if (queueName) {
      where.queues = { [Op.overlap]: [queueName] };
    }
    const agent = await models.Agent.findOne({
      where,
      order: [['priority', 'ASC']],
    });
    if (!agent) return null;

    await conversation.update({ agentId: agent.id, status: 'active' });
    logger.info(
      { conversationId: conversation.id, agentId: agent.id, queueName },
      'Chat auto-assigned to agent',
    );

    try {
      const io = getIO();
      io.to(`agent:${agent.id}`).emit('chat:accepted', {
        conversationId: conversation.id,
        agentId: agent.id,
      });
      io.to(`conversation:${conversation.id}`).emit('chat:accepted', {
        conversationId: conversation.id,
        agentId: agent.id,
      });
    } catch {
      /* socket not ready — fine for tests */
    }
    return agent;
  }

  function emitToConversation(conversationId: string, event: string, payload: any) {
    try {
      getIO().to(`conversation:${conversationId}`).emit(event, payload);
    } catch {
      /* socket not initialised yet */
    }
  }

  function emitToAgents(event: string, payload: any) {
    try {
      getIO().to('agents').emit(event, payload);
    } catch {
      /* socket not initialised yet */
    }
  }

  async function getSlaForQueue(queueName: string): Promise<number> {
    try {
      const queue = await models.Queue.findOne({ where: { name: queueName } });
      if (queue?.slaTargetSeconds) return queue.slaTargetSeconds;
    } catch { /* fall through to default */ }
    return DEFAULT_SLA_SECONDS;
  }

  // ── Public visitor endpoints ─────────────────────────────────────────────

  const startSchema = z.object({
    visitorName: z.string().min(1).max(200).optional(),
    visitorEmail: z.string().email().max(320).optional().or(z.literal('')),
    subject: z.string().max(500).optional(),
    queueName: z.string().max(100).optional(),
    metadata: z.record(z.any()).optional(),
  });

  // POST /api/chat/start — visitor starts a new chat
  publicRouter.post('/start', visitorLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = startSchema.parse(req.body || {});
      const queueName = data.queueName || 'chat';
      const agentsOnline = await areAgentsOnline(models, queueName);

      const slaSeconds = await getSlaForQueue(queueName);
      const slaResponseBy = new Date(Date.now() + slaSeconds * 1000);

      const conversation = await models.Conversation.create({
        channel: 'webchat',
        status: agentsOnline ? 'waiting' : 'waiting', // still 'waiting' even if offline, auto-responder handles UX
        visitorName: data.visitorName || 'Visitor',
        visitorEmail: data.visitorEmail || null,
        subject: data.subject || null,
        queueName,
        metadata: data.metadata || {},
        startedAt: new Date(),
        slaResponseBy,
      });

      // System welcome message
      await models.Message.create({
        conversationId: conversation.id,
        sender: 'system',
        senderName: 'System',
        content: `Chat started by ${conversation.visitorName}${conversation.subject ? ` — ${conversation.subject}` : ''}`,
      });

      logger.info({ conversationId: conversation.id, agentsOnline }, 'Chat conversation started');

      // Notify agents room of a new waiting chat
      emitToAgents('chat:new', {
        id: conversation.id,
        channel: conversation.channel,
        status: conversation.status,
        visitorName: conversation.visitorName,
        subject: conversation.subject,
        queueName: conversation.queueName,
        startedAt: conversation.startedAt,
      });

      if (agentsOnline) {
        // Try to auto-assign to an available agent
        const assigned = await tryAutoAssign(conversation).catch((err) =>
          logger.error({ err }, 'Chat auto-assign failed (non-fatal)'),
        );

        if (!assigned) {
          // Auto-responder: no agent immediately available but agents are online
          const waitingAhead = await models.Conversation.count({
            where: {
              status: 'waiting',
              queueName,
              startedAt: { [Op.lt]: conversation.startedAt },
            },
          });
          const estimatedWaitMinutes = Math.max(1, Math.ceil((waitingAhead + 1) * ESTIMATED_WAIT_SECONDS_PER_POSITION / 60));
          const autoReply = AUTO_RESPONDER_TEMPLATE.replace('{{estimatedWaitMinutes}}', String(estimatedWaitMinutes));
          await models.Message.create({
            conversationId: conversation.id,
            sender: 'system',
            senderName: 'System',
            content: autoReply,
          });
          emitToConversation(conversation.id, 'chat:message', {
            conversationId: conversation.id,
            sender: 'system',
            content: autoReply,
          });
        }
      } else {
        // Auto-responder: agents are offline
        await models.Message.create({
          conversationId: conversation.id,
          sender: 'system',
          senderName: 'System',
          content: OFFLINE_AUTO_RESPONDER_TEMPLATE,
        });
        emitToConversation(conversation.id, 'chat:message', {
          conversationId: conversation.id,
          sender: 'system',
          content: OFFLINE_AUTO_RESPONDER_TEMPLATE,
        });
      }

      const fresh = await models.Conversation.findByPk(conversation.id);

      // Generate a session token for this visitor
      const visitorIp = req.ip || req.connection?.remoteAddress || 'unknown';
      const sessionToken = createSessionToken(fresh.id, visitorIp);

      res.status(201).json({
        conversationId: fresh.id,
        room: `conversation:${fresh.id}`,
        status: fresh.status,
        agentId: fresh.agentId,
        visitorName: fresh.visitorName,
        sessionToken,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  const visitorMessageSchema = z.object({
    content: z.string().min(1).max(2000),
    senderName: z.string().max(200).optional(),
    sessionToken: z.string().optional(),
  });

  // POST /api/chat/:conversationId/message — visitor sends message
  publicRouter.post('/:conversationId/message', visitorLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = (req.params as any);
      const data = visitorMessageSchema.parse(req.body || {});

      // Content validation
      if (!data.content || !data.content.trim()) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }
      if (data.content.length > 2000) {
        return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
      }

      // Session token validation
      const rawToken = data.sessionToken || req.headers['x-chat-token'];
      const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
      if (!validateSessionToken(token, conversationId, req.ip)) {
        return res.status(403).json({ error: 'Invalid or missing session token' });
      }

      // Spam detection
      const visitorIp = req.ip || req.connection?.remoteAddress || 'unknown';
      if (isSpam(visitorIp, data.content)) {
        return res.status(429).json({ error: 'Duplicate message detected — please slow down' });
      }

      const conversation = await models.Conversation.findByPk(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status === 'closed' || conversation.status === 'offline') {
        return res.status(410).json({ error: 'Conversation is closed' });
      }

      const message = await models.Message.create({
        conversationId,
        sender: 'visitor',
        senderName: data.senderName || conversation.visitorName || 'Visitor',
        content: data.content,
      });

      await conversation.update({
        lastMessageAt: new Date(),
        messageCount: (conversation.messageCount || 0) + 1,
      });

      emitToConversation(conversationId, 'chat:message', message.toJSON());
      // Also notify agents room so the inbox list updates
      emitToAgents('chat:message', { conversationId, ...message.toJSON() });

      // Emit event bus: chat message received
      bus.emit('chat:message_received', {
        conversationId,
        messageId: message.id,
        sender: 'visitor',
        content: data.content,
        visitorName: conversation.visitorName,
        channel: conversation.channel,
      });

      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // GET /api/chat/:conversationId/messages — get conversation messages
  publicRouter.get('/:conversationId/messages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = (req.params as any);
      const conversation = await models.Conversation.findByPk(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const messages = await models.Message.findAll({
        where: { conversationId },
        order: [['createdAt', 'ASC']],
      });
      res.json({ conversation, messages });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/chat/:conversationId/wait-info — visitor queue position & estimated wait
  publicRouter.get('/:conversationId/wait-info', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = (req.params as any);
      const conversation = await models.Conversation.findByPk(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      if (conversation.status !== 'waiting') {
        return res.json({ position: 0, estimatedWaitSeconds: 0 });
      }

      const queueName = conversation.queueName || 'chat';
      const position = await models.Conversation.count({
        where: {
          status: 'waiting',
          queueName,
          startedAt: { [Op.lt]: conversation.startedAt },
        },
      });

      const estimatedWaitSeconds = (position + 1) * ESTIMATED_WAIT_SECONDS_PER_POSITION;

      res.json({ position, estimatedWaitSeconds });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/chat/offline-message — visitor submits a message when no agents are online
  const offlineMessageSchema = z.object({
    visitorName: z.string().max(200).optional(),
    visitorEmail: z.string().email().max(320).optional().or(z.literal('')),
    visitorPhone: z.string().max(30).optional(),
    subject: z.string().max(500).optional(),
    message: z.string().min(1).max(5000),
    queueName: z.string().max(100).optional(),
  });

  publicRouter.post('/offline-message', visitorLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = offlineMessageSchema.parse(req.body || {});
      const queueName = data.queueName || 'chat';

      // Create or find contact if email provided
      let contactId: string | null = null;
      if (data.visitorEmail) {
        try {
          const [contact] = await models.Contact.findOrCreate({
            where: { email: data.visitorEmail },
            defaults: {
              phoneNumber: data.visitorPhone || 'unknown',
              name: data.visitorName || null,
              email: data.visitorEmail,
            },
          });
          contactId = contact.id;
        } catch (err) {
          logger.warn({ err, email: data.visitorEmail }, 'Failed to create/find contact for offline message');
        }
      }

      const conversation = await models.Conversation.create({
        channel: 'webchat',
        status: 'offline',
        visitorName: data.visitorName || 'Visitor',
        visitorEmail: data.visitorEmail || null,
        visitorPhone: data.visitorPhone || null,
        subject: data.subject || 'Offline Message',
        queueName,
        contactId,
        metadata: { offlineMessage: data.message },
        startedAt: new Date(),
      });

      await models.Message.create({
        conversationId: conversation.id,
        sender: 'visitor',
        senderName: data.visitorName || 'Visitor',
        content: data.message,
      });

      await models.Message.create({
        conversationId: conversation.id,
        sender: 'system',
        senderName: 'System',
        content: 'Offline message received. An agent will follow up when available.',
      });

      // Notify agents that an offline message was received
      emitToAgents('chat:offline_message', {
        id: conversation.id,
        visitorName: conversation.visitorName,
        visitorEmail: conversation.visitorEmail,
        subject: conversation.subject,
        queueName: conversation.queueName,
        startedAt: conversation.startedAt,
      });

      bus.emit('chat:offline_message', {
        conversationId: conversation.id,
        visitorName: conversation.visitorName,
        visitorEmail: conversation.visitorEmail,
        queueName: conversation.queueName,
      });

      logger.info({ conversationId: conversation.id }, 'Offline message received');

      res.status(201).json({
        conversationId: conversation.id,
        status: 'offline',
        message: 'Your message has been received. We will get back to you soon.',
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Agent (authenticated) endpoints ──────────────────────────────────────

  // GET /api/chat/conversations — list active + waiting (with optional channel filter)
  agentRouter.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channel, status, mine } = (req.query as any);
      const where: any = {};
      if (channel) where.channel = channel;
      if (status) {
        where.status = status;
      } else {
        where.status = { [Op.in]: ['waiting', 'active', 'offline', 'invited'] };
      }
      if (mine === 'true') {
        const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
        if (myAgent) where.agentId = myAgent.id;
      }

      const conversations = await models.Conversation.findAll({
        where,
        order: [
          ['lastMessageAt', 'DESC'],
          ['startedAt', 'DESC'],
        ],
        limit: 200,
      });

      res.json(conversations);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/chat/conversations/:id — single conversation + messages
  agentRouter.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await models.Conversation.findByPk((req.params as any).id, {
        include: [
          { model: models.Message, as: 'messages' },
        ],
        order: [[{ model: models.Message, as: 'messages' }, 'createdAt', 'ASC']],
      });
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      res.json(conversation);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/chat/:conversationId/accept — agent picks up a waiting chat
  agentRouter.post('/:conversationId/accept', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status === 'closed') {
        return res.status(410).json({ error: 'Conversation is closed' });
      }
      if (conversation.agentId && conversation.agentId !== myAgent.id) {
        return res.status(409).json({ error: 'Already assigned to another agent' });
      }

      await conversation.update({ agentId: myAgent.id, status: 'active' });

      await models.Message.create({
        conversationId: conversation.id,
        sender: 'system',
        senderName: 'System',
        content: 'An agent has joined the conversation.',
      });

      emitToConversation(conversation.id, 'chat:accepted', {
        conversationId: conversation.id,
        agentId: myAgent.id,
      });
      emitToAgents('chat:accepted', {
        conversationId: conversation.id,
        agentId: myAgent.id,
      });

      res.json(conversation);
    } catch (err) {
      next(err);
    }
  });

  const agentMessageSchema = z.object({
    content: z.string().min(1).max(8000),
    contentType: z.enum(['text', 'html', 'file', 'image']).optional(),
  });

  // POST /api/chat/:conversationId/agent-message — agent sends a message
  agentRouter.post('/:conversationId/agent-message', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = agentMessageSchema.parse(req.body || {});
      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status === 'closed') {
        return res.status(410).json({ error: 'Conversation is closed' });
      }

      // Auto-claim if no agent yet
      if (!conversation.agentId) {
        await conversation.update({ agentId: myAgent.id, status: 'active' });
      }

      const senderName =
        myAgent.user?.displayName || myAgent.user?.username || 'Agent';

      const message = await models.Message.create({
        conversationId: conversation.id,
        sender: 'agent',
        senderName,
        content: data.content,
        contentType: data.contentType || 'text',
      });

      // If SMS conversation, also send via Telnyx
      if (conversation.channel === 'sms') {
        try {
          const fromNumber = conversation.telnyxNumber || await getDefaultSmsNumber(models);
          const toNumber = conversation.visitorPhone;
          if (fromNumber && toNumber) {
            // Check opt-out before sending
            const contact = await models.Contact.findOne({ where: { phoneNumber: toNumber } });
            if (contact?.metadata?.optOut) {
              await message.update({ status: 'failed', metadata: { ...message.metadata, error: 'Recipient has opted out of SMS' } });
            } else {
              const mediaUrls = data.contentType === 'image' && message.metadata?.fileUrl ? [message.metadata.fileUrl] : undefined;
              const result = await sendSms(fromNumber, toNumber, data.content, mediaUrls) as any;
              await message.update({ externalId: result?.data?.id, status: 'sent' });
            }
          } else {
            logger.warn({ conversationId: conversation.id, fromNumber, toNumber }, 'SMS send skipped — missing from/to number');
          }
        } catch (err: any) {
          logger.error({ err, conversationId: conversation.id }, 'SMS send failed from inbox');
          await message.update({ status: 'failed', metadata: { ...message.metadata, smsError: err.message } });
        }
      }

      await conversation.update({
        lastMessageAt: new Date(),
        messageCount: (conversation.messageCount || 0) + 1,
      });

      emitToConversation(conversation.id, 'chat:message', message.toJSON());
      emitToAgents('chat:message', { conversationId: conversation.id, ...message.toJSON() });

      // Agent sending a message implies they've read the conversation — mark visitor messages as read
      try {
        await models.Message.update(
          { readAt: new Date() },
          {
            where: {
              conversationId: conversation.id,
              sender: 'visitor',
              readAt: null,
            },
          },
        );
        emitToConversation(conversation.id, 'chat:read', {
          conversationId: conversation.id,
          readBy: 'agent',
        });
      } catch (err) {
        logger.warn({ err, conversationId: conversation.id }, 'Failed to mark messages as read on agent send');
      }

      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // POST /api/chat/:conversationId/close — close conversation
  agentRouter.post('/:conversationId/close', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status === 'closed') return res.json(conversation);

      await conversation.update({ status: 'closed', endedAt: new Date() });

      await models.Message.create({
        conversationId: conversation.id,
        sender: 'system',
        senderName: 'System',
        content: 'Conversation closed.',
      });

      // CSAT survey prompt on close
      await models.Message.create({
        conversationId: conversation.id,
        sender: 'system',
        senderName: 'System',
        content: 'How was your experience? Please rate this chat from 1-5 by visiting the survey link or responding with your rating.',
        metadata: { type: 'csat_prompt' },
      });

      emitToConversation(conversation.id, 'chat:closed', {
        conversationId: conversation.id,
      });
      emitToAgents('chat:closed', { conversationId: conversation.id });

      // Emit event for CSAT prompt
      emitToConversation(conversation.id, 'chat:csat_prompt', {
        conversationId: conversation.id,
        message: 'Please rate your chat experience',
      });

      res.json(conversation);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/chat/:conversationId/transfer — transfer to another agent
  const transferSchema = z.object({
    targetAgentId: z.string().uuid(),
    note: z.string().max(500).optional(),
  });

  agentRouter.post('/:conversationId/transfer', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = transferSchema.parse(req.body || {});
      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status === 'closed') {
        return res.status(410).json({ error: 'Conversation is closed' });
      }

      const target = await models.Agent.findByPk(data.targetAgentId);
      if (!target) return res.status(404).json({ error: 'Target agent not found' });

      const prevAgentId = conversation.agentId;
      await conversation.update({ agentId: target.id, status: 'active' });

      await models.Message.create({
        conversationId: conversation.id,
        sender: 'system',
        senderName: 'System',
        content: data.note
          ? `Conversation transferred. Note: ${data.note}`
          : 'Conversation transferred to another agent.',
      });

      emitToConversation(conversation.id, 'chat:transferred', {
        conversationId: conversation.id,
        fromAgentId: prevAgentId,
        toAgentId: target.id,
      });
      emitToAgents('chat:transferred', {
        conversationId: conversation.id,
        fromAgentId: prevAgentId,
        toAgentId: target.id,
      });

      res.json(conversation);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // POST /api/chat/:conversationId/upload — agent uploads a file to a conversation
  agentRouter.post('/:conversationId/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
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

      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status === 'closed') {
        return res.status(410).json({ error: 'Conversation is closed' });
      }

      // Auto-claim if no agent yet
      if (!conversation.agentId) {
        await conversation.update({ agentId: myAgent.id, status: 'active' });
      }

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

      emitToConversation(conversation.id, 'chat:message', message.toJSON());
      emitToAgents('chat:message', { conversationId: conversation.id, ...message.toJSON() });

      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  });

  // ── CSAT Survey endpoints ──────────────────────────────────────────────

  const surveySchema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional(),
  });

  // POST /api/chat/:conversationId/survey — visitor submits satisfaction survey
  publicRouter.post('/:conversationId/survey', visitorLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = (req.params as any);
      const data = surveySchema.parse(req.body || {});

      const conversation = await models.Conversation.findByPk(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.status !== 'closed') {
        return res.status(400).json({ error: 'Survey can only be submitted for closed conversations' });
      }
      if (conversation.satisfaction != null) {
        return res.status(409).json({ error: 'Survey already submitted for this conversation' });
      }

      await conversation.update({ satisfaction: data.rating });

      await models.Message.create({
        conversationId: conversation.id,
        sender: 'system',
        senderName: 'System',
        content: `Visitor rated this conversation ${data.rating}/5${data.comment ? `. Comment: "${data.comment}"` : ''}`,
        metadata: { type: 'csat_response', rating: data.rating, comment: data.comment || null },
      });

      emitToConversation(conversation.id, 'chat:csat_submitted', {
        conversationId: conversation.id,
        rating: data.rating,
        comment: data.comment || null,
      });
      emitToAgents('chat:csat_submitted', {
        conversationId: conversation.id,
        rating: data.rating,
        comment: data.comment || null,
      });

      bus.emit('chat:csat_submitted', {
        conversationId: conversation.id,
        rating: data.rating,
        comment: data.comment || null,
      });

      logger.info({ conversationId, rating: data.rating }, 'CSAT survey submitted');

      res.json({
        conversationId,
        rating: data.rating,
        comment: data.comment || null,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // GET /api/chat/:conversationId/survey — agent retrieves survey result
  agentRouter.get('/:conversationId/survey', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      if (conversation.satisfaction == null) {
        return res.json({ conversationId: conversation.id, rating: null, comment: null, submitted: false });
      }

      // Find the CSAT message for comment
      const csatMessage = await models.Message.findOne({
        where: {
          conversationId: conversation.id,
          'metadata.type': 'csat_response',
        },
      });

      res.json({
        conversationId: conversation.id,
        rating: conversation.satisfaction,
        comment: csatMessage?.metadata?.comment || null,
        submitted: true,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── 4. Canned Responses ─────────────────────────────────────────────────

  // GET /api/chat/canned-responses — agent gets canned responses for their queue
  agentRouter.get('/canned-responses', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const queueNames: string[] = Array.isArray(myAgent.queues) ? myAgent.queues : [];

      // Get global responses (no category/queue filter) and queue-specific ones
      const where: any = {
        active: true,
      };

      if (queueNames.length > 0) {
        where[Op.or] = [
          { category: { [Op.in]: queueNames } },
          { category: null },
          { category: '' },
        ];
      }

      const responses = await models.CannedResponse.findAll({ where, order: [['shortcut', 'ASC']] });
      res.json(responses);
    } catch (err) {
      next(err);
    }
  });

  // ── 5. Chat Escalation to Voice ────────────────────────────────────────

  const escalateSchema = z.object({
    visitorPhone: z.string().max(30).optional(),
    contactId: z.string().uuid().optional(),
  });

  // POST /api/chat/:conversationId/escalate-to-call — agent triggers outbound call to visitor
  agentRouter.post('/:conversationId/escalate-to-call', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = escalateSchema.parse(req.body || {});
      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      // Resolve phone number from body, conversation, or contact
      let phoneNumber = data.visitorPhone || conversation.visitorPhone;
      if (!phoneNumber && data.contactId) {
        const contact = await models.Contact.findByPk(data.contactId);
        if (contact) {
          phoneNumber = contact.phoneNumber;
          // Link contact to conversation if not already linked
          if (!conversation.contactId) {
            await conversation.update({ contactId: contact.id });
          }
        }
      }
      if (!phoneNumber && conversation.contactId) {
        const contact = await models.Contact.findByPk(conversation.contactId);
        if (contact) phoneNumber = contact.phoneNumber;
      }

      if (!phoneNumber) {
        return res.status(400).json({ error: 'No phone number available for this visitor. Provide visitorPhone or contactId.' });
      }

      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      // Initiate outbound call via Telnyx
      const env = (await import('../config/env.js')).loadEnv();
      const fromNumber = env.TELNYX_FROM_NUMBER || '+10000000000';

      const telnyxModule = await import('../services/telnyx.js');
      const dialResp = await telnyxModule.dialCall({
        connectionId: env.TELNYX_APP_CONNECTION_ID,
        to: phoneNumber,
        from: fromNumber,
        timeout_secs: 30,
      });

      // Create a Call record linked to this conversation
      const call = await models.Call.create({
        callControlId: dialResp.call_control_id,
        callSessionId: dialResp.call_session_id,
        direction: 'outbound',
        from: fromNumber,
        to: phoneNumber,
        status: 'ringing',
        agentId: myAgent.id,
        contactId: conversation.contactId || data.contactId || null,
        callPurpose: 'primary',
        startedAt: new Date(),
        notes: `Escalated from chat conversation ${conversation.id}`,
      });

      // Add a system message to the chat about the escalation
      await models.Message.create({
        conversationId: conversation.id,
        sender: 'system',
        senderName: 'System',
        content: `Agent escalated this chat to a phone call to ${phoneNumber}.`,
        metadata: { type: 'escalation', callId: call.id, phoneNumber },
      });

      emitToConversation(conversation.id, 'chat:escalated_to_call', {
        conversationId: conversation.id,
        callId: call.id,
        phoneNumber,
      });
      emitToAgents('chat:escalated_to_call', {
        conversationId: conversation.id,
        callId: call.id,
        phoneNumber,
      });

      logger.info({ conversationId: conversation.id, callId: call.id, phoneNumber }, 'Chat escalated to voice call');

      res.status(201).json({
        callId: call.id,
        callControlId: dialResp.call_control_id,
        phoneNumber,
        status: 'ringing',
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── 6. Proactive Chat Invite ───────────────────────────────────────────

  const proactiveInviteSchema = z.object({
    sessionId: z.string().max(200).optional(),
    contactId: z.string().uuid().optional(),
    visitorName: z.string().max(200).optional(),
    visitorEmail: z.string().email().max(320).optional().or(z.literal('')),
    queueName: z.string().max(100).optional(),
    message: z.string().min(1).max(2000),
  });

  // POST /api/chat/proactive-invite — agent sends proactive chat invite to a visitor
  agentRouter.post('/proactive-invite', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = proactiveInviteSchema.parse(req.body || {});
      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const queueName = data.queueName || 'chat';
      const agentName = myAgent.user?.displayName || myAgent.user?.username || 'Agent';

      const conversation = await models.Conversation.create({
        channel: 'webchat',
        status: 'invited',
        agentId: myAgent.id,
        visitorName: data.visitorName || 'Visitor',
        visitorEmail: data.visitorEmail || null,
        queueName,
        contactId: data.contactId || null,
        metadata: {
          proactiveInvite: true,
          sessionId: data.sessionId || null,
        },
        startedAt: new Date(),
      });

      await models.Message.create({
        conversationId: conversation.id,
        sender: 'agent',
        senderName: agentName,
        content: data.message,
      });

      // Emit proactive invite event to the visitor's session (if available)
      emitToConversation(conversation.id, 'chat:proactive_invite', {
        conversationId: conversation.id,
        agentId: myAgent.id,
        agentName,
        message: data.message,
        sessionId: data.sessionId || null,
      });

      // Notify all agents about the proactive invite
      emitToAgents('chat:proactive_invite', {
        conversationId: conversation.id,
        agentId: myAgent.id,
        agentName,
        visitorName: conversation.visitorName,
      });

      bus.emit('chat:proactive_invite', {
        conversationId: conversation.id,
        agentId: myAgent.id,
        sessionId: data.sessionId || null,
      });

      logger.info({ conversationId: conversation.id, agentId: myAgent.id }, 'Proactive chat invite sent');

      res.status(201).json({
        conversationId: conversation.id,
        status: 'invited',
        agentName,
        message: data.message,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── 7. Chat Transcript Email ───────────────────────────────────────────

  const transcriptSchema = z.object({
    email: z.string().email().max(320),
  });

  // POST /api/chat/:conversationId/transcript — generate and email transcript
  agentRouter.post('/:conversationId/transcript', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = transcriptSchema.parse(req.body || {});
      const conversation = await models.Conversation.findByPk((req.params as any).conversationId, {
        include: [
          { model: models.Message, as: 'messages', order: [['createdAt', 'ASC']] },
        ],
      });
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const messages = conversation.messages || [];

      // Format transcript as HTML
      const htmlParts = [
        '<html><head><style>',
        'body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }',
        '.header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }',
        '.message { margin-bottom: 10px; padding: 8px; border-radius: 4px; }',
        '.visitor { background-color: #e8f4fd; }',
        '.agent { background-color: #f0f0f0; }',
        '.system { background-color: #fff3cd; font-style: italic; }',
        '.sender { font-weight: bold; }',
        '.time { color: #666; font-size: 0.85em; }',
        '</style></head><body>',
        `<div class="header">`,
        `<h2>Chat Transcript</h2>`,
        `<p>Conversation ID: ${conversation.id}</p>`,
        `<p>Visitor: ${conversation.visitorName || 'Unknown'}</p>`,
        `<p>Started: ${conversation.startedAt ? new Date(conversation.startedAt).toLocaleString() : 'N/A'}</p>`,
        `<p>Ended: ${conversation.endedAt ? new Date(conversation.endedAt).toLocaleString() : 'N/A'}</p>`,
        `</div>`,
      ];

      for (const msg of messages) {
        const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '';
        const cssClass = msg.sender === 'visitor' ? 'visitor' : msg.sender === 'agent' ? 'agent' : 'system';
        htmlParts.push(
          `<div class="message ${cssClass}">`,
          `<span class="sender">${msg.senderName || msg.sender}:</span> `,
          `${msg.content}`,
          `<span class="time"> (${time})</span>`,
          `</div>`,
        );
      }

      htmlParts.push('</body></html>');
      const html = htmlParts.join('\n');

      // Log the email (no actual SMTP for now)
      logger.info({
        conversationId: conversation.id,
        email: data.email,
        messageCount: messages.length,
      }, 'Chat transcript email (logged, no SMTP)');

      // Mark transcript as sent
      await conversation.update({ transcriptSentAt: new Date() });

      bus.emit('chat:transcript_sent', {
        conversationId: conversation.id,
        email: data.email,
      });

      res.json({
        conversationId: conversation.id,
        email: data.email,
        messageCount: messages.length,
        sentAt: new Date().toISOString(),
        note: 'Transcript logged (SMTP not configured)',
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── 8. Chat Tags Management ──────────────────────────────────────────────

  const tagsSchema = z.object({
    tags: z.array(z.string().max(50)).min(1).max(20),
  });

  // POST /api/chat/:conversationId/tags — add tags to conversation
  agentRouter.post('/:conversationId/tags', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = tagsSchema.parse(req.body || {});
      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const existingTags: string[] = Array.isArray(conversation.metadata?.tags) ? conversation.metadata.tags : [];
      const newTags = [...new Set([...existingTags, ...data.tags])]; // dedupe
      const metadata = { ...(conversation.metadata || {}), tags: newTags };

      await conversation.update({ metadata });

      emitToConversation(conversation.id, 'chat:tags_updated', {
        conversationId: conversation.id,
        tags: newTags,
      });

      res.json({ conversationId: conversation.id, tags: newTags });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // DELETE /api/chat/:conversationId/tags/:tag — remove a tag from conversation
  agentRouter.delete('/:conversationId/tags/:tag', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tag } = (req.params as any);
      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const existingTags: string[] = Array.isArray(conversation.metadata?.tags) ? conversation.metadata.tags : [];
      const newTags = existingTags.filter((t: string) => t !== tag);
      const metadata = { ...(conversation.metadata || {}), tags: newTags };

      await conversation.update({ metadata });

      emitToConversation(conversation.id, 'chat:tags_updated', {
        conversationId: conversation.id,
        tags: newTags,
      });

      res.json({ conversationId: conversation.id, tags: newTags });
    } catch (err) {
      next(err);
    }
  });

  // ── 9. Read Receipts ───────────────────────────────────────────────────

  // POST /api/chat/:conversationId/read — mark all unread visitor messages as read by agent
  agentRouter.post('/:conversationId/read', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await models.Conversation.findByPk((req.params as any).conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const [updated] = await models.Message.update(
        { readAt: new Date() },
        {
          where: {
            conversationId: conversation.id,
            sender: 'visitor',
            readAt: null,
          },
        },
      );

      emitToConversation(conversation.id, 'chat:read', {
        conversationId: conversation.id,
        readBy: 'agent',
        count: updated,
      });

      res.json({ conversationId: conversation.id, markedRead: updated });
    } catch (err) {
      next(err);
    }
  });

  // ── 10. SLA Stats ──────────────────────────────────────────────────────

  // GET /api/chat/sla-stats — returns SLA statistics for chat conversations
  agentRouter.get('/sla-stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();

      // Total waiting conversations (currently in breach)
      const waitingBreached = await models.Conversation.count({
        where: {
          status: 'waiting',
          slaResponseBy: { [Op.lt]: now },
        },
      });

      const waitingNotBreached = await models.Conversation.count({
        where: {
          status: 'waiting',
          slaResponseBy: { [Op.gte]: now },
        },
      });

      // All conversations that were in 'waiting' and got answered (active or closed with agentId)
      const answeredConversations = await models.Conversation.findAll({
        where: {
          status: { [Op.in]: ['active', 'closed'] },
          agentId: { [Op.ne]: null },
          startedAt: { [Op.ne]: null },
        },
        attributes: ['id', 'startedAt', 'slaResponseBy', 'updatedAt'],
      });

      let withinSla = 0;
      let totalAnswered = answeredConversations.length;
      let totalWaitSeconds = 0;

      for (const conv of answeredConversations) {
        // Approximate: if the conversation got an agent, the wait was from startedAt to the assignment
        // We use the updatedAt as a rough proxy for when the agent was assigned
        const startedAt = new Date(conv.startedAt).getTime();
        const answeredAt = new Date(conv.updatedAt).getTime();
        const waitSeconds = Math.round((answeredAt - startedAt) / 1000);
        totalWaitSeconds += waitSeconds;

        const sla = conv.slaResponseBy ? new Date(conv.slaResponseBy).getTime() : startedAt + DEFAULT_SLA_SECONDS * 1000;
        if (answeredAt <= sla) {
          withinSla++;
        }
      }

      const slaPercent = totalAnswered > 0 ? Math.round((withinSla / totalAnswered) * 100) : 100;
      const avgWaitSeconds = totalAnswered > 0 ? Math.round(totalWaitSeconds / totalAnswered) : 0;

      res.json({
        currentBreaches: waitingBreached,
        waitingInSla: waitingNotBreached,
        totalAnswered,
        answeredWithinSla: withinSla,
        slaPercent,
        avgWaitSeconds,
      });
    } catch (err) {
      next(err);
    }
  });

  return { publicRouter, agentRouter };
}

// Export SLA reaper control for server lifecycle
export { startSlaReaper, stopSlaReaper };

async function getDefaultSmsNumber(models: any) {
  const num = await models.NumberAssignment.findOne();
  return num?.phoneNumber || null;
}

