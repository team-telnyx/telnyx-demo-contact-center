require('dotenv').config();
const express = require('express');
const Voice = require('../models/Voice');
const router = express.Router();
const CallSession = require('../models/CallSession');
const CallLeg = require('../models/CallLeg');
const axios = require('axios');
const { broadcast } = require('./websocket');
const callEventEmitter = require('../utils/eventEmitter');

// Track active calls in memory
const activeCalls = new Map();

//============= WEBRTC OUTBOUND CALLS ===================
// This is when the webrtc user dials an outbound number from the PhonePage component
// All outbound calls from the WebRTC client are delivered here initially
router.post('/outbound-webrtc', express.json(), async (req, res) => {
  const fromNumber = req.body.data.payload.from;
  const toNumber = req.body.data.payload.to;
  const callControlId = req.body.data.payload.call_control_id;
  const event_type = req.body.data.event_type;
  const direction = req.body.data.payload.direction;
  const state = req.body.data.payload.state;
  const clientState = req.body.data.payload.client_state;
  const data = req.body.data;

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
          telnyx_number: data.payload.from,
          destination_number: data.payload.to,
          direction: data.payload.direction,
          queue_uuid: data.payload.call_control_id,
          status: 'dialing' // Outbound calls start as dialing, never queued
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

      // Removed ringing sound playback to avoid 422 errors
      console.log('WebRTC call answered, proceeding without ring back tone');

      const telnyxRequestBody = {
        connection_id: process.env.TELNYX_CONNECTION_ID || '2397473570750989860',
        to: toNumber,
        from: fromNumber,
        link_to: transferId,  // Link to the parked WebRTC call (call_control_id)
        bridge_intent: true,  // Indicate intention to bridge these calls
        client_state: Buffer.from(transferId).toString('base64'),
        webhook_url: `https://${process.env.APP_HOST}/api/voice/outbound-webrtc-bridge?callControlId_Bridge=${encodeURIComponent(transferId)}`,
      };

      console.log('Outbound call request body (with link_to and bridge_intent):', JSON.stringify(telnyxRequestBody, null, 2));

      // Make the HTTP POST request to Telnyx API
      const telnyxResponse = await axios.post('https://api.telnyx.com/v2/calls', telnyxRequestBody, config);
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

//============= WEBRTC OUTBOUND BRIDGE ===================
// This is the second leg to the PSTN for WebRTC outbound calls
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

      console.log('Bridge API success');

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
      bridgeId: callControlId_Bridge,
      sessionKey: callControlId_Bridge,
      legType: 'agent'
    });

    // DB: ensure session and agent leg exist and set active
    try {
      const voiceRow = await Voice.findOne({ where: { queue_uuid: callControlId_Bridge } });
      const acceptedBy = voiceRow?.accept_agent || null;

      // Ensure CallSession exists first (for outbound calls, it might not exist)
      await CallSession.findOrCreate({
        where: { sessionKey: callControlId_Bridge },
        defaults: {
          status: 'active',
          direction: 'outbound',
          started_at: new Date(),
        },
      });

      // Now create the agent leg
      await CallLeg.findOrCreate({
        where: { call_control_id: callControl },
        defaults: {
          sessionKey: callControlId_Bridge,
          leg_type: 'agent',
          direction: 'outgoing',
          status: 'active',
          start_time: new Date(),
          accepted_by: acceptedBy,
        },
      });

      // Update statuses
      await CallLeg.update({ status: 'active' }, { where: { call_control_id: callControl } });
      await CallSession.update({ status: 'active' }, { where: { sessionKey: callControlId_Bridge } });
    } catch (e) { console.error('DB error creating/updating agent leg on bridge:', e); }
  }

  // Handle failed PSTN calls
  if (event_type === 'call.hangup' && hangup_source === "caller" && callControlId_Bridge) {
    console.log('PSTN call failed or was rejected, checking if WebRTC user needs notification');
    try {
      // First check if the WebRTC call is still alive before trying to speak to it
      const webrtcCallStatus = await axios.get(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}`, {
        headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
      });

      const isWebRTCCallActive = webrtcCallStatus.data.data.is_alive;
      console.log(`WebRTC call ${callControlId_Bridge} is_alive:`, isWebRTCCallActive);

      if (!isWebRTCCallActive) {
        console.log('WebRTC call already ended, skipping notification');
        return;
      }

      // Stop any playback first
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/playback_stop`, {}, {
        headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
      }).catch(() => {}); // Ignore errors

      // Inform the user about the failed connection
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/speak`, {
        payload: 'The call could not be connected. Please try again later.',
        voice: 'female',
        language: 'en-US',
      }, {
        headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
      });

      // Hang up after a short delay to allow user to hear the message
      setTimeout(async () => {
        try {
          // Double-check call is still alive before hanging up
          const finalCheckStatus = await axios.get(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}`, {
            headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
          });

          if (finalCheckStatus.data.data.is_alive) {
            await axios.post(`https://api.telnyx.com/v2/calls/${callControlId_Bridge}/actions/hangup`, {}, {
              headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
            });
            console.log('WebRTC call hung up after PSTN failure');
          } else {
            console.log('WebRTC call already ended, no need to hang up');
          }
        } catch (hangupError) {
          if (hangupError.response?.status === 422) {
            console.log('WebRTC call already ended before hangup attempt (expected)');
          } else {
            console.error('Error hanging up WebRTC call after PSTN failure:', hangupError.message);
          }
        }
      }, 3000);

    } catch (error) {
      if (error.response?.status === 422) {
        console.error('WebRTC call no longer available for notification (422 error) - this is expected if call already ended');
      } else {
        console.error('Error handling PSTN call failure:', error.message);
      }
    }
  }

  // Outbound webhook: generic agent leg hangup persistence
  if (event_type === 'call.hangup') {
    try {
      // Update the agent leg to ended
      await CallLeg.update({
        status: 'ended',
        end_time: new Date(),
        hangup_cause: req.body.data.payload.hangup_cause,
        hangup_source: req.body.data.payload.hangup_source,
      }, { where: { call_control_id: callControl } });

      // If customer leg is already ended, end the session too
      if (callControlId_Bridge) {
        const customerLeg = await CallLeg.findOne({ where: { sessionKey: callControlId_Bridge, leg_type: 'customer' } });
        if (customerLeg && customerLeg.status === 'ended') {
          await CallSession.update({ status: 'ended', ended_at: new Date() }, { where: { sessionKey: callControlId_Bridge } });
        }
      }
    } catch (e) {
      console.error('DB error persisting agent leg hangup:', e);
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

//============= PLACE OUTBOUND CALL (Backend-Initiated) ===================
// This endpoint allows the frontend to request an outbound call
// The backend will dial the destination, then dial the agent's WebRTC connection and bridge them
router.post('/place-outbound-call', express.json(), async (req, res) => {
  console.log('=== PLACE OUTBOUND CALL REQUEST ===');
  const { from, to, sipUsername } = req.body;

  console.log(`Request to place call: from=${from}, to=${to}, sipUsername=${sipUsername}`);

  if (!to || !sipUsername) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'to and sipUsername are required'
    });
  }

  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API}`
      }
    };

    // Generate a unique identifier for tracking this call session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Step 1: Dial the destination number (PSTN leg)
    const telnyxRequestBody = {
      connection_id: process.env.TELNYX_CONNECTION_ID || '2397473570750989860',
      to: to,
      from: from || undefined, // Only include if provided
      client_state: Buffer.from(JSON.stringify({ sessionId, sipUsername, stage: 'pstn' })).toString('base64'),
      webhook_url: `https://${process.env.APP_HOST}/api/voice/outbound-call-webhook`,
    };

    console.log('Dialing PSTN leg:', JSON.stringify(telnyxRequestBody, null, 2));

    const telnyxResponse = await axios.post('https://api.telnyx.com/v2/calls', telnyxRequestBody, config);
    const pstnCallControlId = telnyxResponse.data.data.call_control_id;

    console.log(`✅ PSTN leg initiated: ${pstnCallControlId}`);

    // Store this in activeCalls for tracking
    activeCalls.set(pstnCallControlId, {
      status: 'dialing',
      direction: 'outbound',
      sessionId,
      sipUsername,
      from,
      to,
      timestamp: new Date()
    });

    // Save to database
    await Voice.create({
      queue_uuid: pstnCallControlId,
      telnyx_number: from,
      destination_number: to,
      direction: 'outgoing',
      status: 'dialing'
    });

    res.json({
      success: true,
      message: 'Outbound call initiated',
      callControlId: pstnCallControlId,
      sessionId
    });

  } catch (error) {
    console.error('❌ Error placing outbound call:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
      return res.status(error.response.status).json({
        error: 'Telnyx API error',
        details: error.response.data
      });
    }
    res.status(500).json({ error: 'Failed to place outbound call', details: error.message });
  }
});

//============= OUTBOUND CALL WEBHOOK HANDLER ===================
// Handles webhooks for backend-initiated outbound calls
router.post('/outbound-call-webhook', express.json(), async (req, res) => {
  console.log('=== OUTBOUND CALL WEBHOOK ===');
  console.log('Event:', req.body.data.event_type);

  const data = req.body.data;
  const event_type = data.event_type;
  const callControlId = data.payload.call_control_id;
  const state = data.payload.state;

  try {
    // Decode client state
    let clientState = {};
    try {
      if (data.payload.client_state) {
        clientState = JSON.parse(Buffer.from(data.payload.client_state, 'base64').toString('utf-8'));
      }
    } catch (e) {
      console.log('Could not parse client state');
    }

    const { sessionId, sipUsername, stage, pstnCallControlId } = clientState;

    console.log(`Call ID: ${callControlId}, Session: ${sessionId}, Stage: ${stage}, State: ${state}`);

    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API}`
      }
    };

    // PSTN leg answered - now dial the agent
    if (event_type === 'call.answered' && stage === 'pstn') {
      console.log(`✅ PSTN leg answered, dialing agent: ${sipUsername}`);

      // Answer the PSTN leg
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {}, config);

      // Dial the agent's SIP connection
      const agentDialRequest = {
        connection_id: process.env.TELNYX_CONNECTION_ID || '2397473570750989860',
        to: `sip:${sipUsername}@sip.telnyx.com`,
        from: data.payload.from,
        client_state: Buffer.from(JSON.stringify({
          sessionId,
          sipUsername,
          stage: 'agent',
          pstnCallControlId: callControlId
        })).toString('base64'),
        webhook_url: `https://${process.env.APP_HOST}/api/voice/outbound-call-webhook`,
      };

      console.log('Dialing agent:', agentDialRequest.to);

      const agentResponse = await axios.post('https://api.telnyx.com/v2/calls', agentDialRequest, config);
      const agentCallControlId = agentResponse.data.data.call_control_id;

      console.log(`✅ Agent leg initiated: ${agentCallControlId}`);

      // Update activeCalls
      if (activeCalls.has(callControlId)) {
        const callData = activeCalls.get(callControlId);
        callData.agentCallControlId = agentCallControlId;
        callData.status = 'agent_dialing';
      }
    }

    // Agent answered - bridge the calls
    if (event_type === 'call.answered' && stage === 'agent') {
      console.log(`✅ Agent answered, bridging calls: PSTN ${pstnCallControlId} <-> Agent ${callControlId}`);

      // Answer the agent leg
      await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {}, config);

      // Bridge the two calls
      await axios.post(`https://api.telnyx.com/v2/calls/${pstnCallControlId}/actions/bridge`, {
        call_control_id: callControlId
      }, config);

      console.log('✅ Calls bridged successfully');

      // Update status
      if (activeCalls.has(pstnCallControlId)) {
        const callData = activeCalls.get(pstnCallControlId);
        callData.status = 'bridged';
        callData.agentCallControlId = callControlId;
      }

      // Update database
      await Voice.update(
        { status: 'bridged' },
        { where: { queue_uuid: pstnCallControlId } }
      );

      // Emit event for frontend
      callEventEmitter.emitQueueUpdate();
    }

    // Handle hangup
    if (event_type === 'call.hangup') {
      console.log(`Call hangup: ${callControlId}`);

      // Clean up
      if (activeCalls.has(callControlId)) {
        activeCalls.get(callControlId).status = 'ended';
        activeCalls.get(callControlId).endTime = new Date();
      }

      // Update database
      await Voice.update(
        { status: 'ended' },
        { where: { queue_uuid: callControlId } }
      );

      callEventEmitter.emitQueueUpdate();
    }

  } catch (error) {
    console.error('❌ Error in outbound call webhook:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
  }

  res.status(200).send('OK');
});

module.exports = router;
