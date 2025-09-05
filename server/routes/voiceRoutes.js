require('dotenv').config();
const express = require('express');
const Voice = require('../models/Voice');
const telnyxService = require('../services/telnyxService');
const router = express.Router();
const axios = require('axios');
const { broadcast, broadcastToAgent, broadcastToAcceptingSocket } = require('./websocket'); 

// Track active calls in memory
const activeCalls = new Map();

// Initialize telnyx client with error handling
let telnyxClient = null;

const initializeTelnyxClient = () => {
  try {
    console.log('Checking TELNYX_API:', process.env.TELNYX_API ? 'Present (length: ' + process.env.TELNYX_API.length + ')' : 'Missing');
    if (process.env.TELNYX_API) {
      console.log('Initializing Telnyx client...');
      const { Telnyx } = require('telnyx');
      telnyxClient = new Telnyx(process.env.TELNYX_API);
      console.log('Telnyx client initialized successfully');
      return true;
    } else {
      console.error('TELNYX_API environment variable not found');
      return false;
    }
  } catch (error) {
    console.error('Telnyx client initialization failed:', error.message);
    return false;
  }
};

// Try to initialize immediately
initializeTelnyxClient();

//================================================ ADD INBOUND CALL TO QUEUE ================================================

router.post('/webhook', express.json(), (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Full webhook body:', JSON.stringify(req.body, null, 2));
  
  const data = req.body.data;
  const direction = data.payload.direction;
  
  // Try to initialize Telnyx client if it's not available
  if (!telnyxClient) {
    console.log('Telnyx client not available, attempting to initialize...');
    initializeTelnyxClient();
  }
  
  // We'll use the call control ID directly with the client
  
  console.log(`Webhook received: ${data.event_type}, direction: ${direction}, call_control_id: ${data.payload.call_control_id}`);
  console.log('Telnyx client status:', telnyxClient ? 'Available' : 'Not Available');
  
  if (data.event_type === 'call.initiated' && direction === 'incoming') {
    console.log('Processing incoming call.initiated event');
    Voice.create({
      queue_uuid: data.payload.call_control_id, // call_control_id of the enqueued call
      telnyx_number: data.payload.to, // 'to' number on inbound call
      destination_number: data.payload.from, // 'from' number on inbound call
      direction: data.payload.direction // set the direction as 'inbound' for now
    }).then(() => {
      console.log('Call saved to database');
    }).catch(error => {
      console.error('Error saving call to database:', error);
    });
    
    // Check for available agents but still answer and enqueue for now
    const User = require('../models/User');
    User.findOne({ 
      where: { 
        status: true // status: true means available
      } 
    }).then(availableAgent => {
      console.log(availableAgent ? `Available agent found: ${availableAgent.sipUsername}` : 'No available agents found');
      
      // Always answer the call first to ensure proper call flow
      if (telnyxClient) {
        console.log('Attempting to answer call...');
        telnyxClient.calls.answer(data.payload.call_control_id)
          .then(() => {
            console.log('Call answered successfully');
          })
          .catch(error => {
            console.error('Error answering call:', error);
          });
      } else {
        console.error('No Telnyx client available - check initialization');
      }
    }).catch(error => {
      console.error('Error finding available agent:', error);
      // Always answer regardless of agent availability
      if (telnyxClient) {
        console.log('Fallback: Attempting to answer call...');
        telnyxClient.calls.answer(data.payload.call_control_id)
          .then(() => {
            console.log('Fallback: Call answered successfully');
          })
          .catch(error => {
            console.error('Fallback: Error answering call:', error);
          });
      } else {
        console.error('Fallback: No Telnyx client available');
      }
    });
  }
  // broadcast the call status to the client
  
  if (data.event_type === 'call.answered') {
    console.log('Call answered event received, attempting to enqueue...');
    if (telnyxClient) {
      telnyxClient.calls.enqueue(data.payload.call_control_id, {queue_name: 'General_Queue'})
        .then(response => {
          console.log('Call successfully enqueued:', response);
        })
        .catch(error => {
          console.error('Error enqueuing call:', error);
        });
    } else {
      console.error('No Telnyx client available for enqueuing');
    }
  }
  if (data.event_type === 'call.enqueued') {
    broadcast('NEW_CALL', data);
    console.log('Call Enqueued:', data.payload.call_control_id);
    if (telnyxClient) {
      telnyxClient.calls.playback_start(data.payload.call_control_id, {audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3'});
    }
    Voice.update({
      queue_name: data.payload.queue // queue name
    },{
      where: { queue_uuid: data.payload.call_control_id }
    }).then(() => {
      console.log('Call saved to database');
    }).catch(error => {
      console.error('Error saving call to database:', error);
    });
  }
  
  // Handle call hangup events
  if (data.event_type === 'call.hangup') {
    console.log('Call hangup event received:', data.payload.call_control_id);
    console.log('Hangup cause:', data.payload.hangup_cause);
    console.log('Hangup source:', data.payload.hangup_source);
    
    // Mark call as ended in our tracking
    const callControlId = data.payload.call_control_id;
    activeCalls.set(callControlId, {
      status: 'ended',
      endTime: new Date(),
      hangupCause: data.payload.hangup_cause,
      hangupSource: data.payload.hangup_source
    });
    
    console.log('Call marked as ended in activeCalls tracking:', callControlId);
    
    // Broadcast hangup event to frontend
    const hangupData = {
      callControlId: data.payload.call_control_id,
      hangupCause: data.payload.hangup_cause,
      hangupSource: data.payload.hangup_source
    };
    
    console.log('Broadcasting CALL_HANGUP:', hangupData);
    broadcast('CALL_HANGUP', hangupData);
    
    // Update database to mark call as completed
    Voice.update({
      status: 'completed',
      end_time: new Date()
    }, {
      where: { queue_uuid: data.payload.call_control_id }
    }).then(() => {
      console.log('Call marked as completed in database');
    }).catch(error => {
      console.error('Error updating call status in database:', error);
    });
  }

  // Handle call.bridged events in main webhook handler
  if (data.event_type === 'call.bridged') {
    const callControlId = data.payload.call_control_id;
    console.log('*** CALL.BRIDGED EVENT RECEIVED ***');
    console.log('Call Control ID:', callControlId);
    console.log('Bridge payload:', JSON.stringify(data.payload, null, 2));
    
    // Mark call as active in our tracking
    activeCalls.set(callControlId, {
      status: 'active',
      startTime: new Date(),
      payload: data.payload
    });
    
    console.log('✅ Call marked as active in activeCalls tracking:', callControlId);
    console.log('✅ Broadcasting CALL_BRIDGED event to frontend');
    
    broadcast('CALL_BRIDGED', {
      callControlId: callControlId,
      payload: data.payload
    });
  }
  
  res.status(200).send('OK');
});
router.get('/queue', async (req, res) => {
  try {
    const response = await axios.get('https://api.telnyx.com/v2/queues/General_Queue/calls', {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`
      }
    });
    res.send(response.data);
  } catch (error) {
    console.error('Error retrieving queue calls:', error);
    
    // Pass through the original status code from Telnyx API
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Queue not available';
      
      if (status === 404) {
        console.log('Queue not found - returning 404 to client');
        res.status(404).json({ message: 'Queue not found', error: message });
      } else {
        res.status(status).json({ message: 'Queue API error', error: message });
      }
    } else {
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  }
});

//================================================ AGENT ACCEPT CALL FROM QUEUE ================================================

// Typical dial and bridge call flow
// First I dial the agent's sip username. I add the call control id of the original queued call as a param to the webhook url
router.post('/accept-call', express.json(), async (req, res) => {
  console.log('Request Body:', req.body);
  const { sipUsername, callControlId, callerId } = req.body;
  
  console.log('*** ACCEPT-CALL DEBUG ***');
  console.log('sipUsername:', sipUsername);
  console.log('callControlId:', callControlId);
  console.log('callerId:', callerId);
  console.log('APP_HOST:', process.env.APP_HOST);
  console.log('APP_PORT:', process.env.APP_PORT);
  
  const webhookUrlWithParam = `https://${process.env.APP_HOST}:${process.env.APP_PORT}/api/voice/outbound?callControlId_Bridge=${encodeURIComponent(callControlId)}`;
  console.log('Constructed webhook URL:', webhookUrlWithParam);

  // Validate required parameters
  if (!sipUsername) {
    console.error('Missing sipUsername parameter');
    return res.status(400).json({ error: 'sipUsername is required' });
  }
  if (!callControlId) {
    console.error('Missing callControlId parameter');
    return res.status(400).json({ error: 'callControlId is required' });
  }
  if (!callerId) {
    console.error('Missing callerId parameter');
    return res.status(400).json({ error: 'callerId is required' });
  }

  try {
    // Use Dial API to call the agent, then bridge (not Transfer API)
    const telnyxRequestBody = {
      connection_id: process.env.TELNYX_CONNECTION_ID || '2397473570750989860',
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: callerId.startsWith('+') ? callerId : `+${callerId}`,
      webhook_url: webhookUrlWithParam,
    };
    
    console.log('Using webhook URL with correct port:', webhookUrlWithParam);
    console.log('Telnyx Dial Request Body:', JSON.stringify(telnyxRequestBody, null, 2));

    // Set up the authorization header with your Telnyx API key
    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      }
    };

    // Use Dial API to create a new call to the agent
    try {
      const telnyxResponse = await axios.post('https://api.telnyx.com/v2/calls', telnyxRequestBody, config);
      console.log('Agent call dialed successfully');
      console.log('New agent call ID:', telnyxResponse.data.data.call_control_id);
    } catch (telnyxError) {
      console.error('Telnyx Dial API Error Details:');
      if (telnyxError.response) {
        console.error('Status:', telnyxError.response.status);
        console.error('Status Text:', telnyxError.response.statusText);
        console.error('Response Data:', JSON.stringify(telnyxError.response.data, null, 2));
        console.error('Response Headers:', telnyxError.response.headers);
      }
      throw telnyxError; // Re-throw to be caught by outer catch
    }
    console.log('Call Dialed');
    Voice.update({
      accept_agent: sipUsername, // Agent SIP username who accepted the call
    }, {
      where: {
        queue_uuid: callControlId // call_control_id of the enqueued call
      }
    }).then(() => {
      console.log('Database record updated with agent who accepted the call');
      res.status(200).send('OK');
    }).catch(error => {
      console.error('Error updating database:', error);
      res.status(500).send('Error updating database');
    });
  } catch (error) {
    console.error('Error during transfer or bridging call:', error);
    
    // Log detailed error information for debugging
    if (error.response) {
      console.error('Telnyx API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
      res.status(error.response.status).json({
        error: 'Telnyx API Error',
        message: error.response.data?.message || error.response.statusText,
        details: error.response.data
      });
    } else if (error.request) {
      console.error('No response received from Telnyx API:', error.request);
      res.status(503).json({ error: 'No response from Telnyx API' });
    } else {
      console.error('Request setup error:', error.message);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
});

// I then bridge the agent's call to the original queued call

router.post('/outbound', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const callControl = req.body.data.payload.call_control_id;
  const callControlId_Bridge = req.query.callControlId_Bridge;
  const hangup_source = req.body.data.payload.hangup_source;
  const clientState = req.body.data.payload.client_state;

  console.log('*** OUTBOUND WEBHOOK DEBUG ***');
  console.log('Event type:', event_type);
  console.log('Full query params:', req.query);
  console.log('Extracted callControlId_Bridge:', callControlId_Bridge);
  console.log('callControl (new call ID):', callControl);
  console.log("OUTBOUND:", req.body.data);
  console.log("BRIDGE ID", callControlId_Bridge);
  if (event_type === 'call.answered') {
    try {
      console.log(`*** ATTEMPTING BRIDGE ***`);
      console.log(`Customer Call ID (callControlId_Bridge): ${callControlId_Bridge}`);
      console.log(`Agent Call ID (callControl): ${callControl}`);
      
      // Add a small delay to ensure both calls are ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check both call statuses first
      let customerCallReady = false;
      let agentCallReady = false;
      
      try {
        const customerCallStatus = await axios.get(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}`, {
          headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
        });
        console.log('*** CUSTOMER CALL STATUS ***');
        console.log('Customer call ID:', callControlId_Bridge);
        console.log('Customer call full response:', JSON.stringify(customerCallStatus.data, null, 2));
        console.log('Customer call state:', customerCallStatus.data.data.state);
        console.log('Customer call is_alive:', customerCallStatus.data.data.is_alive);
        console.log('Customer call direction:', customerCallStatus.data.data.direction);
        // The call status API doesn't return state field, so just check if alive
        customerCallReady = customerCallStatus.data.data.is_alive;
      } catch (statusError) {
        console.error('Could not check customer call status:', statusError.response?.data || statusError.message);
      }
      
      try {
        const agentCallStatus = await axios.get(`https://api.telnyx.com/v2/calls/${callControl}`, {
          headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
        });
        console.log('*** AGENT CALL STATUS ***');
        console.log('Agent call ID:', callControl);
        console.log('Agent call full response:', JSON.stringify(agentCallStatus.data, null, 2));
        console.log('Agent call state:', agentCallStatus.data.data.state);
        console.log('Agent call is_alive:', agentCallStatus.data.data.is_alive);
        console.log('Agent call direction:', agentCallStatus.data.data.direction);
        // The call status API doesn't return state field, so just check if alive
        agentCallReady = agentCallStatus.data.data.is_alive;
      } catch (statusError) {
        console.error('Could not check agent call status:', statusError.response?.data || statusError.message);
      }
      
      console.log(`Bridge readiness check: Customer=${customerCallReady}, Agent=${agentCallReady}`);
      
      if (!customerCallReady) {
        console.error('*** BRIDGE ABORTED: Customer call not ready ***');
        return res.status(400).json({ error: 'Customer call not ready for bridging' });
      }
      
      if (!agentCallReady) {
        console.error('*** BRIDGE ABORTED: Agent call not ready ***');
        return res.status(400).json({ error: 'Agent call not ready for bridging' });
      }
      
      const bridgeResponse = await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/bridge`, {
        call_control_id: callControl
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('*** BRIDGE API SUCCESS ***');
      console.log('Bridge response status:', bridgeResponse.status);
      console.log('Bridge response data:', JSON.stringify(bridgeResponse.data, null, 2));
      
      // Wait for the bridge to take effect and verify
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const verifyCustomerStatus = await axios.get(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}`, {
          headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
        });
        console.log('*** POST-BRIDGE VERIFICATION ***');
        console.log('Customer call is_alive after bridge:', verifyCustomerStatus.data.data.is_alive);
        console.log('Customer call duration after bridge:', verifyCustomerStatus.data.data.call_duration);
        console.log('Customer call full response after bridge:', JSON.stringify(verifyCustomerStatus.data, null, 2));
        
        if (verifyCustomerStatus.data.data.is_alive) {
          console.log('✅ Bridge verification SUCCESS: Customer call is still alive after bridge attempt');
        } else {
          console.log('❌ Bridge verification FAILED: Customer call is no longer alive');
        }
      } catch (verifyError) {
        console.error('Could not verify bridge status:', verifyError.response?.data || verifyError.message);
      }
      Voice.update({
        bridge_uuid: callControl // call_control_id of the outbound call
      }, {
        where: {
          queue_uuid: callControlId_Bridge // call_control_id of the enqueued call
        }
      }).then(async (updateResult) => {
        console.log('Database record updated with bridge call details');
        
        // Get the agent who accepted the call to send targeted notification
        const callData = await Voice.findOne({
          where: { queue_uuid: callControlId_Bridge }
        });
        
        if (callData && callData.accept_agent) {
          console.log('*** ATTEMPTING TARGETED BROADCAST ***');
          console.log('callControlId_Bridge (should match frontend):', callControlId_Bridge);
          console.log('accept_agent:', callData.accept_agent);
          
          // First try to send to the specific browser window that accepted the call
          const targetedSuccess = broadcastToAcceptingSocket(callControlId_Bridge, 'CALL_ACCEPTED', {
            callControlId: callControl,
            bridgeId: callControlId_Bridge,
            customerCallId: callControlId_Bridge,
            agentCallId: callControl,
            from: callData.from_number,
            timestamp: new Date()
          });
          
          if (targetedSuccess) {
            console.log(`Call accepted notification sent to specific browser window that accepted call`);
          } else {
            // Fallback: send to all connections for this agent
            const fallbackSuccess = broadcastToAgent(callData.accept_agent, 'CALL_ACCEPTED', {
              callControlId: callControl,
              bridgeId: callControlId_Bridge,
              customerCallId: callControlId_Bridge,
              agentCallId: callControl,
              from: callData.from_number,
              timestamp: new Date()
            });
            
            console.log(`Call accepted notification sent to all connections for agent ${callData.accept_agent}:`, fallbackSuccess);
          }
        } else {
          console.log('No accept_agent found, broadcasting to all');
          broadcast('CALL_ACCEPTED', {
            callControlId: callControl,
            bridgeId: callControlId_Bridge
          });
        }
        
        res.status(200).send('OK');
      }).catch(error => {
        console.error('Error updating database:', error);
        res.status(500).send('Error updating database');
      });      
    } catch (error) {
      console.error('*** BRIDGE API ERROR ***');
      console.error('Error during call bridging:', error.message);
      
      if (error.response) {
        console.error('Telnyx Bridge API Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: JSON.stringify(error.response.data, null, 2)
        });
      }
      
      res.status(500).send('Internal Server Error');
    }
    
  }
  if (event_type === 'call.hangup' && hangup_source === "callee") {
    console.log('*** AGENT HANGUP DETECTED ***');
    console.log('Agent call hung up, hanging up customer call and broadcasting to frontend');
    
    try {
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/hangup`, {}, {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API}`
          }
        });
      console.log('Customer call hung up after agent hangup');
      
      // Broadcast hangup event to frontend with agent call ID
      // This ensures the modal closes when agent hangs up
      const agentHangupData = {
        callControlId: callControl,
        hangupCause: req.body.data.payload.hangup_cause,
        hangupSource: 'agent'
      };
      
      console.log('Broadcasting CALL_HANGUP for agent-initiated hangup:', agentHangupData);
      broadcast('CALL_HANGUP', agentHangupData);
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error hanging up call after agent hangup:', error);
      res.status(500).send('Internal Server Error');
    }
   }
 });

//=================================================== AGENT TRANSFER ===================================================

// Transfer call using Dial + Bridge pattern
router.post('/transfer', express.json(), async (req, res) => {
  const { sipUsername, callerId, callControlId, outboundCCID } = req.body;
  
  console.log('Transfer request:', { sipUsername, callerId, callControlId, outboundCCID });

  try {
    // Determine which call ID to use for the transfer (customer call)
    let customerCallId;
    let currentAgentCallId;
    
    if (outboundCCID) {
      // For outbound calls
      customerCallId = outboundCCID;
      currentAgentCallId = callControlId;
    } else if (callControlId) {
      // For inbound calls, find the original customer call in the database
      const callData = await Voice.findOne({
        where: { bridge_uuid: callControlId }
      });
      if (callData && callData.queue_uuid) {
        customerCallId = callData.queue_uuid;
        currentAgentCallId = callControlId;
      } else {
        return res.status(404).json({ error: 'Call data not found for transfer' });
      }
    } else {
      return res.status(400).json({ error: 'No valid call ID provided for transfer' });
    }

    console.log('Customer call ID:', customerCallId, 'Current agent call:', currentAgentCallId);
    console.log('Transferring to agent:', sipUsername);

    // Step 1: Dial the new agent
    const dialResponse = await axios.post('https://api.telnyx.com/v2/calls', {
      connection_id: process.env.TELNYX_CONNECTION_ID || '2397473570750989860',
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: callerId.number,
      webhook_url: `https://${process.env.APP_HOST}:${process.env.APP_PORT}/api/voice/transfer-dial-webhook`,
      client_state: Buffer.from(JSON.stringify({
        action: 'transfer_dial',
        customerCallId: customerCallId,
        currentAgentCallId: currentAgentCallId,
        transferToAgent: sipUsername
      })).toString('base64')
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      }
    });

    const newAgentCallId = dialResponse.data.data.call_control_id;
    console.log('Dialed new agent, call ID:', newAgentCallId);

    // Update database to track the transfer
    await Voice.update({
      transfer_agent_call_id: newAgentCallId,
      transfer_status: 'dialing',
      transfer_to_agent: sipUsername
    }, {
      where: { queue_uuid: customerCallId }
    });
    
    // Broadcast transfer initiated event
    broadcast('TRANSFER_INITIATED', {
      customerCallId: customerCallId,
      currentAgentCallId: currentAgentCallId,
      newAgentCallId: newAgentCallId,
      transferToAgent: sipUsername
    });
    
    res.json({ 
      success: true, 
      newAgentCallId: newAgentCallId,
      status: 'dialing'
    });
    
  } catch (error) {
    console.error('Error initiating transfer:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Transfer failed', 
      details: error.response?.data || error.message 
    });
  }
});


// Transfer dial webhook - handles when new agent is dialed
router.post('/transfer-dial-webhook', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const payload = req.body.data.payload;
  const newAgentCallId = payload.call_control_id;
  
  console.log('Transfer dial webhook event:', event_type, 'for new agent call:', newAgentCallId);
  
  try {
    // Parse the client state to get transfer details
    const clientState = Buffer.from(payload.client_state || '', 'base64').toString();
    const transferData = JSON.parse(clientState);
    const { customerCallId, currentAgentCallId, transferToAgent } = transferData;
    
    if (event_type === 'call.answered') {
      console.log('New agent answered - bridging calls');
      
      // Step 2: Bridge the customer call with the new agent call
      const bridgeResponse = await axios.post(`https://api.telnyx.com/v2/calls/${customerCallId}/actions/bridge`, {
        call_control_id: newAgentCallId
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Bridge successful:', bridgeResponse.data);
      
      // Step 3: Hang up the current agent call
      try {
        await axios.post(`https://api.telnyx.com/v2/calls/${currentAgentCallId}/actions/hangup`, {}, {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('Current agent call hung up');
      } catch (hangupError) {
        console.error('Error hanging up current agent:', hangupError.message);
      }
      
      // Update database to reflect successful transfer
      await Voice.update({
        bridge_uuid: newAgentCallId,
        transfer_status: 'completed',
        accept_agent: transferToAgent
      }, {
        where: { queue_uuid: customerCallId }
      });
      
      // Broadcast successful transfer
      broadcast('TRANSFER_COMPLETED', {
        customerCallId: customerCallId,
        newAgentCallId: newAgentCallId,
        transferToAgent: transferToAgent,
        status: 'success'
      });
      
    } else if (event_type === 'call.hangup') {
      const hangupCause = payload.hangup_cause;
      console.log('Transfer failed - new agent did not answer:', hangupCause);
      
      // Update database to reflect failed transfer
      await Voice.update({
        transfer_status: 'failed',
        transfer_agent_call_id: null
      }, {
        where: { queue_uuid: customerCallId }
      });
      
      // Broadcast transfer failure
      broadcast('TRANSFER_FAILED', {
        customerCallId: customerCallId,
        transferToAgent: transferToAgent,
        reason: hangupCause,
        status: 'failed'
      });
      
      console.log('Transfer marked as failed in database');
    }
    
  } catch (error) {
    console.error('Error handling transfer dial webhook:', error);
  }
  
  res.status(200).send('OK');
});

// Legacy transfer webhook handler (keeping for compatibility)
router.post('/transfer-webhook', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const payload = req.body.data.payload;
  const callControlId = payload.call_control_id;
  
  console.log('Transfer webhook event:', event_type, 'for call:', callControlId);
  
  try {
    if (event_type === 'call.answered') {
      console.log('Transfer answered - call successfully transferred to new agent');
      
      // Update database to reflect the transfer
      await Voice.update(
        { 
          bridge_uuid: callControlId,
          transfer_status: 'completed',
          updated_at: new Date()
        },
        { where: { queue_uuid: callControlId } }
      );
      
      // Broadcast successful transfer
      broadcast('TRANSFER_COMPLETED', {
        callControlId: callControlId,
        status: 'success'
      });
      
    } else if (event_type === 'call.hangup') {
      const hangupCause = payload.hangup_cause;
      const sipCode = payload.sip_hangup_cause;
      
      // Check if transfer failed due to agent being unavailable
      if (hangupCause === 'user_busy' || sipCode === '486' || sipCode === '480') {
        console.log('Transfer failed - agent unavailable, attempting to re-queue');
        
        try {
          // Inform caller that agent is unavailable
          await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
            payload: 'The agent is currently unavailable. Please hold while we transfer you to another agent.',
            voice: 'female',
            language: 'en-US'
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.TELNYX_API}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Re-queue the call for another agent
          setTimeout(async () => {
            try {
              await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/enqueue`, {
                queue_name: 'General_Queue'
              }, {
                headers: {
                  'Authorization': `Bearer ${process.env.TELNYX_API}`,
                  'Content-Type': 'application/json'
                }
              });
              
              console.log('Call re-queued after failed transfer');
              
              broadcast('TRANSFER_FAILED', {
                callControlId: callControlId,
                reason: 'agent_unavailable',
                action: 're_queued'
              });
            } catch (requeueError) {
              console.error('Error re-queueing call:', requeueError);
            }
          }, 3000); // Wait 3 seconds after speaking
          
        } catch (speakError) {
          console.error('Error playing unavailable message:', speakError);
        }
      } else {
        console.log('Transfer call ended:', hangupCause);
        broadcast('TRANSFER_ENDED', {
          callControlId: callControlId,
          hangupCause: hangupCause
        });
      }
    }
    
  } catch (error) {
    console.error('Error handling transfer webhook:', error);
  }
  
  res.status(200).send('OK');
});

// Warm transfer functionality removed

// Legacy conference functions removed - replaced with supervisor role feature
// Supervisor role provides better call quality and simpler implementation
//============= DEBUG ENDPOINTS ===================

// Debug endpoint to check WebSocket connections and events
router.get('/debug-state', (req, res) => {
  const { getConnectedAgents } = require('./websocket');
  const connectedAgents = getConnectedAgents();
  
  res.json({
    connectedAgents: connectedAgents,
    activeCallsCount: activeCalls.size,
    activeCalls: Array.from(activeCalls.entries()).map(([id, data]) => ({
      callControlId: id,
      status: data.status,
      startTime: data.startTime,
      endTime: data.endTime
    }))
  });
});

//============= HANG UP CALL FUNCTIONALITY ===================

// Endpoint to hang up an active call
router.post('/hangup-call', express.json(), async (req, res) => {
  const { callControlId } = req.body;
  
  console.log('*** HANGUP CALL REQUEST ***');
  console.log('Call Control ID:', callControlId);
  
  if (!callControlId) {
    console.error('Missing callControlId parameter');
    return res.status(400).json({ error: 'callControlId is required' });
  }
  
  try {
    // Use Telnyx API to hang up the call
    const hangupResponse = await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`, {}, {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('*** HANGUP API SUCCESS ***');
    console.log('Hangup response status:', hangupResponse.status);
    console.log('Hangup response data:', JSON.stringify(hangupResponse.data, null, 2));
    
    // Update database to mark call as completed
    Voice.update({
      status: 'completed',
      end_time: new Date()
    }, {
      where: { 
        $or: [
          { queue_uuid: callControlId },
          { bridge_uuid: callControlId }
        ]
      }
    }).then(() => {
      console.log('Call marked as completed in database');
    }).catch(error => {
      console.error('Error updating call status in database:', error);
    });
    
    res.json({ success: true, message: 'Call hung up successfully' });
    
  } catch (error) {
    console.error('*** HANGUP API ERROR ***');
    console.error('Error hanging up call:', error.message);
    
    if (error.response) {
      console.error('Telnyx Hangup API Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: JSON.stringify(error.response.data, null, 2)
      });
      
      res.status(error.response.status).json({
        error: 'Telnyx API Error',
        message: error.response.data?.message || error.response.statusText,
        details: error.response.data
      });
    } else if (error.request) {
      console.error('No response received from Telnyx API:', error.request);
      res.status(503).json({ error: 'No response from Telnyx API' });
    } else {
      console.error('Request setup error:', error.message);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
});

//============= PARK OUTBOUND CALLS FUNCTIONALITY ===================
// This is when the webrtc user dials an outbound number from the PhonePage component and the call is parked via /outbound-webrtc
router.post('/outbound-webrtc', express.json(), async (req, res) => {
  const fromNumber = req.body.data.payload.from;
  const toNumber = req.body.data.payload.to;
  const callControlId = req.body.data.payload.call_control_id;
  const event_type = req.body.data.event_type;
  const direction = req.body.data.payload.direction;
  const state = req.body.data.payload.state;
  const clientState = req.body.data.payload.client_state;
  const data = req.body.data;
  // base64 encode the client state
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TELNYX_API}`
    }
  };

  try {
    // Answer the call using the Telnyx API
    if (event_type === 'call.initiated' && direction === 'outgoing' && state === 'parked') {
      broadcast('WebRTC_OutboundCCID', req.body.data.payload.call_control_id);
      console.log("WEBRTC OUTBOUND CCID", req.body.data.payload.call_control_id)
        Voice.create({
          telnyx_number: data.payload.from, // 'to' number on inbound call
          destination_number: data.payload.to, // 'from' number on inbound call
          direction: data.payload.direction, // set the direction as 'inbound' for now
          queue_uuid: data.payload.call_control_id, // call_control_id of the webrtc call leg
        }).then(() => {
          console.log('Call saved to database');
        }).catch(error => {
          console.error('Error saving call to database:', error);
        });
      const answerData = {
        client_state: Buffer.from(callControlId).toString('base64'),
      };
      const response = await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, answerData, config);
      console.log('WebRTC Call Answered');
    }
    if (event_type === 'call.answered' && clientState === Buffer.from(callControlId).toString('base64')) {
      const transferId = req.body.data.payload.call_control_id;
      console.log("WEBRTC ANSWER OUTBOUND CCID", transferId)
      console.log(`Dialing outbound call: ${fromNumber} -> ${toNumber}`);
      
      // Put the WebRTC call in a waiting state with ring back tone
      try {
        await axios.post(`https://api.telnyx.com/v2/calls/${transferId}/actions/playback_start`, {
          audio_url: 'https://audio.telnyx.com/ring_back_tone.wav',
          loop: true,
          client_state: Buffer.from(transferId).toString('base64'),
        }, config);
        console.log('Started ring back tone for WebRTC call');
      } catch (holdError) {
        console.error('Error starting ring back tone:', holdError);
        // Try simpler approach - just speak to the user
        try {
          await axios.post(`https://api.telnyx.com/v2/calls/${transferId}/actions/speak`, {
            payload: 'Please hold while we connect your call',
            voice: 'female',
            language: 'en-US',
            client_state: Buffer.from(transferId).toString('base64'),
          }, config);
          console.log('Started hold message for WebRTC call');
        } catch (speakError) {
          console.error('Error starting hold message:', speakError);
        }
      }
      
      const telnyxRequestBody = {
        connection_id: process.env.TELNYX_CONNECTION_ID || '2397473570750989860',
        to: toNumber,
        from: fromNumber,
        client_state: Buffer.from(transferId).toString('base64'),
        webhook_url: `https://${process.env.APP_HOST}/api/voice/outbound-webrtc-bridge?callControlId_Bridge=${encodeURIComponent(transferId)}`,
      };
      
      console.log('Outbound call request body:', JSON.stringify(telnyxRequestBody, null, 2));
  
      // Make the HTTP POST request to Telnyx API
      const telnyxResponse = await axios.post('https://api.telnyx.com/v2/calls', telnyxRequestBody, config);
      console.log('Outbound call response:', telnyxResponse.data)
      console.log('Outbound Call Dialed');
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    if (error.response) {
      // Log more detailed response error
      console.error('Error response data:', error.response.data);
    }
  }
  // Always respond with 200 OK
  res.status(200).send('OK');
});

//============= PARK OUTBOUND CALLS FUNCTIONALITY - BRIDGE LEG ===================
// This is when the webrtc user dials an outbound number from the PhonePage component and the call is parked via /outbound-webrtc. This is the second leg to the PSTN
router.post('/outbound-webrtc-bridge', express.json(), async (req, res) => {
  console.log('=== OUTBOUND WEBRTC BRIDGE WEBHOOK RECEIVED ===');
  console.log('Full webhook body:', JSON.stringify(req.body, null, 2));
  console.log('Query parameters:', req.query);
  
  const event_type = req.body.data.event_type;
  const direction = req.body.data.payload.direction;
  const state = req.body.data.payload.state;
  const callControlId_Bridge = req.query.callControlId_Bridge;
  const callControl = req.body.data.payload.call_control_id;
  const hangup_source = req.body.data.payload.hangup_source;
  const clientState = req.body.data.payload.client_state;
  
  console.log(`Event: ${event_type}, Direction: ${direction}, State: ${state}`);
  console.log(`WebRTC Call ID: ${callControlId_Bridge}, PSTN Call ID: ${callControl}`);

  if (event_type === 'call.answered') {
    broadcast('OutboundCCID', req.body.data.payload.call_control_id);
    try {
      console.log(`PSTN leg answered, stopping ring back tone and bridging: ${callControlId_Bridge} -> ${callControl}`);
      
      // Stop the ring back tone on the WebRTC leg before bridging
      try {
        await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/playback_stop`, {}, {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API}`
          }
        });
        console.log('Stopped ring back tone on WebRTC call');
      } catch (stopError) {
        console.error('Error stopping ring back tone:', stopError);
        // Continue with bridging even if stopping playback fails
      }
      
      console.log(`Attempting to bridge calls: ${callControlId_Bridge} -> ${callControl}`);
      const bridgeResponse = await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/bridge`, {
        call_control_id: callControl
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API}`
        }
      });
      
      console.log('Bridge API response:', bridgeResponse.data);
      
      Voice.update({
        bridge_uuid: callControl // call_control_id of the outbound call
      }, {
        where: {
          queue_uuid: callControlId_Bridge // call_control_id of the enqueued call
        }
      }).then(() => {
        console.log('Database record updated with bridge call details');
      }).catch(error => {
        console.error('Error updating database:', error);
      });      
    } catch (error) {
      console.error('Error during call bridging:', error);
      if (error.response) {
        console.error('Bridge API error details:', error.response.data);
      }
    }
  }
  
  // Handle call.bridged events separately
  if (event_type === 'call.bridged') {
    console.log('Call successfully bridged:', callControl);
    
    // Mark call as active in our tracking
    activeCalls.set(callControl, {
      status: 'active',
      startTime: new Date(),
      bridgeId: callControlId_Bridge
    });
    
    console.log('Call marked as active in activeCalls tracking:', callControl);
    
    broadcast('CALL_BRIDGED', {
      callControlId: callControl,
      bridgeId: callControlId_Bridge
    });
  }
  
  // Handle failed PSTN calls
  if (event_type === 'call.hangup' && hangup_source === "caller" && callControlId_Bridge) {
    console.log('PSTN call failed or was rejected, notifying WebRTC user');
    try {
      // Stop any playback first
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/playback_stop`, {}, {
        headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
      }).catch(() => {}); // Ignore errors
      
      // Inform the user and hang up
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/speak`, {
        payload: 'The call could not be connected. Please try again later.',
        voice: 'female',
        language: 'en-US',
      }, {
        headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
      });
      
      // Hang up after a short delay
      setTimeout(async () => {
        try {
          await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/hangup`, {}, {
            headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
          });
        } catch (hangupError) {
          console.error('Error hanging up WebRTC call after PSTN failure:', hangupError);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error handling PSTN call failure:', error);
    }
  }
  console.log("CALL CONTROL CLIENT STATE", clientState);
  if (event_type === 'call.hangup' && hangup_source === "callee" && clientState !== Buffer.from("Transfer").toString('base64')) {
    console.log("WEBRTC HANGUP")
    try {
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/hangup`, {}, {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`
      }
    });
    broadcast('OutboundCCID', null);
    console.log('Call Hung Up');
  } catch (error) {
    console.error('Error hanging up call outbound:', error);
  }
  }
  
  // Always respond with 200 OK
  res.status(200).send('OK');
});

// API endpoint to check call status (for frontend polling)
router.get('/call-status/:callControlId', (req, res) => {
  const { callControlId } = req.params;
  
  console.log('Call status check requested for:', callControlId);
  
  const callStatus = activeCalls.get(callControlId);
  
  if (!callStatus) {
    console.log('No call found in activeCalls for:', callControlId);
    return res.json({
      status: 'unknown',
      found: false
    });
  }
  
  console.log('Call status found:', callStatus);
  
  res.json({
    status: callStatus.status,
    found: true,
    ...callStatus
  });
});

// API endpoint to get all active calls (for debugging)
router.get('/active-calls', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([id, data]) => ({
    callControlId: id,
    ...data
  }));
  
  console.log('Active calls requested:', calls.length, 'calls found');
  
  res.json({
    count: calls.length,
    calls: calls
  });
});

// API endpoint to get all calls that ended recently (for frontend polling)
router.get('/recent-ended-calls', (req, res) => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
  
  console.log('DEBUG: All active calls currently tracked:');
  activeCalls.forEach((data, id) => {
    console.log(`  ${id}: status=${data.status}, endTime=${data.endTime}, startTime=${data.startTime}`);
  });
  
  const recentEndedCalls = Array.from(activeCalls.entries())
    .filter(([id, data]) => {
      const isEnded = data.status === 'ended';
      const hasEndTime = data.endTime;
      const isRecent = hasEndTime && new Date(data.endTime) > fiveMinutesAgo;
      
      console.log(`  Filter check for ${id}: isEnded=${isEnded}, hasEndTime=${hasEndTime}, isRecent=${isRecent}`);
      
      return isEnded && hasEndTime && isRecent;
    })
    .map(([id, data]) => ({
      callControlId: id,
      ...data
    }));
  
  console.log('Recent ended calls requested:', recentEndedCalls.length, 'calls found');
  console.log('Ended calls:', recentEndedCalls);
  
  res.json({
    count: recentEndedCalls.length,
    endedCalls: recentEndedCalls
  });
});

module.exports = router