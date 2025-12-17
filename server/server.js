// Import required modules
import 'dotenv/config';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the configured Express app from app.js
import app from './app.js';
import { initWebSocket } from './routes/websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      // Try to resolve paths relative to current directory
      const keyPath = path.resolve(__dirname, 'key.pem');
      const certPath = path.resolve(__dirname, 'cert.pem');

      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        privateKey = fs.readFileSync(keyPath, 'utf8');
        certificate = fs.readFileSync(certPath, 'utf8');
      } else {
        throw new Error('SSL certificates not found');
      }
    }

    const credentials = {
      key: privateKey,
      cert: certificate
    };

    server = https.createServer(credentials, app);
    console.log('Using HTTPS server');
  } catch (error) {
    console.warn(`SSL initialization failed: ${error.message}`);
    console.warn('Falling back to HTTP server');
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
  console.log('Using HTTP server for development');
}

// Initialize WebSocket
initWebSocket(server);

// Serve static files from React build (for production/ngrok access)
const clientBuildPath = path.join(__dirname, '../client/build');
if (fs.existsSync(clientBuildPath)) {
  // Use express.static to serve files from the build directory
  // Note: app.use is already defined in app.js, but we can add more middleware here
  // However, since app is imported, we should probably add this logic inside app.js or 
  // just handle it here if it's specific to the Node server entry point.
  // Since app.js is shared with Workers, it's better to keep static file serving here?
  // Actually, we can attach it to the app instance.

  // We need to import express to use express.static, but app is an express instance.
  // Let's import express just for static middleware if needed, but app.use works on the instance.
  // But wait, express.static is a function on the express module.
  import('express').then(({ default: express }) => {
    app.use(express.static(clientBuildPath));
    console.log('Serving React app from:', clientBuildPath);

    // Serve React app for all non-API routes (SPA support)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  });
}

const PORT = process.env.PORT || 3000;

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} and accessible from any IP address`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
