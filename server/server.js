// Import required modules and config
import fs from 'fs';
import http from 'http';
import https from 'https';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import { env } from './src/config/env.js';
import sequelize from './config/database.js';
import userRoutes from './routes/userRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import ivrRoutes from './routes/ivrRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import seedDatabase from './seeds/seed.js';
import { initWebSocket } from './routes/websocket.js';

// Import all models so sync creates their tables
import './models/CallRecord.js';
import './models/IvrFlow.js';
import './models/Settings.js';

const app = express();
app.set('trust proxy', 1);

let server;
const TLS_KEY_PATH = '/etc/letsencrypt/live/app.telnyx.solutions/privkey.pem';
const TLS_CERT_PATH = '/etc/letsencrypt/live/app.telnyx.solutions/fullchain.pem';

if (fs.existsSync(TLS_KEY_PATH) && fs.existsSync(TLS_CERT_PATH)) {
  try {
    const credentials = {
      key: fs.readFileSync(TLS_KEY_PATH, 'utf8'),
      cert: fs.readFileSync(TLS_CERT_PATH, 'utf8'),
    };
    server = https.createServer(credentials, app);
    console.log('Starting with HTTPS');
  } catch (err) {
    console.warn('Could not read TLS certs, falling back to HTTP:', err.message);
    server = http.createServer(app);
  }
} else {
  console.log('TLS certs not found, starting with HTTP');
  server = http.createServer(app);
}

initWebSocket(server);

// Security middleware
app.use(helmet({
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: env.CORS_ORIGINS.includes('*') ? true : env.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: 'Too many login attempts, please try again later' },
});
app.use('/api/users/login', loginLimiter);

const webhookLimiter = rateLimit({
  windowMs: 1000,
  max: 100,
});
app.use('/api/voice/webhook', webhookLimiter);
app.use('/api/conversations/webhook', webhookLimiter);

// Session setup
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, httpOnly: true, sameSite: 'strict' },
  })
);

// Body parser
app.use(bodyParser.json({limit: '20mb'}));

// User Routes
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/ivr', ivrRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3000;

// Sync the database and then start the server
const init = async () => {
  try {
    await sequelize.sync();
    // Seed only if no users exist (first run)
    const User = (await import('./models/User.js')).default;
    const userCount = await User.count();
    if (userCount === 0) {
      await seedDatabase();
    }
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

init();
