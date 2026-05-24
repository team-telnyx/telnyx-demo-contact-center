import 'dotenv/config';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { loadEnv } from './config/env.js';
import { initDatabase } from './config/database.js';
import { initModels } from './models/index.js';
import { createAuthRouter } from './routes/auth.js';
import { createWebhookRouter } from './routes/webhooks.js';
import { createAgentsRouter } from './routes/agents.js';
import { createIvrRouter } from './routes/ivr.js';
import { createHistoryRouter } from './routes/history.js';
import { createVoiceRouter } from './routes/voice.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { createCannedResponsesRouter } from './routes/canned-responses.js';
import { createAgentAssistRouter } from './routes/agent-assist.js';
import { createWallboardRouter } from './routes/wallboard.js';
import { createChatRouter } from './routes/chat.js';
import { createDispositionsRouter, createCallDispositionRouter } from './routes/dispositions.js';
import { createContactsRouter } from './routes/contacts.js';
import { createQueuesRouter } from './routes/queues.js';
import { createInternalChatRouter } from './routes/internal-chat.js';
import { createInternalCallingRouter } from './routes/internal-calling.js';
import { createNumbersRouter } from './routes/numbers.js';
import { createSmsRouter } from './routes/sms.js';
import { createSmsTemplatesRouter } from './routes/sms-templates.js';
import { createScheduledSmsRouter, initScheduledSmsReaper, stopScheduledSmsReaper } from './routes/scheduled-sms.js';
import { createCoachingRouter } from './routes/coaching.js';
import { createWorkflowsRouter } from './routes/workflows.js';
import { registerWorkflowTriggers } from './routes/workflows.js';
import { createRecordingsRouter } from './routes/recordings.js';
import { authMiddleware } from './middleware/auth.js';
import { verifyTelnyxSignature } from './middleware/verifyTelnyxSignature.js';
import { errorHandler } from './middleware/errorHandler.js';
import logger from './middleware/errorHandler.js';
import { initSocketIO } from './services/socket.js';
import { UPLOAD_ROOT } from './services/file-storage.js';
import { initAcd, startQueueReaper, stopQueueReaper, recoverState } from './services/acd.js';
import { initTelnyx } from './services/telnyx.js';
import { closeAllTranscriptions } from './services/transcription.js';

async function main() {
  const env = loadEnv();
  logger.info(
    { port: env.PORT, nodeEnv: env.NODE_ENV, company: env.COMPANY_NAME },
    'Starting Telnyx Contact Center',
  );

  const sequelize = initDatabase(env.DATABASE_URL);
  const models = initModels(sequelize);

  try {
    await sequelize.authenticate();
    logger.info('Database connected');
  } catch (err) {
    logger.fatal({ err }, 'Database connection failed');
    process.exit(1);
  }

  // Sync in all environments — safe with alter (preserves data) and ensures
  // tables are created on first deploy without needing to toggle NODE_ENV.
  await sequelize.sync({ alter: true });
  logger.info('Database synced (alter)');

  initTelnyx(env.TELNYX_API_KEY);
  logger.info('Telnyx SDK initialised');

  initAcd(models);
  startQueueReaper();
  initScheduledSmsReaper(models);

  await recoverState(models);

  const { setModels } = await import('./services/socket.js');
  setModels(models);

  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        connectSrc: ["'self'", "wss:", "ws:", "https://api.telnyx.com", "https://wss.telnyx.com"],
        fontSrc: ["'self'", "data:"],
        mediaSrc: ["'self'", "blob:", "https://*.telnyx.com"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  const corsAllowed = (env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const corsOrigin: any = corsAllowed.includes('*')
    ? true
    : corsAllowed.length > 0
      ? corsAllowed
      : env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : false;
  app.use(cors({ origin: corsOrigin, credentials: true }));

  app.use(
    '/api/webhooks',
    express.raw({ type: 'application/json', limit: '1mb' }),
    verifyTelnyxSignature(env.TELNYX_PUBLIC_KEY),
  );

  app.use(express.json({ limit: '1mb' }));

  app.use('/uploads', express.static(UPLOAD_ROOT, {
    maxAge: '7d',
    etag: true,
    immutable: false,
    setHeaders: (res: express.Response, filePath: string) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      res.setHeader('X-Frame-Options', 'DENY');
      const ext = path.extname(filePath).toLowerCase();
      const inlineExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp3', '.wav', '.ogg'];
      if (!inlineExts.includes(ext)) {
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
      }
    },
  }));

  const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false });
  const webhookLimiter = rateLimit({ windowMs: 60 * 1000,      max: 500, standardHeaders: true, legacyHeaders: false });
  const apiLimiter     = rateLimit({ windowMs: 60 * 1000,      max: 200, standardHeaders: true, legacyHeaders: false });

  app.get('/health', (_req: express.Request, res: express.Response) =>
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      features: { stt: env.STT_ENABLED, ai: env.LLM_ENABLED },
    }),
  );

  app.use('/api/webhooks', webhookLimiter, createWebhookRouter(models));
  app.use('/api/auth', authLimiter, createAuthRouter(models));

  const { publicRouter: chatPublicRouter, agentRouter: chatAgentRouter } = createChatRouter(models);
  app.use('/api/chat', apiLimiter, chatPublicRouter);

  const apiRouter = express.Router();
  apiRouter.use(authMiddleware);
  apiRouter.use('/agents',  createAgentsRouter(models));
  apiRouter.use('/ivr',     createIvrRouter(models));
  apiRouter.use('/history', createHistoryRouter(models));
  apiRouter.use('/voice',   createVoiceRouter(models));
  apiRouter.use('/analytics', createAnalyticsRouter(models));
  apiRouter.use('/canned-responses', createCannedResponsesRouter(models));
  apiRouter.use('/agent-assist', createAgentAssistRouter(models));
  apiRouter.use('/wallboard', createWallboardRouter(models));
  apiRouter.use('/chat',    chatAgentRouter);
  apiRouter.use('/queues',    createQueuesRouter(models));
  apiRouter.use('/dispositions', createDispositionsRouter(models));
  apiRouter.use('/contacts', createContactsRouter(models));
  apiRouter.use('/calls/:callId/disposition', createCallDispositionRouter(models));
  apiRouter.use('/internal-chat', createInternalChatRouter(models));
  apiRouter.use('/internal-calling', createInternalCallingRouter(models));
  apiRouter.use('/numbers', createNumbersRouter(models));
  apiRouter.use('/sms', createSmsRouter(models));
  apiRouter.use('/sms-templates', createSmsTemplatesRouter(models));
  apiRouter.use('/scheduled-sms', createScheduledSmsRouter(models));
  apiRouter.use('/coaching', createCoachingRouter(models));
  apiRouter.use('/workflows', createWorkflowsRouter(models));
  apiRouter.use('/recordings', createRecordingsRouter(models));

  apiRouter.get('/features', (_req: express.Request, res: express.Response) => {
    res.json({ stt: env.STT_ENABLED, ai: env.LLM_ENABLED, companyName: env.COMPANY_NAME });
  });

  app.use('/api', apiLimiter, apiRouter);

  logger.info('Routes registered: auth, webhooks, agents, ivr, history, voice, analytics, canned-responses, agent-assist, wallboard, chat, queues, dispositions, contacts, internal-chat, internal-calling, numbers, sms, sms-templates, scheduled-sms, recordings, coaching, workflows');

  app.use(errorHandler);

  const server = http.createServer(app);
  const io = await initSocketIO(server);
  logger.info('Socket.IO initialised');

  let redisSubscriber: any = null;
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis');
      redisSubscriber = createClient({ url: process.env.REDIS_URL });
      redisSubscriber.on('error', (err: any) => logger.error({ err }, 'Redis subscriber error'));
      await redisSubscriber.connect();
      await redisSubscriber.subscribe('telnyx:call-events', (message: string) => {
        try { const event = JSON.parse(message); io.emit('call:event', event); }
        catch (err) { logger.error({ err }, 'Failed to parse Redis event'); }
      });
      logger.info('Redis subscriber connected for call events');
    } catch (err) {
      logger.warn({ err }, 'Redis subscriber connection failed — real-time events from Go handler will use HTTP forwarding only');
    }
  } else {
    logger.info('REDIS_URL not set — Redis pub/sub for Go handler disabled (HTTP forwarding still works)');
  }

  await registerWorkflowTriggers(models);
  logger.info('Workflow triggers registered');

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, url: `http://localhost:${env.PORT}` }, '🚀 Server running');
    logger.info({ webhookUrl: `${env.PUBLIC_URL}/api/webhooks` }, '📡 Webhook URL');
  });

  async function checkNumberAssignments() {
    try {
      const numbers = await models.NumberAssignment.findAll({ include: [{ model: models.IvrFlow, as: 'ivrFlow' }] });
      if (numbers.length === 0) {
        logger.warn('⚠️  No NumberAssignment rows — inbound calls will hit the default branch. Seed before demoing.');
      } else {
        for (const n of numbers) {
          const na = n as any;
          if (!na.ivrFlow) {
            logger.warn({ phoneNumber: na.phoneNumber, ivrFlowId: na.ivrFlowId }, '⚠️  NumberAssignment has no linked IVR flow — calls to this DID will fall through');
          } else {
            logger.info({ phoneNumber: na.phoneNumber, flow: na.ivrFlow.name, published: na.ivrFlow.published }, '✅ NumberAssignment ready');
          }
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'NumberAssignment readiness check failed (non-fatal)');
    }
  }
  checkNumberAssignments();

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down...');
    stopQueueReaper();
    stopScheduledSmsReaper();
    closeAllTranscriptions();
    if (redisSubscriber) { try { await redisSubscriber.quit(); } catch (_) {} }
    server.close();
    await sequelize.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason: any) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err: any) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  setTimeout(() => process.exit(1), 100);
});

main().catch((err: any) => {
  logger.fatal(err, 'Unhandled error in main');
  process.exit(1);
});
