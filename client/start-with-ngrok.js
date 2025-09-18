#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');

// Read environment variables
require('dotenv').config();

const NGROK_URL = process.env.REACT_APP_API_HOST || 'telnyx.solutions';
const FRONTEND_URL = `https://frontend.${NGROK_URL}`;

console.log(`🚀 Starting React app and opening ${FRONTEND_URL}`);

// Start the React development server
const reactProcess = spawn('npm', ['run', 'start:https'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

// Wait a bit for the server to start, then open the browser
setTimeout(() => {
  console.log(`🌐 Opening browser to ${FRONTEND_URL}`);
  
  // Cross-platform browser opening
  const command = process.platform === 'darwin' ? 'open' : 
                 process.platform === 'win32' ? 'start' : 'xdg-open';
  
  exec(`${command} ${FRONTEND_URL}`, (error) => {
    if (error) {
      console.error(`Error opening browser: ${error}`);
      console.log(`Please manually open: ${FRONTEND_URL}`);
    }
  });
}, 3000); // Wait 3 seconds for server to start

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  reactProcess.kill('SIGINT');
  process.exit(0);
});

reactProcess.on('close', (code) => {
  console.log(`React process exited with code ${code}`);
  process.exit(code);
});