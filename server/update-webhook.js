#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

const updateCallControlApp = async (ngrokUrl) => {
  const connectionId = process.env.TELNYX_CONNECTION_ID || '1446442091122001881';
  const apiKey = process.env.TELNYX_API;
  
  if (!ngrokUrl) {
    console.error('Please provide ngrok URL as argument: node update-webhook.js https://your-url.ngrok.io');
    process.exit(1);
  }
  
  try {
    const response = await axios.patch(
      `https://api.telnyx.com/v2/call_control_applications/${connectionId}`,
      {
        webhook_event_url: `${ngrokUrl}/api/voice/webhook`,
        webhook_event_failover_url: `${ngrokUrl}/api/voice/webhook`
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Call Control App updated successfully!');
    console.log('Webhook URL:', `${ngrokUrl}/api/voice/webhook`);
    console.log('Connection ID:', connectionId);
    
  } catch (error) {
    console.error('❌ Error updating Call Control App:');
    console.error(error.response?.data || error.message);
  }
};

// Get ngrok URL from command line argument
const ngrokUrl = process.argv[2];
updateCallControlApp(ngrokUrl);