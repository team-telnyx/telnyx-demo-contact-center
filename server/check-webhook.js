#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

const checkCallControlApp = async () => {
  const connectionId = process.env.TELNYX_CONNECTION_ID || '1446442091122001881';
  const apiKey = process.env.TELNYX_API;
  
  if (!apiKey || apiKey.includes('example') || apiKey.includes('your-api-key')) {
    console.error('❌ Please set your actual TELNYX_API key in the .env file');
    process.exit(1);
  }
  
  try {
    const response = await axios.get(
      `https://api.telnyx.com/v2/call_control_applications/${connectionId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Current Call Control App configuration:');
    console.log('Webhook URL:', response.data.data.webhook_event_url);
    console.log('Failover URL:', response.data.data.webhook_event_failover_url);
    console.log('Connection ID:', connectionId);
    
  } catch (error) {
    console.error('❌ Error checking Call Control App:');
    console.error(error.response?.data || error.message);
  }
};

checkCallControlApp();