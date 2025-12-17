// PRISMA VERSION - Auto-converted from Sequelize
// This file uses req.prisma instead of Sequelize models
// All database operations use Prisma Client

import 'dotenv/config';
import express from '#lib/router-shim';
const router = express.Router();
import axios from 'axios';
import { broadcast, broadcastToAgentPrimary, getConnectedAgents } from './websocket.js';
import callEventEmitter from '../utils/eventEmitter.js';
import jwt from 'jsonwebtoken';
import { getHoldMusicBase64 } from '../utils/audioUtils.js';
// import { Telnyx } from 'telnyx'; // Commented out - Telnyx SDK not compatible with Cloudflare Workers

// Track active calls in memory
const activeCalls = new Map();

/**
 * Build Telnyx auth headers.
 * @param {boolean} includeContentType - include JSON content type header
 * @returns {Record<string,string>}
 */
function buildTelnyxHeaders(includeContentType = true) {
  if (!process.env.TELNYX_API) {
    console.error('❌ TELNYX_API environment variable is not defined');
    throw new Error('Missing TELNYX_API environment variable');
  }

  const headers = {
    Authorization: `Bearer ${process.env.TELNYX_API}`
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

/**
 * Answer an incoming call using the Telnyx REST API.
 * @param {string} callControlId
 */
async function answerIncomingCall(callControlId) {
  console.log('🔄 Attempting to answer call via Telnyx REST API:', callControlId);

  try {
    const response = await axios.post(
      `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`,
      {},
      { headers: buildTelnyxHeaders() }
    );

    console.log('✅ Call answered successfully:', {
      callId: callControlId,
      status: response.status
    });
  } catch (error) {
    console.error('❌ Error answering call:', {
      callId: callControlId,
      message: error.message,
      status: error.response?.status,
      errorCode: error.response?.data?.errors?.[0]?.code,
      errorDetail: error.response?.data?.errors?.[0]?.detail
    });
    throw error;
  }
}

// Initialization function disabled for Workers compatibility
// const initializeTelnyxClient = () => {
//   try {
//     console.log('Checking TELNYX_API:', process.env.TELNYX_API ? 'Present (length: ' + process.env.TELNYX_API.length + ')' : 'Missing');
//     if (process.env.TELNYX_API) {
//       console.log('Initializing Telnyx client...');
//       telnyxClient = new Telnyx(process.env.TELNYX_API);
//       console.log('Telnyx client initialized successfully');
//       return true;
//     } else {
//       console.error('TELNYX_API environment variable not found');
//       return false;
//     }
//   } catch (error) {
//     console.error('Telnyx client initialization failed:', error.message);
//     return false;
//   }
// };

// Try to initialize immediately
// initializeTelnyxClient();

//================================================ HELPER FUNCTIONS ================================================
/**
 * Helper function to enqueue a call with optional callback support
 * @param {string} callControlId - The call control ID
 * @param {string} from - Caller number
 * @param {string} to - Called number
 * @param {boolean} enableCallback - Whether to enable queue callback
 * @param {string} direction - Call direction (default: 'incoming')
 * @param {boolean} skipDashboard - Skip displaying in dashboard (for callbacks that will hang up immediately)
 */
async function enqueueCall(
  req,
  callControlId,
  from,
  to,
  enableCallback = false,
  direction = 'incoming',
  skipDashboard = false,
  startPlayback = true
) {
  console.log('📞 ============================================');
  console.log('📞 ENQUEUE CALL FUNCTION CALLED');
  console.log('📞 Call Control ID:', callControlId);
  console.log('📞 From:', from);
  console.log('📞 To:', to);
  console.log('📞 Enable Callback:', enableCallback);
  console.log('📞 Direction:', direction);
  console.log('📞 Skip Dashboard:', skipDashboard);
  console.log('📞 ============================================');

  // Prepare enqueue request with minimal required parameters
  const protocol = process.env.APP_PROTOCOL || 'https';
  const host = process.env.APP_HOST || 'contactcenter.telnyx.solutions';
  const port = process.env.APP_PORT && !['80', '443'].includes(process.env.APP_PORT)
    ? `:${process.env.APP_PORT}`
    : '';
  const holdMusicUrl = `${protocol}://${host}${port}/api/media/queue-music`;

  const enqueuePayload = {
    queue_name: 'General_Queue',
    keep_after_hangup: enableCallback || false,
    continuation: [
      {
        command: {
          name: 'playback',
          params: {
            audio_url: holdMusicUrl
          }
        }
      },
      {
        command: {
          name: 'speak',
          params: {
            voice: 'female',
            language: 'en-US',
            payload: enableCallback
              ? 'All of our agents are helping other callers. Please stay on the line or press 2 if you prefer a callback.'
              : 'All of our agents are helping other callers. Please stay on the line and the next available agent will assist you shortly.'
          }
        }
      }
    ]
  };

  // Enqueue the call
  console.log('📞 Sending enqueue request to Telnyx API...');
  console.log('📞 Call Control ID:', callControlId);
  console.log('📞 Request URL:', `https://api.telnyx.com/v2/calls/${callControlId}/actions/enqueue`);

  const enqueueResponse = await axios.post(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/enqueue`,
    enqueuePayload,
    {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('📊 enqueueResponse:', enqueueResponse);
  console.log('✅ ============================================');
  console.log('✅ ENQUEUE API RESPONSE FROM TELNYX:');
  console.log('✅ Status:', enqueueResponse.status);
  console.log('✅ Response Body (data.data):', JSON.stringify(enqueueResponse.data.data, null, 2));
  console.log('✅ Full Response Body:', JSON.stringify(enqueueResponse.data, null, 2));
  console.log('✅ Call successfully enqueued', enableCallback ? 'with callback support' : '');
  console.log('✅ ============================================');

  // Update call state
  activeCalls.set(callControlId, {
    status: 'enqueued',
    timestamp: new Date(),
    callback_enabled: enableCallback
  });

  // Only create database records and emit events if not skipping dashboard
  if (!skipDashboard) {
    // NOW create database records (Voice, CallSession, CallLeg)
    console.log('💾 Creating database records for enqueued call...');
    try {
      // Upsert Voice record with status='queued' so it appears in queue queries
      await req.prisma.voice.upsert({
        where: { queue_uuid: callControlId },
        create: {
          queue_uuid: callControlId,
          telnyx_number: to,
          destination_number: from,
          direction: direction,
          status: 'queued',
          queue_name: enqueuePayload.queue_name
        },
        update: {
          status: 'queued',
          telnyx_number: to,
          destination_number: from,
          direction: direction,
          queue_name: enqueuePayload.queue_name,
          updatedAt: new Date()
        }
      });
      console.log('✅ Voice record upserted with status=queued');

      // Upsert CallSession
      await req.prisma.callSession.upsert({
        where: { sessionKey: callControlId },
        create: {
          sessionKey: callControlId,
          status: 'queued',
          from_number: from,
          to_number: to,
          direction: direction,
          started_at: new Date()
        },
        update: {
          status: 'queued',
          from_number: from,
          to_number: to,
          direction: direction,
          updatedAt: new Date()
        }
      });
      console.log('✅ CallSession upserted with status=queued');

      // Upsert CallLeg
      await req.prisma.callLeg.upsert({
        where: { call_control_id: callControlId },
        create: {
          call_control_id: callControlId,
          sessionKey: callControlId,
          leg_type: 'customer',
          direction: direction,
          status: 'queued',
          start_time: new Date()
        },
        update: {
          status: 'queued',
          direction: direction,
          start_time: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('✅ CallLeg upserted with status=queued');
    } catch (dbError) {
      console.error('❌ Error creating database records:', dbError);
    }

    // NOW emit NEW_CALL event - call will appear in dashboard
    console.log('📡 ============================================');
    console.log('📡 EMITTING NEW_CALL EVENT TO DASHBOARD');
    console.log('📡 Call Control ID:', callControlId);
    console.log('📡 From:', from);
    console.log('📡 To:', to);
    console.log('📡 Direction:', direction);
    console.log('📡 Status: enqueued');
    console.log('📡 Timestamp:', new Date().toISOString());
    console.log('📡 ============================================');
    callEventEmitter.emitNewCall({
      id: callControlId,
      call_control_id: callControlId,
      from: from,
      to: to,
      direction: direction,
      status: 'enqueued',
      created_at: new Date()
    });
    console.log('📡 NEW_CALL event emitted - call should now appear in dashboard');

    callEventEmitter.emitQueueUpdate(req.env);
  } else {
    console.log('⏭️ Skipping dashboard display - callback will hang up immediately');
  }

  // Only start hold music if not skipping dashboard (callback calls don't need hold music)
  if (!skipDashboard && startPlayback) {
    // Start hold music playback
    console.log('🎵 ============================================');
    console.log('🎵 STARTING HOLD MUSIC PLAYBACK');
    console.log('🎵 Call Control ID:', callControlId);
    console.log('🎵 ============================================');
    try {
      const base64Audio = await getHoldMusicBase64();
      console.log('🎵 Preparing hold music playback...');

      if (!base64Audio) {
        console.error('❌ Hold music base64 unavailable - cannot start playback');
        return;
      }

      console.log('📊 Base64 MP3 size:', Math.round(base64Audio.length / 1024), 'KB');

      const playbackBody = {
        playback_content: base64Audio,
        audio_type: 'mp3',
        loop: 'infinity'
      };

      const playbackResponse = await axios.post(
        `https://api.telnyx.com/v2/calls/${callControlId}/actions/playback_start`,
        playbackBody,
        {
          headers: buildTelnyxHeaders()
        }
      );
      console.log('✅ ============================================');
      console.log('✅ PLAYBACK START API RESPONSE:');
      console.log('✅ Status:', playbackResponse.status);
      console.log('✅ Response data:', JSON.stringify(playbackResponse.data, null, 2));
      console.log('✅ Hold music started for enqueued caller');
      console.log('✅ ============================================');
    } catch (playbackError) {
      console.error('❌ ============================================');
      console.error('❌ ERROR STARTING HOLD MUSIC:');
      console.error('❌ Error message:', playbackError.message);
      console.error('❌ Error response status:', playbackError.response?.status);
      console.error('❌ Error response data:', JSON.stringify(playbackError.response?.data, null, 2));
      console.error('❌ ============================================');
      // Don't fail the enqueue if playback fails
    }
  } else {
    console.log('⏭️ Skipping hold music - callback will hang up immediately');
  }
}

/**
 * Immediately start Telnyx call playback using the start_call_playback endpoint.
 * Ensures callers hear hold music as soon as they choose to stay on the line.
 * @param {string} callControlId
 */
async function startHoldMusicPlayback(callControlId) {
  console.log('🎵 Requesting start_call_playback for call:', callControlId);

  try {
    const base64Audio = await getHoldMusicBase64();

    if (!base64Audio) {
      console.error('❌ Hold music base64 unavailable - cannot start playback');
      return;
    }

    const playbackBody = {
      playback_content: base64Audio,
      audio_type: 'mp3',
      loop: 'infinity'
    };

    const response = await axios.post(
      `https://api.telnyx.com/v2/calls/${callControlId}/actions/playback_start`,
      playbackBody,
      {
        headers: buildTelnyxHeaders()
      }
    );

    console.log('✅ start_call_playback response:', {
      status: response.status,
      data: response.data
    });
  } catch (error) {
    console.error('❌ Failed to start call playback:', {
      callControlId,
      message: error.message,
      status: error.response?.status,
      // Use JSON.stringify to ensure the nested errors array is fully visible in console
      data: JSON.stringify(error.response?.data, null, 2)
    });
  }
}

//================================================ INBOUND CALL WEBHOOK ================================================
// All inbound calls are delivered here initially
router.post('/webhook', express.json(), async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Full webhook body:', JSON.stringify(req.body, null, 2));

  const data = req.body.data;
  const direction = data.payload.direction;

  console.log(`Webhook received: ${data.event_type}, direction: ${direction}, call_control_id: ${data.payload.call_control_id}`);
  console.log('Telnyx REST API key present:', Boolean(process.env.TELNYX_API));

  if (data.event_type === 'call.initiated' && direction === 'incoming') {
    console.log('Processing incoming call.initiated event');

    const callControlId = data.payload.call_control_id;
    const fromNumber = data.payload.from;
    const toNumber = data.payload.to;

    // Track this call as incoming so we can enqueue it when answered
    activeCalls.set(callControlId, {
      status: 'initiated',
      direction: 'incoming',
      timestamp: new Date()
    });

    // DO NOT create Voice, CallSession, or CallLeg records here
    // Wait until after gather selection (press 1 or 2)
    // Records will be created in enqueueCall() after caller chooses option
    console.log('⏸️ Call initiated but not yet saved to DB - waiting for gather selection');

    // Persist initial call records for visibility/reporting
    try {
      const existingVoice = await req.prisma.voice.findFirst({ where: { queue_uuid: callControlId } });
      if (existingVoice) {
        await req.prisma.voice.updateMany({
          where: { queue_uuid: callControlId },
          data: {
            status: 'initiated',
            direction: 'incoming',
            telnyx_number: toNumber,
            destination_number: fromNumber
          }
        });
      } else {
        await req.prisma.voice.create({
          data: {
            queue_uuid: callControlId,
            status: 'initiated',
            direction: 'incoming',
            telnyx_number: toNumber,
            destination_number: fromNumber
          }
        });
      }

      await req.prisma.callSession.upsert({
        where: { sessionKey: callControlId },
        update: {
          status: 'initiated',
          direction: 'incoming',
          from_number: fromNumber,
          to_number: toNumber,
          started_at: new Date()
        },
        create: {
          sessionKey: callControlId,
          status: 'initiated',
          direction: 'incoming',
          from_number: fromNumber,
          to_number: toNumber,
          started_at: new Date()
        }
      });

      await req.prisma.callLeg.upsert({
        where: { call_control_id: callControlId },
        update: {
          status: 'initiated',
          direction: 'incoming',
          start_time: new Date()
        },
        create: {
          call_control_id: callControlId,
          sessionKey: callControlId,
          leg_type: 'customer',
          direction: 'incoming',
          status: 'initiated',
          start_time: new Date()
        }
      });

      console.log('💾 Persisted initiated call state to database for', callControlId);
    } catch (dbError) {
      console.error('❌ Failed to persist initiated call state:', dbError);
    }

    // Check for available agents but still answer and enqueue for now
    try {
      const availableAgent = await req.prisma.user.findFirst({
        where: {
          status: true // status: true means available
        }
      });

      console.log(availableAgent ? `Available agent found: ${availableAgent.sipUsername}` : 'No available agents found');
    } catch (error) {
      console.error('Error finding available agent:', error);
    }

    // Always answer the call first to ensure proper call flow
    try {
      await answerIncomingCall(data.payload.call_control_id);
    } catch (error) {
      console.error('❌ Unable to answer incoming call via REST API');
    }
  }

  if (data.event_type === 'call.answered') {
    const callControlId = data.payload.call_control_id;
    let callState = activeCalls.get(callControlId);

    if (!callState) {
      const fromNumber = data.payload.from;
      const toNumber = data.payload.to;
      const derivedDirection = data.payload.direction || direction || 'incoming';
      callState = {
        status: 'answered',
        direction: derivedDirection,
        timestamp: new Date()
      };
      activeCalls.set(callControlId, callState);
      console.log('ℹ️ No existing call state found on call.answered; created fallback entry:', callState);

      // Ensure we have baseline DB records even if initiated webhook was missed
      try {
        const existingVoice = await req.prisma.voice.findFirst({ where: { queue_uuid: callControlId } });
        if (!existingVoice) {
          await req.prisma.voice.create({
            data: {
              queue_uuid: callControlId,
              status: 'answered',
              direction: derivedDirection,
              telnyx_number: data.payload.to,
              destination_number: data.payload.from
            }
          });
        }

        await req.prisma.callSession.upsert({
          where: { sessionKey: callControlId },
          update: {
            status: 'answered',
            direction: derivedDirection,
            from_number: data.payload.from,
            to_number: data.payload.to,
            started_at: new Date()
          },
          create: {
            sessionKey: callControlId,
            status: 'answered',
            direction: derivedDirection,
            from_number: data.payload.from,
            to_number: data.payload.to,
            started_at: new Date()
          }
        });

        await req.prisma.callLeg.upsert({
          where: { call_control_id: callControlId },
          update: {
            status: 'answered',
            direction: derivedDirection,
            start_time: new Date()
          },
          create: {
            call_control_id: callControlId,
            sessionKey: callControlId,
            leg_type: 'customer',
            direction: derivedDirection,
            status: 'answered',
            start_time: new Date()
          }
        });
      } catch (dbError) {
        console.error('❌ Failed to persist answered call fallback:', dbError);
      }
    }

    const isIncomingCall = callState.direction === 'incoming';
    if (!isIncomingCall) {
      console.log('📞 Call answered but direction is not incoming; skipping enqueue. Direction:', callState.direction);
      return;
    }

    // Update call state to answered for tracking
    activeCalls.set(callControlId, {
      ...callState,
      status: 'answered',
      answeredAt: new Date()
    });

    // Persist answered status to database
    try {
      await req.prisma.voice.updateMany({
        where: { queue_uuid: callControlId },
        data: { status: 'answered' }
      });
      await req.prisma.callSession.updateMany({
        where: { sessionKey: callControlId },
        data: { status: 'answered' }
      });
      await req.prisma.callLeg.updateMany({
        where: { call_control_id: callControlId },
        data: { status: 'answered' }
      });
      console.log('💾 Persisted answered call state to database for', callControlId);
    } catch (dbError) {
      console.error('❌ Failed to update answered call state:', dbError);
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

    // First, confirm the call is established before prompting
    try {
      // Add a short delay to ensure the call leg is fully established before gather
      console.log('📞 Adding 500ms delay before gather prompt...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if queue callback feature is enabled (default to true unless explicitly disabled)
      const callbackFeatureEnabled = process.env.QUEUE_CALLBACK_ENABLED !== 'false';
      console.log('🔔 Queue callback feature enabled:', callbackFeatureEnabled);

      // Update call state to gathering
      activeCalls.set(data.payload.call_control_id, {
        status: 'gathering',
        direction: 'incoming',
        timestamp: new Date()
      });

      // Always play a prompt via gather_using_speak so callers hear messaging immediately
      console.log('🎤 Starting gather_using_speak prompt for caller...');
      const gatherPrompt = callbackFeatureEnabled
        ? 'All of our agents are currently assisting other callers. Press 1 to stay on hold, or press 2 if you would like a callback when an agent becomes available.'
        : 'All of our agents are currently assisting other callers. Press 1 to stay on hold until the next agent is available.';

      const validDigits = callbackFeatureEnabled ? '12' : '1';

      const gatherPayload = {
        payload: gatherPrompt,
        voice: 'female',
        language: 'en-US',
        minimum_digits: 1,
        maximum_digits: 1,
        timeout_millis: 10000,
        valid_digits: validDigits,
        client_state: Buffer.from(JSON.stringify({
          call_control_id: data.payload.call_control_id,
          from: data.payload.from,
          to: data.payload.to,
          direction: 'incoming',
          callbackEnabled: callbackFeatureEnabled,
          timestamp: new Date().toISOString()
        })).toString('base64')
      };

      await axios.post(
        `https://api.telnyx.com/v2/calls/${data.payload.call_control_id}/actions/gather_using_speak`,
        gatherPayload,
        {
          headers: buildTelnyxHeaders()
        }
      );
      console.log('✅ Gather with speak initiated successfully - caller should now hear the prompt');
    } catch (error) {
      console.error('❌ Error during gather/enqueue preparation:', error.message);
      console.error('❌ Error type:', error.type);
      console.error('❌ Error code:', error.response?.data?.errors?.[0]?.code || error.raw?.errors?.[0]?.code);
      console.error('❌ Error detail:', error.response?.data?.errors?.[0]?.detail || error.raw?.errors?.[0]?.detail);

      // Remove from tracking on error
      activeCalls.delete(data.payload.call_control_id);

      if (
        error.type === 'TelnyxInvalidParametersError' ||
        error.response?.data?.errors?.some(err => err.code === '90018') ||
        error.raw?.errors?.[0]?.code === '90018'
      ) {
        console.log('⚠️ Call already ended before enqueuing - customer may have hung up quickly');
      } else {
        console.error('❌ Unexpected gather error - falling back to direct enqueue');
        try {
          await enqueueCall(req, data.payload.call_control_id, data.payload.from, data.payload.to, false, 'incoming');
        } catch (enqueueError) {
          console.error('❌ Fallback enqueue failed:', enqueueError.message);
        }
      }
    }
  }

  if (data.event_type === 'call.enqueued') {
    console.log('🎵 ============================================');
    console.log('🎵 CALL ENQUEUED EVENT RECEIVED');
    console.log('🎵 Call Control ID:', data.payload.call_control_id);
    console.log('🎵 Queue:', data.payload.queue);
    console.log('🎵 Current Position:', data.payload.current_position);
    console.log('🎵 Avg Wait Time:', data.payload.queue_avg_wait_time_secs, 'seconds');
    console.log('🎵 ============================================');

    // Update database with queued status
    try {
      // Update Voice record with queue info
      await req.prisma.voice.updateMany({
        where: { queue_uuid: data.payload.call_control_id },
        data: {
          status: 'queued',
          queue_name: data.payload.queue
        }
      });

      // Update CallSession
      await req.prisma.callSession.updateMany({
        where: { sessionKey: data.payload.call_control_id },
        data: { status: 'queued' }
      });

      // Update CallLeg
      await req.prisma.callLeg.updateMany({
        where: { call_control_id: data.payload.call_control_id },
        data: { status: 'queued' }
      });

      console.log('✅ Database updated: call status set to queued');
    } catch (e) {
      console.error('❌ DB error updating status to queued:', e);
    }

    // Broadcast to WebSocket for real-time updates
    broadcast('NEW_CALL', {
      call: {
        id: data.payload.call_control_id,
        call_control_id: data.payload.call_control_id,
        from: data.payload.from,
        to: data.payload.to,
        direction: data.payload.direction,
        status: 'queued',
        queue: data.payload.queue,
        position: data.payload.current_position,
        created_at: data.occurred_at || new Date().toISOString()
      }
    }, req.env);

    // Emit SSE event
    callEventEmitter.emitNewCall({
      id: data.payload.call_control_id,
      call_control_id: data.payload.call_control_id,
      from: data.payload.from,
      to: data.payload.to,
      direction: data.payload.direction,
      status: 'queued',
      queue: data.payload.queue,
      position: data.payload.current_position,
      created_at: data.occurred_at || new Date().toISOString()
    });

    console.log('📡 Broadcasted NEW_CALL event to frontend');

    callEventEmitter.emitQueueUpdate(req.env);

    // Start hold music playback
    await startHoldMusicPlayback(data.payload.call_control_id);
  }

  // Handle call.dequeued event - remove call from queue display
  if (data.event_type === 'call.dequeued') {
    const callControlId = data.payload.call_control_id;
    console.log('📤 ============================================');
    console.log('📤 CALL DEQUEUED EVENT RECEIVED');
    console.log('📤 Call Control ID:', callControlId);
    console.log('📤 Queue:', data.payload.queue);
    console.log('📤 Queue Position:', data.payload.queue_position);
    console.log('📤 Reason:', data.payload.reason);
    console.log('📤 Wait Time:', data.payload.wait_time_secs, 'seconds');
    console.log('📤 Timestamp:', data.occurred_at);
    console.log('📤 ============================================');

    // Update database - mark as dequeued
    try {
      await req.prisma.voice.updateMany({
        where: { queue_uuid: callControlId },
        data: {
          status: 'dequeued',
          // Store dequeue reason for analytics
          // Note: You may need to add this column to your schema
        }
      });
      await req.prisma.callSession.updateMany({
        where: { sessionKey: callControlId },
        data: { status: 'dequeued' }
      });
      await req.prisma.callLeg.updateMany({
        where: { call_control_id: callControlId },
        data: { status: 'dequeued' }
      });
      console.log('✅ Database updated: call marked as dequeued (reason:', data.payload.reason + ')');
    } catch (e) {
      console.error('❌ DB error updating status to dequeued:', e);
    }

    // Broadcast to remove from queue display
    broadcast('CALL_DEQUEUED', {
      callControlId: callControlId,
      queue: data.payload.queue,
      reason: data.payload.reason,
      wait_time_secs: data.payload.wait_time_secs,
      timestamp: data.occurred_at
    }, req.env);

    // Emit queue update event
    callEventEmitter.emitQueueUpdate(req.env);

    console.log('✅ Call removed from queue display (reason:', data.payload.reason + ')');
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
      await req.prisma.callLeg.updateMany({
        where: { call_control_id: callControlId }, data: {
          status: 'ended',
          end_time: new Date(),
          hangup_cause: data.payload.hangup_cause,
          hangup_source: data.payload.hangup_source,
        }
      });
      await req.prisma.callSession.updateMany({ where: { sessionKey: callControlId }, data: { status: 'ended', ended_at: new Date() } });
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
    broadcast('CALL_HANGUP', hangupData, req.env);

    // Notify queue listeners to remove this call if it was still showing as queued
    broadcast('CALL_DEQUEUED', {
      callControlId,
      queue: data.payload.queue || 'General_Queue',
      reason: data.payload.hangup_cause || 'hangup',
      wait_time_secs: data.payload.wait_time_secs,
      timestamp: data.occurred_at || new Date().toISOString()
    }, req.env);
    callEventEmitter.emitQueueUpdate(req.env);

    // Emit CALL_ENDED event for SSE
    callEventEmitter.emitCallEnded({
      callControlId: data.payload.call_control_id,
      hangupCause: data.payload.hangup_cause,
      hangupSource: data.payload.hangup_source,
      timestamp: new Date()
    });

    // Update database to mark call as completed
    req.prisma.voice.updateMany({
      where: { queue_uuid: data.payload.call_control_id }, data: {
        status: 'completed',
        end_time: new Date()
      }
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
    }, req.env);

    // Mark session active in DB
    try {
      await req.prisma.callSession.updateMany({ where: { sessionKey: callControlId }, data: { status: 'active' } });
    } catch (e) { console.error('DB error marking session active:', e); }
  }

  // Handle call.gather.ended event for callback option selection
  if (data.event_type === 'call.gather.ended') {
    console.log('=== GATHER ENDED ===');
    console.log('Full gather.ended payload:', JSON.stringify(data.payload, null, 2));
    console.log('Digits collected:', data.payload.digits);
    console.log('Status:', data.payload.status);

    const digits = data.payload.digits;
    const callControlId = data.payload.call_control_id;

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
    const direction = clientState.direction || 'incoming';
    const callbackAllowed = clientState.callbackEnabled ?? (process.env.QUEUE_CALLBACK_ENABLED !== 'false');

    try {
      if (digits === '1') {
        // Caller chose to stay on hold (no callback)
        console.log('📞 Caller pressed 1 - staying on hold without callback');
        await startHoldMusicPlayback(callControlId);
        await enqueueCall(req, callControlId, from, to, false, direction, false, false);
      } else if (digits === '2') {
        // Caller chose callback option
        if (!callbackAllowed) {
          console.log('ℹ️ Callback option disabled - treating selection as stay on hold');
          await startHoldMusicPlayback(callControlId);
          await enqueueCall(req, callControlId, from, to, false, direction, false, false);
        } else {
          console.log('🔔 Caller pressed 2 - enabling callback');

          await axios.post(
            `https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`,
            {
              payload: 'Thank you. We will call you back when an agent becomes available. Goodbye.',
              voice: 'female',
              language: 'en-US'
            },
            { headers: buildTelnyxHeaders() }
          );

          await new Promise(resolve => setTimeout(resolve, 3000));

          await enqueueCall(req, callControlId, from, to, true, direction, true);
        }
      } else if (data.payload.status === 'no_input' || data.payload.status === 'invalid') {
        // No input or invalid input - default to staying on hold
        console.log('⚠️ No valid input received - defaulting to hold without callback');
        await startHoldMusicPlayback(callControlId);
        await enqueueCall(req, callControlId, from, to, false, direction, false, false);
      } else {
        console.log('⚠️ Unexpected digits received:', digits, '- defaulting to hold without callback');
        await startHoldMusicPlayback(callControlId);
        await enqueueCall(req, callControlId, from, to, false, direction, false, false);
      }
    } catch (error) {
      console.error('❌ Error handling gather ended:', error);
      console.error('Error details:', error.response?.data || error.message);

      try {
        const fallbackDirection = clientState?.direction || 'incoming';
        await startHoldMusicPlayback(callControlId);
        await enqueueCall(req, callControlId, data.payload.from, data.payload.to, false, fallbackDirection, false, false);
      } catch (enqueueError) {
        console.error('❌ Failed to enqueue call as fallback:', enqueueError.message);
      }
    }

    res.status(200).send('OK');
    return;
  }

  // Handle call.playback.started event
  if (data.event_type === 'call.playback.started') {
    console.log('🎵 ============================================');
    console.log('🎵 PLAYBACK STARTED WEBHOOK RECEIVED');
    console.log('🎵 Call Control ID:', data.payload.call_control_id);
    console.log('🎵 Media Name:', data.payload.media_name);
    console.log('🎵 Full payload:', JSON.stringify(data.payload, null, 2));
    console.log('🎵 ============================================');
    res.status(200).send('OK');
    return;
  }

  // Handle call.playback.ended event
  if (data.event_type === 'call.playback.ended') {
    console.log('🎵 ============================================');
    console.log('🎵 PLAYBACK ENDED WEBHOOK RECEIVED');
    console.log('🎵 Call Control ID:', data.payload.call_control_id);
    console.log('🎵 Media Name:', data.payload.media_name);
    console.log('🎵 Full payload:', JSON.stringify(data.payload, null, 2));
    console.log('🎵 ============================================');
    res.status(200).send('OK');
    return;
  }

  res.status(200).send('OK');
});

//================================================ GET QUEUE STATUS ================================================
// Fetch queued calls from database (not Telnyx API)
// This allows calls to persist across page refreshes
router.get('/queue', async (req, res) => {
  try {
    console.log('📊 Fetching queued calls from database...');

    // Get all calls with status 'queued' from Voice table
    const queuedCalls = await req.prisma.voice.findMany({
      where: {
        status: 'queued',
        direction: 'incoming'
      },
      orderBy: {
        createdAt: 'asc'  // FIFO - oldest first
      }
    });

    console.log('📊 Found', queuedCalls.length, 'queued calls in database');

    // Format calls to match what frontend expects
    const incomingCalls = queuedCalls.map((call, index) => ({
      id: call.queue_uuid,
      call_control_id: call.queue_uuid,
      from: call.destination_number || 'Unknown',
      to: call.telnyx_number || '',
      created_at: call.createdAt.toISOString(),
      direction: call.direction || 'incoming',
      status: 'queued',
      queue: call.queue_name || 'General_Queue',
      position: index + 1  // 1-indexed position
    }));

    console.log('📊 Returning', incomingCalls.length, 'queued calls to frontend');

    // Return in format frontend expects
    res.json({
      incomingCalls: incomingCalls,
      count: incomingCalls.length
    });
  } catch (error) {
    console.error('❌ Error fetching queued calls from database:', error);
    res.status(500).json({
      message: 'Failed to fetch queue data',
      error: error.message,
      incomingCalls: [],
      count: 0
    });
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
  console.log('APP_PROTOCOL:', process.env.APP_PROTOCOL);

  const protocol = process.env.APP_PROTOCOL || 'https';
  const host = process.env.APP_HOST || 'contactcenter.telnyx.solutions';
  const port = process.env.APP_PORT && !['80', '443'].includes(process.env.APP_PORT)
    ? `:${process.env.APP_PORT}`
    : '';

  // Use simple webhook URL without forcing a port Cloudflare can't serve
  const webhookUrl = `${protocol}://${host}${port}/api/voice/outbound-queue`;
  console.log('Constructed webhook URL:', webhookUrl);

  // Validate required parameters
  if (!sipUsername) {
    console.error('Missing sipUsername parameter');
    return res.status(400).json({ error: 'sipUsername is required' });
  }

  try {
    // Immediately mark the first queued call as 'accepting' to remove it from queue display
    const firstQueuedCall = await req.prisma.voice.findFirst({
      where: {
        status: 'queued',
        direction: 'incoming'  // Only accept inbound calls from queue
      },
      orderBy: { createdAt: 'asc' }
    });

    let customerCallId = null;

    if (firstQueuedCall) {
      customerCallId = firstQueuedCall.queue_uuid;  // Store the customer call ID for link_to
      await req.prisma.voice.updateMany({ where: { uuid: firstQueuedCall.uuid }, data: { status: 'accepting', accept_agent: sipUsername } });
      console.log('✅ Marked call as accepting:', firstQueuedCall.queue_uuid);
      console.log('✅ Customer call ID for linking:', customerCallId);

      // Emit queue update to remove from display immediately
      callEventEmitter.emitQueueUpdate(req.env);
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
        await req.prisma.voice.updateMany({ where: { uuid: firstQueuedCall.uuid }, data: { status: 'queued', accept_agent: null } });
        console.log('⚠️ Rolled back call status to queued due to dial error');
        callEventEmitter.emitQueueUpdate(req.env);
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
        await req.prisma.voice.updateMany({
          where: { queue_uuid: customerCallId }, data: {
            bridge_uuid: agentCallId,
            accept_agent: sipUsername,
            status: 'active'
          }
        });
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
    }, req.env);

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
        let existingCustomerLeg = await req.prisma.callLeg.findFirst({
          where: {
            call_control_id: customerCallId,
            leg_type: 'customer'
          }
        });

        // If not found by exact match, the customerCallId might be the call_leg_id
        // Try to find by looking for any customer leg that matches the queue call
        if (!existingCustomerLeg) {
          console.log('[call.bridged] Customer leg not found by call_control_id, searching Voice table...');
          const voiceRecord = await req.prisma.voice.findFirst({
            where: {
              OR: [
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
            existingCustomerLeg = await req.prisma.callLeg.findFirst({
              where: {
                call_control_id: voiceRecord.queue_uuid,
                leg_type: 'customer'
              }
            });
          }
        }

        if (!existingCustomerLeg) {
          console.error('[call.bridged] ⚠️ Could not find existing customer leg - searching all recent legs...');
          const recentLegs = await req.prisma.callLeg.findMany({
            where: { leg_type: 'customer' },
            orderBy: { createdAt: 'desc' },
            take: 5
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
          await req.prisma.callSession.updateMany({ where: { sessionKey: correctSessionKey }, data: { status: 'active' } });

          // Create agent leg using the CORRECT sessionKey
          const agentLeg = await req.prisma.callLeg.upsert({
            where: { call_control_id: agentCallId }, create: {
              sessionKey: correctSessionKey,  // Use the correct sessionKey from customer leg
              leg_type: 'agent',
              direction: 'incoming',
              status: 'active',
              start_time: new Date(),
              accepted_by: sipUsername
            }, update: {}
          });

          console.log('[call.bridged] CallLeg findOrCreate result:', {
            created,
            agentLegId: agentLeg.id,
            call_control_id: agentLeg.call_control_id,
            accepted_by: agentLeg.accepted_by,
            status: agentLeg.status,
            sessionKey: agentLeg.sessionKey
          });

          await req.prisma.callLeg.updateMany({ where: { call_control_id: agentCallId }, data: { status: 'active' } });
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
    console.log('Full gather.ended payload:', JSON.stringify(data.payload, null, 2));
    console.log('Digits collected:', data.payload.digits);
    console.log('Status:', data.payload.status);

    const digits = data.payload.digits;
    const callControlId = data.payload.call_control_id;

    // Process the gather result asynchronously
    (async () => {
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
        const direction = clientState.direction || 'incoming';

        if (digits === '1') {
          // Caller chose to stay on hold (no callback)
          console.log('📞 Caller pressed 1 - staying on hold without callback');
          await enqueueCall(req, callControlId, from, to, false, direction);
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

          // Enqueue with callback enabled, but skip dashboard display since we'll hang up immediately
          await enqueueCall(req, callControlId, from, to, true, direction, true);

          // Hangup the current call since they'll receive a callback
          // await axios.post(
          //   `https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`,
          //   {},
          //   {
          //     headers: {
          //       'Authorization': `Bearer ${process.env.TELNYX_API}`,
          //       'Content-Type': 'application/json'
          //     }
          //   }
          // );
          // console.log('✅ Call hung up - callback will be initiated after timeout');
        } else if (data.payload.status === 'no_input' || data.payload.status === 'invalid') {
          // No input or invalid input - default to staying on hold
          console.log('⚠️ No valid input received - defaulting to hold without callback');
          await enqueueCall(req, callControlId, from, to, false, direction);
        } else {
          console.log('⚠️ Unexpected digits received:', digits, '- defaulting to hold without callback');
          await enqueueCall(req, callControlId, from, to, false, direction);
        }

      } catch (error) {
        console.error('❌ Error handling gather ended:', error);
        console.error('Error details:', error.response?.data || error.message);

        // On error, try to enqueue without callback as fallback
        try {
          const fallbackDirection = clientState?.direction || 'incoming';
          await enqueueCall(req, callControlId, data.payload.from, data.payload.to, false, fallbackDirection);
        } catch (enqueueError) {
          console.error('❌ Failed to enqueue call as fallback:', enqueueError.message);
        }
      }
    })(); // End async function

    // Send response immediately to Telnyx
    res.status(200).send('OK');
  } else if (event_type === 'call.playback.started') {
    console.log('🎵 ============================================');
    console.log('🎵 PLAYBACK STARTED WEBHOOK RECEIVED');
    console.log('🎵 Call Control ID:', data.payload.call_control_id);
    console.log('🎵 Media Name:', data.payload.media_name);
    console.log('🎵 Full payload:', JSON.stringify(data.payload, null, 2));
    console.log('🎵 ============================================');
    res.status(200).send('OK');
  } else if (event_type === 'call.playback.ended') {
    console.log('🎵 ============================================');
    console.log('🎵 PLAYBACK ENDED WEBHOOK RECEIVED');
    console.log('🎵 Call Control ID:', data.payload.call_control_id);
    console.log('🎵 Media Name:', data.payload.media_name);
    console.log('🎵 Full payload:', JSON.stringify(data.payload, null, 2));
    console.log('🎵 ============================================');
    res.status(200).send('OK');
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
      await req.prisma.voice.create({
        data: {
          queue_uuid: payload.call_control_id,
          telnyx_number: payload.to,
          destination_number: payload.from,
          direction: 'callback',
          queue_name: 'General_Queue'
        }
      });

    } else if (event_type === 'call.answered') {
      console.log('📞 Queue callback call answered by customer');

      // Create CallSession and CallLeg for callback
      const sessionKey = payload.call_control_id;
      await req.prisma.callSession.upsert({
        where: { sessionKey }, create: {
          status: 'queued',
          from_number: payload.from,
          to_number: payload.to,
          direction: 'callback',
          started_at: new Date(),
        }, update: {}
      });

      await req.prisma.callLeg.upsert({
        where: { call_control_id: sessionKey }, create: {
          sessionKey,
          leg_type: 'customer',
          direction: 'callback',
          status: 'ringing',
          start_time: new Date(),
        }, update: {}
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
      await req.prisma.voice.updateMany({
        where: { queue_uuid: payload.call_control_id }, data: {
          status: 'completed',
          end_time: new Date()
        }
      });

      // Clean up session
      await req.prisma.callSession.updateMany({
        where: { sessionKey: payload.call_control_id }, data: {
          status: 'ended',
          ended_at: new Date()
        }
      });

      await req.prisma.callLeg.updateMany({
        where: { call_control_id: payload.call_control_id }, data: {
          status: 'ended',
          end_time: new Date(),
          hangup_cause: payload.hangup_cause,
          hangup_source: payload.hangup_source
        }
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
    let targetAgent = await req.prisma.user.findFirst({ where: { sipUsername: sipUsername } });

    // If not found by sipUsername, try by username
    if (!targetAgent) {
      targetAgent = await req.prisma.user.findFirst({ where: { username: sipUsername } });
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
      const agentLeg = await req.prisma.callLeg.findFirst({ where: { call_control_id: callControlId } });

      if (!agentLeg) {
        console.error('Agent leg not found for callControlId:', callControlId);
        return res.status(404).json({ error: 'Agent call leg not found' });
      }

      sessionKey = agentLeg.sessionKey;
      currentAgentCallId = callControlId;

      console.log('Found agent leg, sessionKey:', sessionKey);

      // Step 2: Find the customer (PSTN) leg using the same sessionKey
      const customerLeg = await req.prisma.callLeg.findFirst({
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
      const session = await req.prisma.callSession.findFirst({ where: { sessionKey: sessionKey } });
      callOrigin = session?.direction || 'unknown';
    } else if (outboundCCID) {
      // Legacy handling for outbound WebRTC calls
      // outboundCCID is the WebRTC leg, we need to find the PSTN leg
      console.log('Using legacy outboundCCID parameter');

      const callData = await req.prisma.voice.findFirst({ where: { queue_uuid: outboundCCID } });

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
    await req.prisma.voice.updateMany({
      where: { queue_uuid: sessionKey }, data: {
        transfer_agent_call_id: newAgentCallId,
        transfer_status: 'dialing',
        transfer_to_agent: sipUsername
      }
    });

    // Also mark the old agent leg as transferring
    await req.prisma.callLeg.updateMany({
      where: { call_control_id: currentAgentCallId }, data: {
        status: 'ended',
        end_time: new Date(),
        hangup_cause: 'TRANSFER_INITIATED'
      }
    });

    // Broadcast transfer initiated event to all agents (for general awareness)
    broadcast('TRANSFER_INITIATED', {
      pstnCallId: pstnCallId,
      currentAgentCallId: currentAgentCallId,
      newAgentCallId: newAgentCallId,
      transferToAgent: sipUsername,
      callOrigin: callOrigin
    }, req.env);

    // Send targeted notification to the MAIN/PRIMARY device of the receiving agent
    console.log(`Sending targeted transfer notification to PRIMARY device of agent: ${sipUsername}`);
    const targetedSuccess = broadcastToAgentPrimary(sipUsername, 'INCOMING_TRANSFER', {
      pstnCallId: pstnCallId,
      currentAgentCallId: currentAgentCallId,
      newAgentCallId: newAgentCallId,
      fromAgent: 'current_agent',
      callerId: callerId,
      callOrigin: callOrigin
    }, req.env);

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
      await req.prisma.voice.updateMany({
        where: { queue_uuid: sessionKey }, data: {
          bridge_uuid: newAgentCallId,
          transfer_status: 'completed',
          accept_agent: transferToAgent
        }
      });

      // Update CallLeg records
      try {
        // Create new agent leg
        await req.prisma.callLeg.upsert({
          where: { call_control_id: newAgentCallId }, create: {
            sessionKey: sessionKey,
            leg_type: 'agent',
            direction: 'incoming',
            status: 'active',
            start_time: new Date(),
            accepted_by: transferToAgent
          }, update: {}
        });

        // Mark as active
        await req.prisma.callLeg.updateMany({ where: { call_control_id: newAgentCallId }, data: { status: 'active' } });

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
      }, req.env);

      // Send targeted completion notification to the receiving agent's primary device
      broadcastToAgentPrimary(transferToAgent, 'TRANSFER_ACCEPTED', {
        pstnCallId: pstnCallId,
        newAgentCallId: newAgentCallId,
        sessionKey: sessionKey,
        status: 'completed',
        action: 'call_connected'
      }, req.env);

      console.log('✅ Transfer completed successfully');

    } else if (event_type === 'call.hangup') {
      const hangupCause = payload.hangup_cause;
      console.log('❌ Transfer failed - new agent did not answer:', hangupCause);

      // Update database to reflect failed transfer
      await req.prisma.voice.updateMany({
        where: { queue_uuid: sessionKey }, data: {
          transfer_status: 'failed',
          transfer_agent_call_id: null
        }
      });

      // Revert the old agent leg status if still exists
      try {
        await req.prisma.callLeg.updateMany({
          where: { call_control_id: currentAgentCallId }, data: {
            status: 'active',
            hangup_cause: null
          }
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
      }, req.env);

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
    req.prisma.voice.updateMany({
      status: 'completed',
      end_time: new Date()
    }, {
      where: {
        OR: [
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
    const user = await req.prisma.user.findFirst({ where: { username: decoded.username } });
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
    const allAgentLegs = await req.prisma.callLeg.findMany({
      where: { leg_type: 'agent' },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log('[my-active-session] All recent agent legs in DB:', allAgentLegs.map(leg => ({
      id: leg.id,
      call_control_id: leg.call_control_id,
      accepted_by: leg.accepted_by,
      status: leg.status,
      createdAt: leg.createdAt
    })));

    // Find the most recent leg for this agent that's not ended
    const agentLeg = await req.prisma.callLeg.findFirst({
      where: {
        accepted_by: sipUsername,
        status: { not: 'ended' }  // Not equal to 'ended' - allows any active status
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('[my-active-session] Found agent leg:', agentLeg ? {
      id: agentLeg.id,
      call_control_id: agentLeg.call_control_id,
      status: agentLeg.status,
      leg_type: agentLeg.leg_type,
      sessionKey: agentLeg.sessionKey
    } : null);

    if (!agentLeg) return res.json({ session: null });

    const session = await req.prisma.callSession.findFirst({ where: { sessionKey: agentLeg.sessionKey } });
    const legs = await req.prisma.callLeg.findMany({ where: { sessionKey: agentLeg.sessionKey } });

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

export default router;
