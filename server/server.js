// Import required modules and config
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const telnyxRoutes = require('./routes/telnyxRoutes');
const bodyParser = require('body-parser');
const sequelize = require('./config/database'); // Importing database config
const fs = require('fs');
const https = require('https');
const seedDatabase = require('./seeds/seed');
const { initWebSocket } = require('./routes/websocket');
// Ensure models are registered before sync
require('./models/CallSession');
require('./models/CallLeg');

const app = express();

let server;

// Use HTTPS in production or development (with self-signed certs for dev)
const useHTTPS = process.env.NODE_ENV === 'production' || process.env.ENABLE_HTTPS === 'true';

if (useHTTPS) {
  try {
    let privateKey, certificate;
    
    if (process.env.NODE_ENV === 'production' && process.env.SSL_PRIVATE_KEY_PATH && process.env.SSL_CERTIFICATE_PATH) {
      // Production SSL certificates
      privateKey = fs.readFileSync(process.env.SSL_PRIVATE_KEY_PATH, 'utf8');
      certificate = fs.readFileSync(process.env.SSL_CERTIFICATE_PATH, 'utf8');
    } else {
      // Development self-signed certificates
      privateKey = fs.readFileSync('./key.pem', 'utf8');
      certificate = fs.readFileSync('./cert.pem', 'utf8');
    }
    
    const credentials = {
      key: privateKey,
      cert: certificate
    };
    
    server = https.createServer(credentials, app);
    console.log('Using HTTPS server');
  } catch (error) {
    console.warn('SSL certificates not found, falling back to HTTP server');
    const http = require('http');
    server = http.createServer(app);
  }
} else {
  const http = require('http');
  server = http.createServer(app);
  console.log('Using HTTP server for development');
}
initWebSocket(server);
// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-session-secret-for-dev',
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware
app.use(cors());
app.use(bodyParser.json({limit: '20mb'}));

// User Routes
// Serve static files from React build (for ngrok access)
const clientBuildPath = path.join(__dirname, '../client/build');
if (require('fs').existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  console.log('Serving React app from:', clientBuildPath);
}

app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/telnyx', telnyxRoutes);

// Serve React app for all non-API routes (SPA support)
if (require('fs').existsSync(clientBuildPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;

// Sync the database and then start the server
const init = async () => {
  try {
    await sequelize.sync({ force: process.env.NODE_ENV === 'development' });
    await seedDatabase(); 
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT} and accessible from any IP address`);
    });
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

init();
