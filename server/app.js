import express from 'express';
import session from 'express-session';
import cors from 'cors';
import bodyParser from 'body-parser';

import { injectPrismaMiddleware } from './middleware/prisma-middleware.js';

import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import inboundVoiceRoutes from './routes/inboundVoiceRoutes.prisma.js';
import outboundVoiceRoutes from './routes/outboundVoiceRoutes.prisma.js';
import telnyxRoutes from './routes/telnyxRoutes.js';

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-session-secret-for-dev',
    resave: false,
    saveUninitialized: true,
  })
);

app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    'https://localhost:3001',
    'https://localhost:3000',
    'https://contactcenter.telnyx.solutions',
    'https://telnyx.solutions'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(bodyParser.json({ limit: '20mb' }));

app.use(injectPrismaMiddleware);

app.use((req, _res, next) => {
  if (!req.env && globalThis.__CLOUDFLARE_ENV__) {
    req.env = globalThis.__CLOUDFLARE_ENV__;
  }
  if (!req.ctx && globalThis.__CLOUDFLARE_CTX__) {
    req.ctx = globalThis.__CLOUDFLARE_CTX__;
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import mediaRoutes from './routes/mediaRoutes.js';

app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/voice', inboundVoiceRoutes);
app.use('/api/voice', outboundVoiceRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/telnyx', telnyxRoutes);

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
