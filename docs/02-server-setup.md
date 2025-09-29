# Server Setup Guide

This guide will walk you through setting up the Node.js Express backend server for the WebRTC Contact Center application.

## Overview

The server provides:
- REST API endpoints for user management, calls, and messaging
- WebSocket connections for real-time communication
- SQLite database for data persistence
- Telnyx integration for WebRTC calling
- JWT-based authentication

## Directory Structure

```
server/
├── package.json          # Server dependencies and scripts
├── server.js            # Main server entry point
├── database.sqlite      # SQLite database file
├── routes/              # API route handlers
│   ├── userRoutes.js    # User management endpoints
│   ├── voiceRoutes.js   # Voice/call endpoints
│   └── websocket.js     # WebSocket event handlers
├── cert.pem            # SSL certificate
├── key.pem             # SSL private key
└── node_modules/       # Dependencies (created after npm install)
```

## Installation Steps

### 1. Navigate to Server Directory
```bash
cd SE-webrtc-contact_center_v2/server
```

### 2. Install Dependencies
```bash
npm install
```

This will install the following key dependencies:
- **express**: Web framework
- **socket.io**: WebSocket communication
- **sqlite3**: Database driver
- **jsonwebtoken**: JWT authentication
- **bcrypt**: Password hashing
- **cors**: Cross-origin resource sharing
- **helmet**: Security middleware
- **compression**: Response compression
- **rate-limiter-flexible**: API rate limiting

### 3. Verify Package.json
The server's `package.json` should contain these key scripts:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "migrate": "node scripts/migrate.js"
  }
}
```

### 4. SSL Certificate Setup
Place your SSL certificates in the server directory:
```bash
# Copy certificates to server directory
cp ../cert.pem ./
cp ../key.pem ./

# Verify certificates exist
ls -la *.pem
```

### 5. Database Initialization
The server uses SQLite with the following tables:
- `users`: User accounts and authentication
- `calls`: Call history and metadata
- `messages`: SMS/messaging data

```bash
# Database file should exist at:
ls -la database.sqlite

# If missing, it will be created on first run
```

## Configuration

### Environment Variables
Create or verify these environment variables (typically set in deployment):

```bash
# Port configuration (optional - defaults exist)
export PORT=3002

# Telnyx API configuration (required for calls)
export TELNYX_API_KEY="your_telnyx_api_key"
export TELNYX_PHONE_NUMBER="your_telnyx_phone_number"

# JWT secret (required for authentication)
export JWT_SECRET="your_jwt_secret_key"

# Database path (optional - defaults to ./database.sqlite)
export DB_PATH="./database.sqlite"
```

### Server Configuration
Key configuration in `server.js`:

```javascript
// Port configuration
const PORT = process.env.PORT || 3002;

// HTTPS configuration
const httpsOptions = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

// CORS configuration
const corsOptions = {
  origin: ["https://localhost:3001", "https://telnyx.solutions"],
  credentials: true
};
```

## Starting the Server

### Development Mode
```bash
# Start with auto-reload (if nodemon is installed)
npm run dev

# Or start normally
npm start
```

### Production Mode
```bash
# Start server
node server.js

# Or with PM2 (recommended for production)
npm install -g pm2
pm2 start server.js --name "contact-center-api"
pm2 save
pm2 startup
```

### Verify Server is Running
```bash
# Check if server is listening
curl -k https://localhost:3002/api/users/agents

# Expected response: JSON array of agents
# If authentication is required: {"error": "Unauthorized"}
```

## API Endpoints

### Authentication
```
POST   /api/users/login     # User login
POST   /api/users/register  # User registration
POST   /api/users/logout    # User logout
```

### User Management
```
GET    /api/users/agents    # Get all agents
PUT    /api/users/profile   # Update user profile
GET    /api/users/profile   # Get user profile
```

### Voice/Calls
```
GET    /api/voice/queue     # Get call queue
POST   /api/voice/accept-call    # Accept a call
POST   /api/voice/decline-call   # Decline a call
POST   /api/voice/hangup-call    # Hang up a call
```

### Messaging
```
GET    /api/conversations           # Get conversations
GET    /api/conversations/unassigned # Get unassigned conversations
POST   /api/conversations/assign    # Assign conversation
```

### Telnyx Integration
```
GET    /api/telnyx/phone-numbers   # Get phone numbers
POST   /api/telnyx/calls          # Make outbound call
```

## WebSocket Events

The server handles these WebSocket events:

### Incoming Events (from client)
- `accept_call`: Accept an incoming call
- `decline_call`: Decline an incoming call
- `hangup_call`: Hang up active call

### Outgoing Events (to client)
- `NEW_CALL`: New incoming call
- `CALL_ACCEPTED`: Call was accepted
- `CALL_HANGUP`: Call was hung up
- `CALL_UPDATE`: Call status update
- `NEW_MESSAGE`: New message received
- `AGENT_STATUS_UPDATED`: Agent status changed

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  firstName TEXT,
  lastName TEXT,
  role TEXT DEFAULT 'agent',
  status BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Calls Table
```sql
CREATE TABLE calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_control_id TEXT,
  from_number TEXT,
  to_number TEXT,
  status TEXT,
  duration INTEGER,
  agent_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  FOREIGN KEY (agent_id) REFERENCES users(id)
);
```

## Testing the Server

### Health Check
```bash
# Test server health
curl -k https://localhost:3002/api/health

# Expected response: {"status": "healthy", "timestamp": "..."}
```

### Authentication Test
```bash
# Test user registration
curl -k -X POST https://localhost:3002/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"testpass123"}'

# Test login
curl -k -X POST https://localhost:3002/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

### WebSocket Test
```javascript
// Test WebSocket connection (from browser console)
const socket = io('https://localhost:3002');
socket.on('connect', () => console.log('Connected to server'));
socket.on('disconnect', () => console.log('Disconnected from server'));
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3002
lsof -ti:3002

# Kill the process
kill -9 $(lsof -ti:3002)

# Or use a different port
PORT=3003 npm start
```

#### SSL Certificate Errors
```bash
# Verify certificates are readable
cat cert.pem | openssl x509 -text -noout

# Regenerate if needed
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

#### Database Connection Issues
```bash
# Check database file permissions
ls -la database.sqlite

# Verify SQLite installation
sqlite3 --version

# Test database connection
sqlite3 database.sqlite "SELECT * FROM users LIMIT 1;"
```

#### Memory Issues
```bash
# Monitor memory usage
top -p $(pgrep node)

# Increase Node.js memory limit
node --max-old-space-size=4096 server.js
```

### Performance Optimization

#### Enable Compression
```javascript
// Already enabled in server.js
app.use(compression());
```

#### Add Request Rate Limiting
```javascript
// Already configured in server.js
const { RateLimiterMemory } = require('rate-limiter-flexible');
```

#### Database Optimization
```sql
-- Add indexes for better query performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_calls_agent_id ON calls(agent_id);
CREATE INDEX idx_calls_created_at ON calls(created_at);
```

## Security Considerations

### Environment Variables
Never commit sensitive data to version control:
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo "*.key" >> .gitignore
echo "database.sqlite" >> .gitignore
```

### HTTPS Only
- Always use HTTPS in production
- Redirect HTTP to HTTPS
- Use proper SSL certificates (not self-signed)

### Database Security
- Use parameterized queries (already implemented)
- Regular database backups
- Limit database access permissions

## Monitoring

### Basic Logging
The server logs important events to console. For production, consider:
```bash
# Redirect logs to file
node server.js > server.log 2>&1

# Or use PM2 logging
pm2 logs contact-center-api
```

### Health Monitoring
```bash
# Simple health check script
while true; do
  curl -k -s https://localhost:3002/api/health > /dev/null
  echo "$(date): Server health check - $?"
  sleep 60
done
```

## Next Steps

Once the server is running successfully:
1. Continue to [03-client-setup.md](./03-client-setup.md) to set up the frontend
2. Complete configuration in [04-configuration.md](./04-configuration.md)
3. Test the full system integration

The server should now be accessible at `https://localhost:3002` and ready to serve API requests and WebSocket connections.