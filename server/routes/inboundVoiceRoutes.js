require('dotenv').config();
const express = require('express');
const Voice = require('../models/Voice');
const { Op } = require('sequelize');
const router = express.Router();
const CallSession = require('../models/CallSession');
const CallLeg = require('../models/CallLeg');
const axios = require('axios');
const { broadcast, broadcastToAgentPrimary, getConnectedAgents } = require('./websocket');
const callEventEmitter = require('../utils/eventEmitter');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getHoldMusicBase64 } = require('../utils/audioUtils');

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

//================================================ HELPER FUNCTIONS ================================================
/**
 * Helper function to enqueue a call with optional callback support
 * @param {string} callControlId - The call control ID
 * @param {string} from - Caller number
 * @param {string} to - Called number
 * @param {boolean} enableCallback - Whether to enable queue callback
 */
async function enqueueCall(callControlId, from, to, enableCallback = false) {
  console.log('📞 Enqueuing call:', { callControlId, from, to, enableCallback });

  // Prepare enqueue request
  const enqueuePayload = {
    queue_name: 'General_Queue',
    client_state: Buffer.from(JSON.stringify({
      original_call_id: callControlId,
      enqueued_at: new Date().toISOString(),
      from: from,
      to: to
    })).toString('base64')
  };

  // Add queue callback configuration if enabled
  if (enableCallback) {
    const callbackPort = process.env.APP_PORT === '443' ? '' : `:${process.env.APP_PORT}`;
    enqueuePayload.queue_callback_url = `https://${process.env.APP_HOST}${callbackPort}/api/voice/queue-callback`;
    enqueuePayload.callback_timeout_secs = parseInt(process.env.QUEUE_CALLBACK_TIMEOUT_SECS || '300');
    enqueuePayload.max_wait_time_secs = parseInt(process.env.QUEUE_MAX_WAIT_TIME_SECS || '600');

    console.log('🔔 Queue callback enabled:');
    console.log('   - Callback URL:', enqueuePayload.queue_callback_url);
    console.log('   - Callback timeout:', enqueuePayload.callback_timeout_secs, 'seconds');
    console.log('   - Max wait time:', enqueuePayload.max_wait_time_secs, 'seconds');
  }

  // Enqueue the call
  await axios.post(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/enqueue`,
    enqueuePayload,
    {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('✅ Call successfully enqueued', enableCallback ? 'with callback support' : '');

  // Update call state
  activeCalls.set(callControlId, {
    status: 'enqueued',
    timestamp: new Date(),
    callback_enabled: enableCallback
  });

  // Start hold music playback
  console.log('🎵 Starting hold music playback...');
  try {
    const base64Audio = getHoldMusicBase64();

    if (!base64Audio) {
      console.error('❌ Failed to load hold music - skipping playback');
    } else {
      console.log('📊 Base64 MP3 size:', Math.round(base64Audio.length / 1024), 'KB');

      await axios.post(
        `https://api.telnyx.com/v2/calls/${callControlId}/actions/playback_start`,
        {
          playback_content: base64Audio,
          audio_type: 'mp3',
          loop: 'infinity'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Hold music started (base64 MP3, looping infinitely)');
    }
  } catch (playbackError) {
    console.error('❌ Error starting hold music:', playbackError.message);
    console.error('❌ Error response:', playbackError.response?.data);
    // Don't fail the enqueue if playback fails
  }
}

//================================================ INBOUND CALL WEBHOOK ================================================
// All inbound calls are delivered here initially
router.post('/webhook', express.json(), async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Full webhook body:', JSON.stringify(req.body, null, 2));

  const data = req.body.data;
  const direction = data.payload.direction;

  // Try to initialize Telnyx client if it's not available
  if (!telnyxClient) {
    console.log('Telnyx client not available, attempting to initialize...');
    initializeTelnyxClient();
  }

  console.log(`Webhook received: ${data.event_type}, direction: ${direction}, call_control_id: ${data.payload.call_control_id}`);
  console.log('Telnyx client status:', telnyxClient ? 'Available' : 'Not Available');

  if (data.event_type === 'call.initiated' && direction === 'incoming') {
    console.log('Processing incoming call.initiated event');

    // Track this call as incoming so we can enqueue it when answered
    activeCalls.set(data.payload.call_control_id, {
      status: 'initiated',
      direction: 'incoming',
      timestamp: new Date()
    });

    Voice.create({
      queue_uuid: data.payload.call_control_id, // call_control_id of the enqueued call
      telnyx_number: data.payload.to, // 'to' number on inbound call
      destination_number: data.payload.from, // 'from' number on inbound call
      direction: data.payload.direction // set the direction as 'inbound' for now
    }).then(() => {
      console.log('Call saved to database');

      // Emit NEW_CALL event for SSE
      callEventEmitter.emitNewCall({
        id: data.payload.call_control_id,
        call_control_id: data.payload.call_control_id,
        from: data.payload.from,
        to: data.payload.to,
        direction: data.payload.direction,
        status: 'initiated',
        created_at: new Date()
      });
    }).catch(error => {
      console.error('Error saving call to database:', error);
    });

    // Persist session + customer leg
    try {
      const sessionKey = data.payload.call_control_id;
      const [session] = await CallSession.findOrCreate({
        where: { sessionKey },
        defaults: {
          status: 'ringing',
          from_number: data.payload.from,
          to_number: data.payload.to,
          direction: data.payload.direction,
          started_at: new Date(),
        },
      });

      await CallLeg.findOrCreate({
        where: { call_control_id: sessionKey },
        defaults: {
          sessionKey,
          leg_type: 'customer',
          direction: data.payload.direction,
          status: 'ringing',
          start_time: new Date(),
        },
      });

      console.log('DB: CallSession + customer CallLeg upserted');
    } catch (e) {
      console.error('DB error creating session/leg for call.initiated:', e);
    }

    // Check for available agents but still answer and enqueue for now
    User.findOne({
      where: {
        status: true // status: true means available
      }
    }).then(availableAgent => {
      console.log(availableAgent ? `Available agent found: ${availableAgent.sipUsername}` : 'No available agents found');

      // Always answer the call first to ensure proper call flow
      if (telnyxClient) {
        console.log('🔄 Attempting to answer incoming call...');
        console.log('🔄 Call details:', {
          callId: data.payload.call_control_id,
          from: data.payload.from,
          to: data.payload.to,
          timestamp: new Date().toISOString()
        });

        axios.post(
          `https://api.telnyx.com/v2/calls/${data.payload.call_control_id}/actions/answer`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${process.env.TELNYX_API}`,
              'Content-Type': 'application/json'
            }
          }
        )
          .then(() => {
            console.log('✅ Call answered successfully');
          })
          .catch(error => {
            console.error('❌ Error answering call:', error.message);
            console.error('❌ Answer error type:', error.response?.status);
            console.error('❌ Answer error code:', error.response?.data?.errors?.[0]?.code);
          });
      } else {
        console.error('❌ No Telnyx client available - check initialization');
      }
    }).catch(error => {
      console.error('Error finding available agent:', error);
      // Always answer regardless of agent availability
      if (telnyxClient) {
        console.log('🔄 Fallback: Attempting to answer call (no available agent query result)...');
        console.log('🔄 Fallback call details:', {
          callId: data.payload.call_control_id,
          from: data.payload.from,
          to: data.payload.to,
          timestamp: new Date().toISOString()
        });

        axios.post(
          `https://api.telnyx.com/v2/calls/${data.payload.call_control_id}/actions/answer`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${process.env.TELNYX_API}`,
              'Content-Type': 'application/json'
            }
          }
        )
          .then(() => {
            console.log('✅ Fallback: Call answered successfully');
          })
          .catch(error => {
            console.error('❌ Fallback: Error answering call:', error.message);
            console.error('❌ Fallback answer error type:', error.response?.status);
            console.error('❌ Fallback answer error code:', error.response?.data?.errors?.[0]?.code);
          });
      } else {
        console.error('❌ Fallback: No Telnyx client available');
      }
    });
  }

  if (data.event_type === 'call.answered') {
    // Check if this is an incoming call we're tracking
    const callState = activeCalls.get(data.payload.call_control_id);
    const isIncomingCall = callState?.direction === 'incoming';

    if (!isIncomingCall) {
      console.log('📞 Call answered but not an incoming call we need to enqueue');
      return;
    }

    // Check if already being processed
    if (callState.status === 'enqueuing' || callState.status === 'enqueued') {
      console.log('⚠️ Call already being processed:', callState.status);
      return;
    }

    console.log('📞 Call answered event received, attempting to enqueue...');
    console.log('📞 Call details:', {
      callId: data.payload.call_control_id,
      from: data.payload.from,
      to: data.payload.to,
      direction: callState.direction,
      timestamp: new Date().toISOString()
    });

    // Mark call as being processed to prevent duplicate enqueue attempts
    activeCalls.set(data.payload.call_control_id, {
      status: 'enqueuing',
      direction: 'incoming',
      timestamp: new Date()
    });

    // First, verify the call is still alive before enqueuing
    if (telnyxClient) {
      try {
        // Check call status first
        console.log('📞 Verifying call status before enqueue...');
        const callStatus = await telnyxClient.calls.retrieve(data.payload.call_control_id);

        const isAlive = callStatus.data?.is_alive || callStatus.is_alive;
        if (!isAlive) {
          console.error('❌ Call is no longer alive, cannot enqueue');
          activeCalls.delete(data.payload.call_control_id);
          return;
        }

        // Add a small delay to ensure call is fully established
        console.log('📞 Adding 500ms delay before gather prompt...');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if queue callback feature is enabled
        const callbackEnabled = process.env.QUEUE_CALLBACK_ENABLED === 'true';
        console.log('🔔 Queue callback feature enabled:', callbackEnabled);

        // Update call state to gathering
        activeCalls.set(data.payload.call_control_id, {
          status: 'gathering',
          direction: 'incoming',
          timestamp: new Date()
        });

        if (callbackEnabled) {
          // Use gather with speak to offer callback option
          console.log('🎤 Starting gather with speak to offer callback option...');

          const gatherPayload = {
            payload: 'All agents are currently busy. Press 1 to stay on hold, or press 2 to receive a callback when an agent becomes available.',
            voice: 'female',
            language: 'en-US',
            minimum_digits: 1,
            maximum_digits: 1,
            timeout_millis: 10000, // 10 seconds to make a choice
            valid_digits: '12',
            client_state: Buffer.from(JSON.stringify({
              call_control_id: data.payload.call_control_id,
              from: data.payload.from,
              to: data.payload.to,
              timestamp: new Date().toISOString()
            })).toString('base64')
          };

          await axios.post(
            `https://api.telnyx.com/v2/calls/${data.payload.call_control_id}/actions/gather_using_speak`,
            gatherPayload,
            {
              headers: {
                'Authorization': `Bearer ${process.env.TELNYX_API}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('✅ Gather with speak initiated successfully');
        } else {
          // If callback feature is disabled, enqueue directly without gather
          console.log('📞 Callback disabled - enqueuing call directly...');
          await enqueueCall(data.payload.call_control_id, data.payload.from, data.payload.to, false);
        }

      } catch (error) {
        console.error('❌ Error during call enqueue process:', error.message);
        console.error('❌ Error type:', error.type);
        console.error('❌ Error code:', error.raw?.errors?.[0]?.code);
        console.error('❌ Error detail:', error.raw?.errors?.[0]?.detail);

        // Remove from tracking on error
        activeCalls.delete(data.payload.call_control_id);

        if (error.type === 'TelnyxInvalidParametersError' && error.raw?.errors?.[0]?.code === '90018') {
          console.log('⚠️ Call already ended before enqueuing - customer may have hung up quickly');
        } else {
          console.error('❌ Unexpected enqueue error, call may have failed');
        }
      }
    } else {
      console.error('❌ No Telnyx client available for enqueuing');
      activeCalls.delete(data.payload.call_control_id);
    }
  }

  if (data.event_type === 'call.enqueued') {
    console.log('🎵 Call enqueued event received, starting hold music...');
    console.log('🎵 Enqueued call details:', {
      callId: data.payload.call_control_id,
      queue: data.payload.queue,
      timestamp: new Date().toISOString()
    });

    broadcast('NEW_CALL', data);
    console.log('🎵 Broadcasted NEW_CALL event to frontend');

    // Emit event for SSE
    callEventEmitter.emitNewCall({
      id: data.payload.call_control_id,
      call_control_id: data.payload.call_control_id,
      from: data.payload.from,
      to: data.payload.to,
      direction: data.payload.direction,
      status: 'queued',
      queue: data.payload.queue,
      created_at: new Date()
    });

    // Update database status
    try {
      await CallSession.update({ status: 'queued' }, { where: { sessionKey: data.payload.call_control_id } });
      await CallLeg.update({ status: 'ringing' }, { where: { call_control_id: data.payload.call_control_id } });
      console.log('🎵 Database updated: call status set to queued');
    } catch (e) {
      console.error('❌ DB error updating status to queued:', e);
    }

    // Note: Hold music playback is now started immediately after enqueuing (in call.answered handler)
    // This event handler just confirms the enqueue was successful
    console.log('🎵 Hold music should already be playing (started immediately after enqueue)');

    // Verify playback is active (optional)
    if (telnyxClient) {
      try {
        console.log('🎵 Verifying call is still active...');
        const callStatus = await telnyxClient.calls.retrieve(data.payload.call_control_id);

        const isAliveForMusic = callStatus.data?.is_alive || callStatus.is_alive;
        if (!isAliveForMusic) {
          console.error('❌ Call ended before enqueued event processed');
          return;
        }

        console.log('✅ Call is still active, playback should be ongoing');

      } catch (playbackError) {
        console.error('❌ Error verifying queue call status:', playbackError.message);
        console.error('❌ Error status:', playbackError.response?.status);
        console.error('❌ Error data:', JSON.stringify(playbackError.response?.data, null, 2));

        if (playbackError.response?.status === 422) {
          console.log('⚠️ 422 Error - Invalid request parameters');
        } else if (playbackError.response?.data?.errors?.[0]?.code === '90018') {
          console.log('⚠️ Call already ended before hold music could start - customer hung up');
        } else {
          console.error('❌ Unexpected hold music error - this may indicate a configuration issue');
        }
      }
    } else {
      console.error('❌ No Telnyx client available for hold music');
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

    // Update DB leg + session
    try {
      await CallLeg.update({
        status: 'ended',
        end_time: new Date(),
        hangup_cause: data.payload.hangup_cause,
        hangup_source: data.payload.hangup_source,
      }, { where: { call_control_id: callControlId } });
      await CallSession.update({ status: 'ended', ended_at: new Date() }, { where: { sessionKey: callControlId } });
    } catch (e) { console.error('DB error ending customer leg/session:', e); }

    console.log('Call marked as ended in activeCalls tracking:', callControlId);

    // Broadcast hangup event to frontend
    const hangupData = {
      callControlId: data.payload.call_control_id,
      hangupCause: data.payload.hangup_cause,
      hangupSource: data.payload.hangup_source,
      sessionKey: data.payload.call_control_id,
      legType: 'customer'
    };

    console.log('Broadcasting CALL_HANGUP:', hangupData);
    broadcast('CALL_HANGUP', hangupData);

    // Emit CALL_ENDED event for SSE
    callEventEmitter.emitCallEnded({
      callControlId: data.payload.call_control_id,
      hangupCause: data.payload.hangup_cause,
      hangupSource: data.payload.hangup_source,
      timestamp: new Date()
    });

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
      sessionKey: callControlId,
      legType: 'customer',
      payload: data.payload
    });

    // Mark session active in DB
    try {
      await CallSession.update({ status: 'active' }, { where: { sessionKey: callControlId } });
    } catch (e) { console.error('DB error marking session active:', e); }
  }

  res.status(200).send('OK');
});

//================================================ GET QUEUE STATUS ================================================
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
// Agent accepts next call from queue - no manual selection
// Dial the agent, then when answered, bridge using queue parameter to auto-pick next call
router.post('/accept-call', express.json(), async (req, res) => {
  console.log('Request Body:', req.body);
  const { sipUsername } = req.body;

  console.log('*** ACCEPT-CALL DEBUG ***');
  console.log('sipUsername:', sipUsername);
  console.log('APP_HOST:', process.env.APP_HOST);
  console.log('APP_PORT:', process.env.APP_PORT);

  // Use simple webhook URL without specific callControlId
  const webhookUrl = `https://${process.env.APP_HOST}:${process.env.APP_PORT}/api/voice/outbound-queue`;
  console.log('Constructed webhook URL:', webhookUrl);

  // Validate required parameters
  if (!sipUsername) {
    console.error('Missing sipUsername parameter');
    return res.status(400).json({ error: 'sipUsername is required' });
  }

  try {
    // Immediately mark the first queued call as 'accepting' to remove it from queue display
    const firstQueuedCall = await Voice.findOne({
      where: {
        status: 'queued',
        direction: 'incoming'  // Only accept inbound calls from queue
      },
      order: [['createdAt', 'ASC']]
    });

    let customerCallId = null;

    if (firstQueuedCall) {
      customerCallId = firstQueuedCall.queue_uuid;  // Store the customer call ID for link_to
      await Voice.update(
        { status: 'accepting', accept_agent: sipUsername },
        { where: { uuid: firstQueuedCall.uuid } }
      );
      console.log('✅ Marked call as accepting:', firstQueuedCall.queue_uuid);
      console.log('✅ Customer call ID for linking:', customerCallId);

      // Emit queue update to remove from display immediately
      callEventEmitter.emitQueueUpdate();
    } else {
      console.log('⚠️ No queued calls found to mark as accepting');
    }

    // Use a default caller ID for the agent call (can be any valid number from your Telnyx account)
    // This is just for dialing the agent, the actual customer caller ID will be presented after bridge
    const defaultCallerId = process.env.TELNYX_DEFAULT_CALLER_ID || '+18445550100';

    // Use Dial API to call the agent's WebRTC client
    const telnyxRequestBody = {
      connection_id: process.env.TELNYX_CONNECTION_ID || '2397473570750989860',
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: defaultCallerId,
      link_to: customerCallId,  // Link to the customer call in queue (call_control_id)
      bridge_intent: true,  // Indicate intention to bridge these calls
      webhook_url: webhookUrl,
      client_state: Buffer.from(JSON.stringify({ sipUsername, customerCallId })).toString('base64')
    };

    console.log('Using webhook URL:', webhookUrl);
    console.log('Telnyx Dial Request Body (with link_to and bridge_intent):', JSON.stringify(telnyxRequestBody, null, 2));

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

      // Return success immediately - the bridge will happen when agent answers
      res.status(200).json({
        success: true,
        message: 'Agent call initiated',
        agentCallId: telnyxResponse.data.data.call_control_id
      });
    } catch (telnyxError) {
      console.error('Telnyx Dial API Error Details:');
      if (telnyxError.response) {
        console.error('Status:', telnyxError.response.status);
        console.error('Status Text:', telnyxError.response.statusText);
        console.error('Response Data:', JSON.stringify(telnyxError.response.data, null, 2));
        console.error('Response Headers:', telnyxError.response.headers);
      }

      // Rollback the status change if dialing fails
      if (firstQueuedCall) {
        await Voice.update(
          { status: 'queued', accept_agent: null },
          { where: { uuid: firstQueuedCall.uuid } }
        );
        console.log('⚠️ Rolled back call status to queued due to dial error');
        callEventEmitter.emitQueueUpdate();
      }

      throw telnyxError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Error during agent dial:', error);

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

//================================================ OUTBOUND-QUEUE WEBHOOK ================================================
// Webhook for queue-based bridging when agent accepts call
router.post('/outbound-queue', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const agentCallId = req.body.data.payload.call_control_id;
  const hangup_source = req.body.data.payload.hangup_source;
  const clientStateB64 = req.body.data.payload.client_state;

  console.log('*** OUTBOUND-QUEUE WEBHOOK ***');
  console.log('Event type:', event_type);
  console.log('Agent call ID:', agentCallId);

  let sipUsername = null;
  try {
    if (clientStateB64) {
      const decoded = JSON.parse(Buffer.from(clientStateB64, 'base64').toString());
      sipUsername = decoded.sipUsername;
      console.log('[outbound-queue] Decoded sipUsername from client_state:', sipUsername);
    } else {
      console.warn('[outbound-queue] No client_state found in webhook');
    }
  } catch (e) {
    console.error('Error decoding client_state:', e);
  }

  if (event_type === 'call.answered') {
    try {
      console.log('*** AGENT ANSWERED - BRIDGING TO QUEUE ***');
      console.log('Agent Call ID:', agentCallId);

      // Add a small delay to ensure call is ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Bridge using queue parameter instead of specific call_control_id
      // This will automatically pick the next call from the queue (FIFO)
      const bridgeResponse = await axios.post(
        `https://api.telnyx.com/v2/calls/${agentCallId}/actions/bridge`,
        {
          queue: 'General_Queue'  // Use queue parameter for automatic selection
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('*** BRIDGE API SUCCESS ***');
      console.log('Bridge response:', JSON.stringify(bridgeResponse.data, null, 2));

      // The call.bridged event will provide the customer call ID
      // We'll update the database in that event handler

      res.status(200).send('OK');
    } catch (error) {
      console.error('*** BRIDGE API ERROR ***');
      console.error('Error during queue bridge:', error.message);

      if (error.response) {
        console.error('Telnyx Bridge API Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: JSON.stringify(error.response.data, null, 2)
        });
      }

      res.status(500).send('Internal Server Error');
    }
  } else if (event_type === 'call.bridged') {
    console.log('*** CALL BRIDGED FROM QUEUE ***');
    const payload = req.body.data.payload;
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    // Extract customer call ID - when bridging from queue, other_leg_id contains the customer call
    const customerCallId = payload.other_leg_id || payload.call_leg_id || payload.call_control_id;

    console.log('Agent call ID:', agentCallId);
    console.log('Customer call ID:', customerCallId);
    console.log('other_leg_id:', payload.other_leg_id);
    console.log('call_leg_id:', payload.call_leg_id);
    console.log('call_control_id:', payload.call_control_id);

    // Update Voice record to track which agent accepted
    if (customerCallId && sipUsername) {
      try {
        await Voice.update(
          {
            bridge_uuid: agentCallId,
            accept_agent: sipUsername,
            status: 'active'
          },
          {
            where: { queue_uuid: customerCallId }
          }
        );
        console.log('Database updated: call accepted by agent', sipUsername);
      } catch (dbError) {
        console.error('Error updating database:', dbError);
      }
    }

    // Broadcast to frontend
    broadcast('CALL_ACCEPTED', {
      callControlId: agentCallId,
      bridgeId: customerCallId,
      sessionKey: customerCallId,
      customerCallId: customerCallId,
      agentCallId: agentCallId
    });

    // Emit event for SSE
    callEventEmitter.emitCallAccepted({
      callControlId: agentCallId,
      bridgeId: customerCallId,
      sessionKey: customerCallId,
      customerCallId: customerCallId,
      agentCallId: agentCallId,
      acceptedBy: sipUsername,
      timestamp: new Date()
    });

    // Update CallSession and CallLeg
    if (customerCallId) {
      try {
        // First, find the existing customer CallLeg to get the correct sessionKey
        console.log('[call.bridged] Looking for customer leg with call_control_id:', customerCallId);
        let existingCustomerLeg = await CallLeg.findOne({
          where: {
            call_control_id: customerCallId,
            leg_type: 'customer'
          }
        });

        // If not found by exact match, the customerCallId might be the call_leg_id
        // Try to find by looking for any customer leg that matches the queue call
        if (!existingCustomerLeg) {
          console.log('[call.bridged] Customer leg not found by call_control_id, searching Voice table...');
          const voiceRecord = await Voice.findOne({
            where: {
              [Op.or]: [
                { queue_uuid: customerCallId },
                { bridge_uuid: customerCallId }
              ]
            }
          });

          if (voiceRecord) {
            console.log('[call.bridged] Found Voice record:', {
              queue_uuid: voiceRecord.queue_uuid,
              bridge_uuid: voiceRecord.bridge_uuid
            });

            // Try to find customer leg using the queue_uuid from Voice
            existingCustomerLeg = await CallLeg.findOne({
              where: {
                call_control_id: voiceRecord.queue_uuid,
                leg_type: 'customer'
              }
            });
          }
        }

        if (!existingCustomerLeg) {
          console.error('[call.bridged] ⚠️ Could not find existing customer leg - searching all recent legs...');
          const recentLegs = await CallLeg.findAll({
            where: { leg_type: 'customer' },
            order: [['createdAt', 'DESC']],
            limit: 5
          });
          console.log('[call.bridged] Recent customer legs:', recentLegs.map(leg => ({
            id: leg.id,
            call_control_id: leg.call_control_id,
            sessionKey: leg.sessionKey,
            status: leg.status,
            createdAt: leg.createdAt
          })));

          // Use the most recent customer leg that's not ended
          existingCustomerLeg = recentLegs.find(leg => leg.status !== 'ended');
        }

        if (existingCustomerLeg) {
          const correctSessionKey = existingCustomerLeg.sessionKey;
          console.log('[call.bridged] Found existing customer leg with sessionKey:', correctSessionKey);

          // Update CallSession with the correct sessionKey
          await CallSession.update({ status: 'active' }, { where: { sessionKey: correctSessionKey } });

          // Create agent leg using the CORRECT sessionKey
          const [agentLeg, created] = await CallLeg.findOrCreate({
            where: { call_control_id: agentCallId },
            defaults: {
              sessionKey: correctSessionKey,  // Use the correct sessionKey from customer leg
              leg_type: 'agent',
              direction: 'incoming',
              status: 'active',
              start_time: new Date(),
              accepted_by: sipUsername
            }
          });

          console.log('[call.bridged] CallLeg findOrCreate result:', {
            created,
            agentLegId: agentLeg.id,
            call_control_id: agentLeg.call_control_id,
            accepted_by: agentLeg.accepted_by,
            status: agentLeg.status,
            sessionKey: agentLeg.sessionKey
          });

          await CallLeg.update({ status: 'active' }, { where: { call_control_id: agentCallId } });
          console.log('[call.bridged] ✅ CallSession and CallLeg updated successfully with sessionKey:', correctSessionKey);
        } else {
          console.error('[call.bridged] ❌ Could not find any customer leg to link agent leg to');
        }
      } catch (e) {
        console.error('[call.bridged] DB error updating session/leg:', e);
      }
    } else {
      console.error('[call.bridged] ⚠️ Cannot update CallSession/CallLeg: customerCallId is undefined');
    }

    res.status(200).send('OK');
  } else if (event_type === 'call.gather.ended') {
    // Handle gather ended event for callback option selection
    console.log('=== GATHER ENDED ===');
    console.log('Digits collected:', data.payload.digits);
    console.log('Status:', data.payload.status);

    const digits = data.payload.digits;
    const callControlId = data.payload.call_control_id;

    try {
      // Decode client state
      let clientState = {};
      if (data.payload.client_state) {
        try {
          clientState = JSON.parse(Buffer.from(data.payload.client_state, 'base64').toString());
          console.log('Decoded client state:', clientState);
        } catch (e) {
          console.error('Error decoding client state:', e);
        }
      }

      const from = clientState.from || data.payload.from;
      const to = clientState.to || data.payload.to;

      if (digits === '1') {
        // Caller chose to stay on hold (no callback)
        console.log('📞 Caller pressed 1 - staying on hold without callback');
        await enqueueCall(callControlId, from, to, false);
      } else if (digits === '2') {
        // Caller chose callback option
        console.log('🔔 Caller pressed 2 - enabling callback');

        // Speak confirmation message
        await axios.post(
          `https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`,
          {
            payload: 'Thank you. We will call you back when an agent becomes available. Goodbye.',
            voice: 'female',
            language: 'en-US'
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.TELNYX_API}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Wait a moment for the message to play
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Enqueue with callback enabled
        await enqueueCall(callControlId, from, to, true);

        // Hangup the current call since they'll receive a callback
        await axios.post(
          `https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${process.env.TELNYX_API}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ Call hung up - callback will be initiated after timeout');
      } else if (data.payload.status === 'no_input' || data.payload.status === 'invalid') {
        // No input or invalid input - default to staying on hold
        console.log('⚠️ No valid input received - defaulting to hold without callback');
        await enqueueCall(callControlId, from, to, false);
      } else {
        console.log('⚠️ Unexpected digits received:', digits, '- defaulting to hold without callback');
        await enqueueCall(callControlId, from, to, false);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Error handling gather ended:', error);
      console.error('Error details:', error.response?.data || error.message);

      // On error, try to enqueue without callback as fallback
      try {
        await enqueueCall(callControlId, data.payload.from, data.payload.to, false);
      } catch (enqueueError) {
        console.error('❌ Failed to enqueue call as fallback:', enqueueError.message);
      }

      res.status(200).send('OK');
    }
  } else if (event_type === 'call.hangup' && hangup_source === 'callee') {
    console.log('*** AGENT HANGUP DETECTED (before bridge) ***');
    console.log('Agent hung up before accepting call');
    res.status(200).send('OK');
  } else {
    res.status(200).send('OK');
  }
});

//=================================================== QUEUE CALLBACK WEBHOOK ===================================================
// Webhook handler for queue callback requests
// This endpoint is called when Telnyx initiates a callback for a queued call
router.post('/queue-callback', express.json(), async (req, res) => {
  console.log('=== QUEUE CALLBACK WEBHOOK ===');
  console.log('Full callback body:', JSON.stringify(req.body, null, 2));

  const data = req.body.data;
  const event_type = data?.event_type;
  const payload = data?.payload;

  console.log('Callback event type:', event_type);
  console.log('Callback payload:', JSON.stringify(payload, null, 2));

  try {
    // Decode client state to get original call information
    let clientState = {};
    if (payload?.client_state) {
      try {
        clientState = JSON.parse(Buffer.from(payload.client_state, 'base64').toString());
        console.log('Decoded client state:', clientState);
      } catch (e) {
        console.error('Error decoding client state:', e);
      }
    }

    // Handle different callback events
    if (event_type === 'call.initiated') {
      console.log('📞 Queue callback call initiated');
      console.log('Original call:', clientState.original_call_id);
      console.log('Callback to:', clientState.from);

      // Answer the callback call
      await axios.post(
        `https://api.telnyx.com/v2/calls/${payload.call_control_id}/actions/answer`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Callback call answered');

      // Track callback in Voice table
      await Voice.create({
        queue_uuid: payload.call_control_id,
        telnyx_number: payload.to,
        destination_number: payload.from,
        direction: 'callback',
        queue_name: 'General_Queue'
      });

    } else if (event_type === 'call.answered') {
      console.log('📞 Queue callback call answered by customer');

      // Create CallSession and CallLeg for callback
      const sessionKey = payload.call_control_id;
      await CallSession.findOrCreate({
        where: { sessionKey },
        defaults: {
          status: 'queued',
          from_number: payload.from,
          to_number: payload.to,
          direction: 'callback',
          started_at: new Date(),
        },
      });

      await CallLeg.findOrCreate({
        where: { call_control_id: sessionKey },
        defaults: {
          sessionKey,
          leg_type: 'customer',
          direction: 'callback',
          status: 'ringing',
          start_time: new Date(),
        },
      });

      // Now enqueue the callback call so agent can accept it
      await axios.post(
        `https://api.telnyx.com/v2/calls/${payload.call_control_id}/actions/enqueue`,
        {
          queue_name: 'General_Queue'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Callback call enqueued for agent');

      // Emit NEW_CALL event for callback
      callEventEmitter.emitNewCall({
        id: payload.call_control_id,
        call_control_id: payload.call_control_id,
        from: payload.from,
        to: payload.to,
        direction: 'callback',
        status: 'queued',
        created_at: new Date()
      });

    } else if (event_type === 'call.hangup') {
      console.log('📞 Queue callback call hung up');
      console.log('Hangup cause:', payload.hangup_cause);

      // Update database
      await Voice.update({
        status: 'completed',
        end_time: new Date()
      }, {
        where: { queue_uuid: payload.call_control_id }
      });

      // Clean up session
      await CallSession.update({
        status: 'ended',
        ended_at: new Date()
      }, {
        where: { sessionKey: payload.call_control_id }
      });

      await CallLeg.update({
        status: 'ended',
        end_time: new Date(),
        hangup_cause: payload.hangup_cause,
        hangup_source: payload.hangup_source
      }, {
        where: { call_control_id: payload.call_control_id }
      });
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ Error handling queue callback:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.status(500).send('Internal Server Error');
  }
});

//=================================================== AGENT TRANSFER ===================================================
// Transfer call using Dial + Bridge pattern
// Always transfers the PSTN (customer) leg regardless of call origin
router.post('/transfer', express.json(), async (req, res) => {
  const { sipUsername, callerId, callControlId, outboundCCID } = req.body;

  console.log('=== TRANSFER REQUEST ===');
  console.log('Transfer request:', { sipUsername, callerId, callControlId, outboundCCID });

  try {
    // Look up the target agent's SIP username from the database
    // Try to find by sipUsername first, then fall back to username
    let targetAgent = await User.findOne({
      where: { sipUsername: sipUsername }
    });

    // If not found by sipUsername, try by username
    if (!targetAgent) {
      targetAgent = await User.findOne({
        where: { username: sipUsername }
      });
    }

    if (!targetAgent) {
      console.error('❌ Target agent not found:', sipUsername);
      return res.status(404).json({ error: 'Target agent not found' });
    }

    const targetSipUsername = targetAgent.sipUsername;
    console.log('✅ Found target agent:', {
      username: targetAgent.username,
      sipUsername: targetSipUsername,
      firstName: targetAgent.firstName
    });

    // Determine which call ID to use for the transfer (PSTN/customer call)
    let pstnCallId = null;        // The PSTN leg (customer) - this is what we transfer
    let currentAgentCallId = null; // The current agent's leg
    let sessionKey = null;         // The session identifier
    let callOrigin = null;        // 'inbound' or 'outbound'

    // Strategy: Use CallLeg model to identify the customer (PSTN) leg
    // The customer leg has leg_type='customer' and represents the PSTN connection

    if (callControlId) {
      // Step 1: Find the agent leg to get the session
      const agentLeg = await CallLeg.findOne({
        where: { call_control_id: callControlId }
      });

      if (!agentLeg) {
        console.error('Agent leg not found for callControlId:', callControlId);
        return res.status(404).json({ error: 'Agent call leg not found' });
      }

      sessionKey = agentLeg.sessionKey;
      currentAgentCallId = callControlId;

      console.log('Found agent leg, sessionKey:', sessionKey);

      // Step 2: Find the customer (PSTN) leg using the same sessionKey
      const customerLeg = await CallLeg.findOne({
        where: {
          sessionKey: sessionKey,
          leg_type: 'customer'
        }
      });

      if (!customerLeg) {
        console.error('Customer leg not found for sessionKey:', sessionKey);
        return res.status(404).json({ error: 'Customer call leg not found' });
      }

      pstnCallId = customerLeg.call_control_id;
      console.log('Found customer (PSTN) leg:', pstnCallId);

      // Determine call origin from CallSession
      const session = await CallSession.findOne({
        where: { sessionKey: sessionKey }
      });
      callOrigin = session?.direction || 'unknown';
    } else if (outboundCCID) {
      // Legacy handling for outbound WebRTC calls
      // outboundCCID is the WebRTC leg, we need to find the PSTN leg
      console.log('Using legacy outboundCCID parameter');

      const callData = await Voice.findOne({
        where: { queue_uuid: outboundCCID }
      });

      if (!callData) {
        return res.status(404).json({ error: 'Call data not found for outboundCCID' });
      }

      // For outbound WebRTC: bridge_uuid is the PSTN leg
      pstnCallId = callData.bridge_uuid;
      currentAgentCallId = outboundCCID;
      sessionKey = outboundCCID;
      callOrigin = 'outbound';

      console.log('Legacy outbound: PSTN leg:', pstnCallId, 'Agent leg:', currentAgentCallId);
    } else {
      return res.status(400).json({ error: 'No valid call ID provided for transfer' });
    }

    if (!pstnCallId) {
      return res.status(404).json({ error: 'Could not identify PSTN leg for transfer' });
    }

    console.log('=== TRANSFER SUMMARY ===');
    console.log('Call Origin:', callOrigin);
    console.log('PSTN/Customer Call ID:', pstnCallId);
    console.log('Current Agent Call ID:', currentAgentCallId);
    console.log('Session Key:', sessionKey);
    console.log('Transferring to username:', sipUsername);
    console.log('Transferring to SIP:', targetSipUsername);

    // Step 3: Dial the new agent
    // Extract the from number properly
    const fromNumber = typeof callerId === 'object' ? callerId?.number : callerId;

    console.log('Transfer dial details:', {
      to: `sip:${targetSipUsername}@sip.telnyx.com`,
      from: fromNumber,
      link_to: pstnCallId,
      pstnCallId: pstnCallId
    });

    const dialResponse = await axios.post('https://api.telnyx.com/v2/calls', {
      connection_id: process.env.TELNYX_CONNECTION_ID || '2397473570750989860',
      to: `sip:${targetSipUsername}@sip.telnyx.com`,  // Use the actual SIP username
      from: fromNumber,
      link_to: pstnCallId,  // Link to the PSTN/customer call
      bridge_intent: true,  // Indicate intention to bridge
      webhook_url: `https://${process.env.APP_HOST}:${process.env.APP_PORT}/api/voice/transfer-dial-webhook`,
      client_state: Buffer.from(JSON.stringify({
        action: 'transfer_dial',
        pstnCallId: pstnCallId,
        currentAgentCallId: currentAgentCallId,
        transferToAgent: targetSipUsername,  // Store the SIP username for later use
        sessionKey: sessionKey,
        callOrigin: callOrigin
      })).toString('base64')
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      }
    });

    const newAgentCallId = dialResponse.data.data.call_control_id;
    console.log('✅ Dialed new agent, call ID:', newAgentCallId);

    // Step 4: Update database to track the transfer
    await Voice.update({
      transfer_agent_call_id: newAgentCallId,
      transfer_status: 'dialing',
      transfer_to_agent: sipUsername
    }, {
      where: { queue_uuid: sessionKey }
    });

    // Also mark the old agent leg as transferring
    await CallLeg.update({
      status: 'ended',
      end_time: new Date(),
      hangup_cause: 'TRANSFER_INITIATED'
    }, {
      where: { call_control_id: currentAgentCallId }
    });

    // Broadcast transfer initiated event to all agents (for general awareness)
    broadcast('TRANSFER_INITIATED', {
      pstnCallId: pstnCallId,
      currentAgentCallId: currentAgentCallId,
      newAgentCallId: newAgentCallId,
      transferToAgent: sipUsername,
      callOrigin: callOrigin
    });

    // Send targeted notification to the MAIN/PRIMARY device of the receiving agent
    console.log(`Sending targeted transfer notification to PRIMARY device of agent: ${sipUsername}`);
    const targetedSuccess = broadcastToAgentPrimary(sipUsername, 'INCOMING_TRANSFER', {
      pstnCallId: pstnCallId,
      currentAgentCallId: currentAgentCallId,
      newAgentCallId: newAgentCallId,
      fromAgent: 'current_agent',
      callerId: callerId,
      callOrigin: callOrigin
    });

    if (!targetedSuccess) {
      console.warn(`Warning: Could not send targeted transfer notification to ${sipUsername} - agent may not be connected or no primary device found`);
    }

    res.json({
      success: true,
      newAgentCallId: newAgentCallId,
      pstnCallId: pstnCallId,
      status: 'dialing',
      message: 'Transfer initiated - dialing new agent'
    });

  } catch (error) {
    console.error('❌ Error initiating transfer:', error.response?.data || error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Transfer failed',
      details: error.response?.data || error.message
    });
  }
});

//=================================================== TRANSFER DIAL WEBHOOK ===================================================
// Transfer dial webhook - handles when new agent is dialed
router.post('/transfer-dial-webhook', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const payload = req.body.data.payload;
  const newAgentCallId = payload.call_control_id;

  console.log('=== TRANSFER DIAL WEBHOOK ===');
  console.log('Event:', event_type, 'New Agent Call ID:', newAgentCallId);

  try {
    // Parse the client state to get transfer details
    const clientState = Buffer.from(payload.client_state || '', 'base64').toString();
    const transferData = JSON.parse(clientState);
    const { pstnCallId, currentAgentCallId, transferToAgent, sessionKey, callOrigin } = transferData;

    console.log('Transfer data:', {
      pstnCallId,
      currentAgentCallId,
      transferToAgent,
      sessionKey,
      callOrigin
    });

    if (event_type === 'call.answered') {
      console.log('✅ New agent answered - bridging to PSTN leg');

      // Step 1: Bridge the PSTN call with the new agent call
      console.log(`Bridging PSTN leg ${pstnCallId} to new agent ${newAgentCallId}`);
      const bridgeResponse = await axios.post(`https://api.telnyx.com/v2/calls/${pstnCallId}/actions/bridge`, {
        call_control_id: newAgentCallId
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Bridge successful:', bridgeResponse.data);

      // Step 2: Hang up the current agent call
      try {
        console.log(`Hanging up old agent call: ${currentAgentCallId}`);
        await axios.post(`https://api.telnyx.com/v2/calls/${currentAgentCallId}/actions/hangup`, {}, {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ Current agent call hung up');
      } catch (hangupError) {
        console.error('⚠️ Error hanging up current agent:', hangupError.message);
        // Continue even if hangup fails - the important part is the bridge
      }

      // Step 3: Update database to reflect successful transfer
      await Voice.update({
        bridge_uuid: newAgentCallId,
        transfer_status: 'completed',
        accept_agent: transferToAgent
      }, {
        where: { queue_uuid: sessionKey }
      });

      // Update CallLeg records
      try {
        // Create new agent leg
        await CallLeg.findOrCreate({
          where: { call_control_id: newAgentCallId },
          defaults: {
            sessionKey: sessionKey,
            leg_type: 'agent',
            direction: 'incoming',
            status: 'active',
            start_time: new Date(),
            accepted_by: transferToAgent
          }
        });

        // Mark as active
        await CallLeg.update(
          { status: 'active' },
          { where: { call_control_id: newAgentCallId } }
        );

        console.log('✅ Database updated with new agent leg');
      } catch (dbError) {
        console.error('⚠️ Error updating CallLeg:', dbError.message);
      }

      // Broadcast successful transfer to all agents
      broadcast('TRANSFER_COMPLETED', {
        pstnCallId: pstnCallId,
        newAgentCallId: newAgentCallId,
        transferToAgent: transferToAgent,
        sessionKey: sessionKey,
        callOrigin: callOrigin,
        status: 'success'
      });

      // Send targeted completion notification to the receiving agent's primary device
      broadcastToAgentPrimary(transferToAgent, 'TRANSFER_ACCEPTED', {
        pstnCallId: pstnCallId,
        newAgentCallId: newAgentCallId,
        sessionKey: sessionKey,
        status: 'completed',
        action: 'call_connected'
      });

      console.log('✅ Transfer completed successfully');

    } else if (event_type === 'call.hangup') {
      const hangupCause = payload.hangup_cause;
      console.log('❌ Transfer failed - new agent did not answer:', hangupCause);

      // Update database to reflect failed transfer
      await Voice.update({
        transfer_status: 'failed',
        transfer_agent_call_id: null
      }, {
        where: { queue_uuid: sessionKey }
      });

      // Revert the old agent leg status if still exists
      try {
        await CallLeg.update({
          status: 'active',
          hangup_cause: null
        }, {
          where: { call_control_id: currentAgentCallId }
        });
      } catch (dbError) {
        console.error('⚠️ Error reverting agent leg status:', dbError.message);
      }

      // Broadcast transfer failure
      broadcast('TRANSFER_FAILED', {
        pstnCallId: pstnCallId,
        sessionKey: sessionKey,
        transferToAgent: transferToAgent,
        reason: hangupCause,
        status: 'failed'
      });

      console.log('❌ Transfer marked as failed in database');
    }

  } catch (error) {
    console.error('❌ Error handling transfer dial webhook:', error);
    console.error('Error stack:', error.stack);
  }

  res.status(200).send('OK');
});

//============= DEBUG ENDPOINTS ===================
// Debug endpoint to check WebSocket connections and events
router.get('/debug-state', (req, res) => {
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

    // Update database to mark call as completed
    Voice.update({
      status: 'completed',
      end_time: new Date()
    }, {
      where: {
        [Op.or]: [
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

//============= UTILITY ENDPOINTS ===================
// Lightweight auth (duplicated from userRoutes for independence)
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-for-dev');
    const user = await User.findOne({ where: { username: decoded.username } });
    if (!user) return res.status(401).json({ message: 'Please authenticate.' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Please authenticate.' });
  }
};

// Returns current active session for the authenticated agent (if any)
router.get('/my-active-session', authenticateUser, async (req, res) => {
  try {
    const sipUsername = req.user.sipUsername;
    console.log('[my-active-session] Looking for agent leg for:', sipUsername);

    // Debug: Show ALL agent legs in the database
    const allAgentLegs = await CallLeg.findAll({
      where: { leg_type: 'agent' },
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    console.log('[my-active-session] All recent agent legs in DB:', allAgentLegs.map(leg => ({
      id: leg.id,
      call_control_id: leg.call_control_id,
      accepted_by: leg.accepted_by,
      status: leg.status,
      createdAt: leg.createdAt
    })));

    // Find the most recent leg for this agent that's not ended
    const agentLeg = await CallLeg.findOne({
      where: {
        accepted_by: sipUsername,
        status: { [Op.ne]: 'ended' }  // Not equal to 'ended' - allows any active status
      },
      order: [['createdAt', 'DESC']],
    });

    console.log('[my-active-session] Found agent leg:', agentLeg ? {
      id: agentLeg.id,
      call_control_id: agentLeg.call_control_id,
      status: agentLeg.status,
      leg_type: agentLeg.leg_type,
      sessionKey: agentLeg.sessionKey
    } : null);

    if (!agentLeg) return res.json({ session: null });

    const session = await CallSession.findOne({ where: { sessionKey: agentLeg.sessionKey } });
    const legs = await CallLeg.findAll({ where: { sessionKey: agentLeg.sessionKey } });

    console.log('[my-active-session] Returning session with', legs.length, 'legs');
    return res.json({ session, legs });
  } catch (e) {
    console.error('Error fetching my-active-session:', e);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
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

module.exports = router;
