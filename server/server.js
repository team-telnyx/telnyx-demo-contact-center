// Import required modules and config
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const bodyParser = require('body-parser');
const sequelize = require('./config/database'); // Importing database config
const fs = require('fs');
const https = require('https');
const seedDatabase = require('./seeds/seed');
const { initWebSocket } = require('./routes/websocket');

const privateKey = fs.readFileSync('/etc/letsencrypt/live/osbs.ca/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/osbs.ca/fullchain.pem', 'utf8');

const credentials = {
  key: privateKey,
  cert: certificate
};

const app = express();

const server = https.createServer(credentials, app);
initWebSocket(server);
// Session setup
app.use(
  session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware
app.use(cors());
app.use(bodyParser.json({limit: '20mb'}));

// User Routes
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/voice', voiceRoutes);

const PORT = process.env.PORT || 3000;

// Sync the database and then start the server
const init = async () => {
  try {
    await sequelize.sync({ force: true });
    await seedDatabase(); 
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

init();
