#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

const checkCallStatus = async (callControlId) => {
  const apiKey = process.env.TELNYX_API;
  
  if (!callControlId) {
    console.error('Please provide call control ID as argument');
    process.exit(1);
  }
  
  try {
    const response = await axios.get(
      `https://api.telnyx.com/v2/calls/${callControlId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Call Status:', {
      call_control_id: response.data.data.call_control_id,
      call_state: response.data.data.call_state,
      is_alive: response.data.data.is_alive,
      from: response.data.data.from,
      to: response.data.data.to,
      start_time: response.data.data.start_time
    });
    
  } catch (error) {
    console.error('❌ Error checking call status:');
    console.error(error.response?.data || error.message);
  }
};

// Get call ID from command line argument
const callId = process.argv[2];
checkCallStatus(callId);