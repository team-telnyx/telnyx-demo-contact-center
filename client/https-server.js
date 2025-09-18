const https = require('https');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle React Router
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// HTTPS configuration
const httpsOptions = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

const PORT = process.env.PORT || 3001;

https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS Client Server running on https://172.16.10.5:${PORT}`);
  console.log('Ready for iPad access!');
});