# Configuration Guide

This guide covers all configuration aspects for both the client and server components of the WebRTC Contact Center application.

## Overview

The application requires configuration for:
- API endpoints and connectivity
- Telnyx WebRTC integration
- SSL/HTTPS setup
- Database configuration
- Authentication settings
- WebSocket connections

## Environment Files

### Server Configuration

The server can be configured through environment variables or direct code modification.

#### Option 1: Environment Variables (Recommended)
Create a `.env` file in the server directory:

```bash
# /server/.env
PORT=3002
NODE_ENV=production

# Database Configuration
DB_PATH=./database.sqlite
DB_BACKUP_INTERVAL=86400000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Telnyx API Configuration
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_APP_ID=your_telnyx_app_id
TELNYX_PHONE_NUMBER=+1234567890

# SSL Configuration
SSL_CERT_PATH=./cert.pem
SSL_KEY_PATH=./key.pem

# CORS Configuration
ALLOWED_ORIGINS=https://localhost:3001,https://yourdomain.com,https://telnyx.solutions

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
WS_TIMEOUT=60000
```

#### Option 2: Direct Configuration
Modify `server.js` directly:

```javascript
// Port configuration
const PORT = process.env.PORT || 3002;

// Database configuration
const dbPath = process.env.DB_PATH || './database.sqlite';

// JWT configuration
const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret';

// CORS configuration
const corsOptions = {
  origin: [
    "https://localhost:3001",
    "https://yourdomain.com",
    "https://telnyx.solutions"
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
```

### Client Configuration

The client uses a `.env` file in the client directory:

```bash
# /client/.env

# Build Configuration
GENERATE_SOURCEMAP=false
SKIP_PREFLIGHT_CHECK=true

# API Configuration
REACT_APP_API_HOST=telnyx.solutions
REACT_APP_API_PORT=443
REACT_APP_HTTPS=true

# Development Server Configuration
HTTPS=true
SSL_CRT_FILE=cert.pem
SSL_KEY_FILE=key.pem
PORT=3001

# Browser Configuration
BROWSER=none
FAST_REFRESH=true

# WebSocket Configuration
REACT_APP_WS_RECONNECT_ATTEMPTS=5
REACT_APP_WS_RECONNECT_DELAY=3000

# Telnyx Client Configuration
REACT_APP_TELNYX_CONNECTION_ID=your_connection_id_here

# Debug Configuration (development only)
REACT_APP_DEBUG=false
REACT_APP_LOG_LEVEL=info
```

## Telnyx Integration Setup

### 1. Telnyx Account Setup
1. Create account at [telnyx.com](https://telnyx.com)
2. Navigate to WebRTC section
3. Create a new WebRTC application
4. Note down your credentials

### 2. WebRTC Application Configuration
In your Telnyx dashboard:

```json
{
  "app_name": "Contact Center WebRTC",
  "webhook_event_url": "https://yourdomain.com/api/telnyx/webhook",
  "webhook_event_failover_url": "https://backup.yourdomain.com/api/telnyx/webhook",
  "webhook_timeout_secs": 25,
  "webhook_api_version": "2",
  "first_command_timeout": true,
  "first_command_timeout_secs": 10
}
```

### 3. Phone Number Configuration
Purchase and configure phone numbers:

```bash
# Example: Configure inbound phone number
curl -X POST https://api.telnyx.com/v2/phone_numbers/+1234567890/messaging \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_event_url": "https://yourdomain.com/api/telnyx/webhook",
    "webhook_event_failover_url": "https://backup.yourdomain.com/api/telnyx/webhook"
  }'
```

### 4. Server Integration
Update server configuration:

```javascript
// In server.js or voiceRoutes.js
const telnyxConfig = {
  apiKey: process.env.TELNYX_API_KEY,
  appId: process.env.TELNYX_APP_ID,
  phoneNumber: process.env.TELNYX_PHONE_NUMBER,
  webhookUrl: `https://${process.env.DOMAIN}/api/telnyx/webhook`
};
```

## SSL/HTTPS Configuration

### Development (Self-signed certificates)
```bash
# Generate self-signed certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# Copy to both client and server directories
cp cert.pem client/
cp key.pem client/
cp cert.pem server/
cp key.pem server/
```

### Production (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./key.pem
sudo chown $USER:$USER *.pem
```

### Automatic Certificate Renewal
```bash
# Add to crontab for automatic renewal
sudo crontab -e

# Add this line (check certificates daily, renew if needed)
0 2 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl restart your-app-service"
```

## Database Configuration

### SQLite Setup (Default)
```javascript
// Database file configuration
const dbPath = process.env.DB_PATH || './database.sqlite';

// Connection options
const dbOptions = {
  verbose: console.log // Enable SQL logging in development
};
```

### Database Schema Initialization
```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  firstName TEXT,
  lastName TEXT,
  role TEXT DEFAULT 'agent',
  status BOOLEAN DEFAULT 1,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_control_id TEXT UNIQUE,
  from_number TEXT,
  to_number TEXT,
  status TEXT DEFAULT 'active',
  direction TEXT, -- 'inbound' or 'outbound'
  duration INTEGER DEFAULT 0,
  agent_id INTEGER,
  bridge_id TEXT,
  customer_call_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  FOREIGN KEY (agent_id) REFERENCES users(id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT,
  from_number TEXT,
  to_number TEXT,
  body TEXT,
  media_url TEXT,
  direction TEXT, -- 'inbound' or 'outbound'
  status TEXT DEFAULT 'received',
  agent_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
```

### Database Backup Configuration
```javascript
// Automatic backup setup (in server.js)
const backupInterval = process.env.DB_BACKUP_INTERVAL || 86400000; // 24 hours

setInterval(() => {
  const backup = require('fs').createReadStream('database.sqlite')
    .pipe(require('fs').createWriteStream(`backup_${Date.now()}.sqlite`));
}, backupInterval);
```

## Authentication Configuration

### JWT Settings
```javascript
// JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET || 'change-this-secret-key',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  issuer: 'contact-center-app',
  audience: 'contact-center-users'
};

// Token generation
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    }
  );
};
```

### Password Security
```javascript
// Bcrypt configuration
const bcrypt = require('bcrypt');
const saltRounds = 12;

// Password hashing
const hashPassword = async (password) => {
  return await bcrypt.hash(password, saltRounds);
};

// Password validation
const validatePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};
```

## WebSocket Configuration

### Server WebSocket Setup
```javascript
// Socket.io configuration
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: process.env.WS_TIMEOUT || 60000,
  pingInterval: process.env.WS_HEARTBEAT_INTERVAL || 25000,
  upgradeTimeout: 30000,
  allowEIO3: true
});

// Connection handling
io.on('connection', (socket) => {
  console.log(`WebSocket connected: ${socket.id}`);

  // Set socket timeout
  socket.setTimeout(60000);

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`WebSocket disconnected: ${socket.id}, reason: ${reason}`);
  });
});
```

### Client WebSocket Setup
```javascript
// Socket.io client configuration
import io from 'socket.io-client';

const socketConfig = {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: parseInt(process.env.REACT_APP_WS_RECONNECT_ATTEMPTS) || 5,
  reconnectionDelay: parseInt(process.env.REACT_APP_WS_RECONNECT_DELAY) || 1000,
  timeout: 20000,
  forceNew: true
};

// Connection setup
const socket = io(getWebSocketUrl(), socketConfig);
```

## API Configuration

### CORS Setup
```javascript
// CORS configuration for server
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
```

### Rate Limiting
```javascript
// Rate limiting configuration
const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  duration: process.env.RATE_LIMIT_WINDOW_MS || 900, // 15 minutes
});
```

### API Response Format
```javascript
// Standardized API response format
const apiResponse = {
  success: (data, message = 'Success') => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }),

  error: (message, code = 500, details = null) => ({
    success: false,
    error: {
      message,
      code,
      details
    },
    timestamp: new Date().toISOString()
  })
};
```

## Development vs Production

### Development Configuration
```javascript
// Development settings
if (process.env.NODE_ENV === 'development') {
  // Enable detailed logging
  app.use(morgan('combined'));

  // Enable CORS for localhost
  corsOptions.origin = [
    'https://localhost:3001',
    'https://127.0.0.1:3001'
  ];

  // Enable debug mode
  process.env.DEBUG = 'socket.io:*';
}
```

### Production Configuration
```javascript
// Production settings
if (process.env.NODE_ENV === 'production') {
  // Disable detailed logging
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));

  // Enable compression
  app.use(compression());

  // Security headers
  app.use(helmet({
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Trust proxy for proper IP detection
  app.set('trust proxy', 1);
}
```

## Testing Configuration

### Test Environment Setup
```bash
# Create test environment file
# /client/.env.test
REACT_APP_API_HOST=localhost
REACT_APP_API_PORT=3002
REACT_APP_HTTPS=true
SKIP_PREFLIGHT_CHECK=true

# /server/.env.test
NODE_ENV=test
PORT=3002
DB_PATH=./test_database.sqlite
JWT_SECRET=test-secret-key
```

### Test Database Setup
```javascript
// Test database configuration
const testDbPath = './test_database.sqlite';

// Reset test database before tests
beforeAll(async () => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  // Initialize fresh test database
  await initializeDatabase(testDbPath);
});

afterAll(async () => {
  // Clean up test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
```

## Monitoring Configuration

### Logging Setup
```javascript
// Winston logging configuration
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'combined.log'
    })
  ]
});
```

### Health Check Endpoint
```javascript
// Health check configuration
app.get('/api/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    database: 'connected', // Add actual database check
    websocket: 'active',    // Add WebSocket status check
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };

  res.status(200).json(healthcheck);
});
```

## Troubleshooting Configuration Issues

### Common Configuration Problems

#### Environment Variables Not Loading
```bash
# Check if .env file exists and is readable
ls -la .env
cat .env

# Verify environment variables are loaded
node -e "console.log(process.env.REACT_APP_API_HOST)"

# For server
node -e "console.log(process.env.TELNYX_API_KEY)"
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in cert.pem -text -noout | head -20

# Verify certificate and key match
openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in key.pem | openssl md5
# These should output the same hash
```

#### Database Connection Issues
```bash
# Check database file exists and is writable
ls -la database.sqlite
sqlite3 database.sqlite "SELECT name FROM sqlite_master WHERE type='table';"

# Test database connection
node -e "
const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');
console.log('Database connected successfully');
db.close();
"
```

#### API Connectivity Issues
```bash
# Test server API endpoints
curl -k https://localhost:3002/api/health

# Test client API configuration
node -e "
const { getApiBaseUrl } = require('./src/utils/apiUtils.js');
console.log('API Base URL:', getApiBaseUrl());
"
```

### Configuration Validation Script

Create a configuration validator:

```javascript
// config-validator.js
const fs = require('fs');
const path = require('path');

function validateConfig() {
  const errors = [];

  // Check SSL certificates
  if (!fs.existsSync('cert.pem') || !fs.existsSync('key.pem')) {
    errors.push('SSL certificates missing');
  }

  // Check required environment variables
  const requiredEnvVars = [
    'REACT_APP_API_HOST',
    'REACT_APP_API_PORT',
    'TELNYX_API_KEY'
  ];

  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing environment variable: ${varName}`);
    }
  });

  // Check database
  if (!fs.existsSync('./database.sqlite')) {
    console.warn('Database file does not exist - will be created on first run');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Configuration validation passed!');
}

validateConfig();
```

Run validation:
```bash
node config-validator.js
```

## Next Steps

After completing configuration:
1. Test the complete system integration
2. Review [06-architecture.md](./06-architecture.md) for system understanding
3. Check [10-troubleshooting.md](./10-troubleshooting.md) for common issues
4. Follow [05-deployment.md](./05-deployment.md) for production deployment

Your application should now be fully configured and ready for testing and deployment.