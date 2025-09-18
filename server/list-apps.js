#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

const listCallControlApps = async () => {
  const apiKey = process.env.TELNYX_API;
  
  try {
    const response = await axios.get('https://api.telnyx.com/v2/call_control_applications', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 Your Call Control Applications:');
    console.log('=====================================');
    
    if (response.data.data && response.data.data.length > 0) {
      response.data.data.forEach((app, index) => {
        console.log(`\n${index + 1}. Name: ${app.application_name || 'Unnamed'}`);
        console.log(`   ID: ${app.id}`);
        console.log(`   Webhook URL: ${app.webhook_event_url || 'Not set'}`);
        console.log(`   Active: ${app.active ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('No Call Control Applications found.');
    }
    
  } catch (error) {
    console.error('❌ Error listing Call Control Apps:');
    console.error(error.response?.data || error.message);
  }
};

listCallControlApps();