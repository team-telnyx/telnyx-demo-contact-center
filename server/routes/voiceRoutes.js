import express from 'express';
import { Op } from 'sequelize';
import { getOrgTelnyxClient, getWebhookBaseUrl } from '../src/services/org-telnyx.js';
import Voice from '../models/Voice.js';
import User from '../models/User.js';
import CallRecord from '../models/CallRecord.js';
import { broadcast, sendToUser } from './websocket.js';
import * as ivrEngine from '../src/services/ivr-engine.js';
import { holdMusicCache } from '../src/services/ivr-engine.js';
import { authenticate } from '../src/middleware/auth.js';
import { routeCallToAgent, routeToNextAgent, routeQueuedCallsToAgent } from '../src/services/auto-route.js';
import { broadcastPush } from './pushRoutes.js';

const router = express.Router();

// ── Transcription agent lookup for outbound calls (inbound uses Voice records) ──
const transcriptionAgentMap = new Map();

// ── Shared helpers for agent status management ──

async function setAgentBusy(agentIdentifier) {
  const agent = await User.findOne({ where: { [Op.or]: [{ sipUsername: agentIdentifier }, { username: agentIdentifier }] } });
  if (!agent || agent.status === 'busy') return;
  agent.status = 'busy';
  await agent.save();
  console.log(`[voice] agent ${agent.username} → busy`);
  broadcast('AGENT_STATUS_CHANGED', {
    username: agent.username, status: 'busy',
    firstName: agent.firstName, lastName: agent.lastName,
    assignedQueue: agent.assignedQueue,
  });
}

async function setAgentOnline(agentIdentifier) {
  const agent = await User.findOne({ where: { [Op.or]: [{ sipUsername: agentIdentifier }, { username: agentIdentifier }] } });
  if (!agent || agent.status !== 'busy') return;
  agent.status = 'online';
  await agent.save();
  console.log(`[voice] agent ${agent.username} → online`);
  broadcast('AGENT_STATUS_CHANGED', {
    username: agent.username, status: 'online',
    firstName: agent.firstName, lastName: agent.lastName,
    assignedQueue: agent.assignedQueue,
  });
  routeQueuedCallsToAgent(agent.sipUsername).catch(err =>
    console.error('[voice] Error routing queued calls:', err.message)
  );
}

async function safeHangup(telnyx, callControlId, label) {
  try {
    await telnyx.calls.actions.hangup(callControlId);
    console.log(`[${label}] Hung up ${callControlId}`);
  } catch (err) {
    // Ignore 422 "call already ended" — race conditions between legs
    if (!err.message?.includes('90018')) {
      console.error(`[${label}] Error hanging up ${callControlId}:`, err.message);
    }
  }
}

//================================================ INBOUND CALL WEBHOOK — IVR ENGINE + FALLBACK ================================================

async function handleCallInitiated(telnyx, data, callControlId) {
  await Voice.create({
    queue_uuid: callControlId,
    telnyx_number: data.payload.to,
    destination_number: data.payload.from,
    direction: data.payload.direction,
  }).catch((error) => console.error('Error saving call to database:', error));

  CallRecord.create({
    telnyxCallControlId: callControlId,
    direction: 'inbound',
    fromNumber: data.payload.from,
    toNumber: data.payload.to,
    status: 'queued',
    startedAt: new Date(),
  }).catch((error) => console.error('Error creating call record:', error));

  const telnyxNumber = data.payload.to;
  const session = await ivrEngine.startSession(callControlId, telnyxNumber);

  if (session) {
    console.log(`[IVR] Flow started for ${telnyxNumber}, call ${callControlId}`);
  } else {
    console.log(`[Default] No IVR flow for ${telnyxNumber}, using default queue`);
    try {
      await telnyx.calls.actions.answer(callControlId);
    } catch (err) {
      // Caller may have hung up before we could answer
      console.log(`[Default] Could not answer ${callControlId}: ${err.message}`);
    }
  }
}

async function handleCallAnswered(telnyx, data, callControlId) {
  CallRecord.update(
    { status: 'active', answeredAt: new Date() },
    { where: { telnyxCallControlId: callControlId } }
  ).catch(() => {});

  try {
    if (ivrEngine.hasSession(callControlId)) {
      await ivrEngine.handleMediaEnded(callControlId);
    } else {
      await telnyx.calls.actions.enqueue(callControlId, { queue_name: 'General_Queue' });
    }
  } catch (err) {
    console.log(`[webhook] call.answered — call ${callControlId} no longer active: ${err.message}`);
  }
}

async function handleCallEnqueued(telnyx, data, callControlId) {
  const queueName = data.payload.queue || 'General_Queue';
  broadcast('NEW_CALL', data);
  broadcastPush({
    title: 'Incoming Call',
    body: `Call from ${data.payload.from || 'Unknown'} in ${queueName}`,
    tag: 'call-' + callControlId,
    url: '/phone',
  }).catch(err => console.error('[Push] broadcastPush error:', err));
  console.log('Call Enqueued:', callControlId, 'Queue:', queueName);

  await Voice.update(
    { queue_name: queueName },
    { where: { queue_uuid: callControlId } }
  ).catch((error) => console.error('Error saving call to database:', error));

  const routed = await routeCallToAgent(callControlId);
  if (!routed) {
    const cached = holdMusicCache.get(callControlId);
    if (cached && cached.expires > Date.now()) {
      await telnyx.calls.actions.startPlayback(callControlId, {
        audio_url: cached.url,
      });
    }
  }
}

async function handleMediaEnded(callControlId) {
  if (ivrEngine.hasSession(callControlId)) {
    await ivrEngine.handleMediaEnded(callControlId);
  }
}

async function handleGatherEnded(telnyx, data, callControlId) {
  const digits = data.payload.digits;
  if (ivrEngine.hasSession(callControlId) && digits) {
    const handled = await ivrEngine.handleGatherResult(callControlId, digits);
    if (!handled) {
      console.log(`[IVR] No route for digit "${digits}", hanging up`);
      await telnyx.calls.actions.hangup(callControlId);
    }
  }
}

async function handleCallBridged(data, callControlId) {
  const voiceRecord = await Voice.findOne({
    where: { [Op.or]: [{ queue_uuid: callControlId }, { bridge_uuid: callControlId }] },
  });
  if (voiceRecord?.accept_agent && !voiceRecord?.transfer_agent) {
    await setAgentBusy(voiceRecord.accept_agent);

    // Start live transcription on the PSTN leg using Deepgram
    const pstnLeg = voiceRecord.queue_uuid;
    if (pstnLeg) {
      try {
        await telnyx.calls.actions.transcriptionStart(pstnLeg, {
          language: 'en',
          transcription_engine: 'Deepgram',
          transcription_model: 'flux',
          interim_results: true,
          client_state: Buffer.from('live-transcription').toString('base64'),
        });
        console.log(`[transcription] Started Deepgram transcription on PSTN leg ${pstnLeg} for agent ${voiceRecord.accept_agent}`);
      } catch (err) {
        console.error(`[transcription] Failed to start on ${pstnLeg}:`, err.message);
      }
    }
  }
}

async function handleTranscriptionReport(data, callControlId) {
  const td = data.payload.transcription_data;
  if (!td) return;

  // Find agent — Voice record (inbound) or fallback map (outbound)
  const voiceRecord = await Voice.findOne({
    where: { [Op.or]: [{ queue_uuid: callControlId }, { bridge_uuid: callControlId }] },
  });
  const agent = voiceRecord?.accept_agent || transcriptionAgentMap.get(callControlId);
  if (!agent) return;

  sendToUser(agent, 'TRANSCRIPT_UPDATE', {
    callControlId,
    transcript: td.transcript || '',
    isInterim: td.is_final === false,
    confidence: td.confidence || null,
    timestamp: new Date().toISOString(),
  });
}

async function handleCallHangup(data, callControlId) {
  // Notify agent that transcription ended
  const voiceRecord = await Voice.findOne({
    where: { [Op.or]: [{ queue_uuid: callControlId }, { bridge_uuid: callControlId }] },
  });
  const agent = voiceRecord?.accept_agent || transcriptionAgentMap.get(callControlId);
  if (agent) {
    sendToUser(agent, 'TRANSCRIPT_ENDED', { callControlId });
  }
  transcriptionAgentMap.delete(callControlId);

  ivrEngine.endSession(callControlId);

  CallRecord.update(
    {
      status: data.payload.hangup_cause === 'normal_clearing' ? 'completed' : 'missed',
      endedAt: new Date(),
      agentUsername: voiceRecord?.accept_agent || null,
      queueName: voiceRecord?.queue_name || null,
    },
    { where: { telnyxCallControlId: callControlId } }
  ).catch(() => {});

  // If agent leg is ringing/active (bridge_uuid), hang it up — caller abandoned
  if (voiceRecord?.bridge_uuid) {
    let telnyx;
    try { telnyx = await getOrgTelnyxClient(); } catch { /* ignore */ }
    if (telnyx) {
      // await safeHangup(telnyx, voiceRecord.bridge_uuid, 'webhook-caller-hangup');
    }
  }

  // If agent was busy on this call, set them back to online
  if (voiceRecord?.accept_agent) {
    await setAgentOnline(voiceRecord.accept_agent);
  }

  // Clean up voice records
  await Voice.destroy({ where: { queue_uuid: callControlId } }).catch(() => {});
  await Voice.destroy({ where: { bridge_uuid: callControlId } }).catch(() => {});
}

const webhookHandlers = {
  'call.initiated': (telnyx, data, ccid) => data.payload.direction === 'incoming' ? handleCallInitiated(telnyx, data, ccid) : null,
  'call.answered': handleCallAnswered,
  'call.enqueued': handleCallEnqueued,
  'call.bridged': (telnyx, data, ccid) => handleCallBridged(data, ccid),
  'call.speak.ended': (telnyx, data, ccid) => handleMediaEnded(ccid),
  'call.playback.ended': (telnyx, data, ccid) => handleMediaEnded(ccid),
  'call.gather.ended': handleGatherEnded,
  'call.hangup': (telnyx, data, ccid) => handleCallHangup(data, ccid),
  'call.transcription.report': (telnyx, data, ccid) => handleTranscriptionReport(data, ccid),
};

router.post('/webhook', express.json(), async (req, res) => {
  const data = req.body.data;
  const callControlId = data.payload.call_control_id;

  try {
    const handler = webhookHandlers[data.event_type];
    if (handler) {
      const telnyx = await getOrgTelnyxClient();
      await handler(telnyx, data, callControlId);
    }
  } catch (error) {
    console.error(`[webhook] Error handling ${data.event_type}:`, error.message);
  }

  res.status(200).send('OK');
});

router.get('/queue', async (req, res) => {
  try {
    const telnyx = await getOrgTelnyxClient();
    const response = await telnyx.queues.calls.list('General_Queue');
    res.json(response);
  } catch (error) {
    // If queue doesn't exist yet or is empty, return empty array
    if (error.status === 404) {
      return res.json({ data: [] });
    }
    console.error('Error retrieving queue calls:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

//================================================ AGENT ACCEPT CALL FROM QUEUE ================================================

// Start transcription on an outbound call leg (called from softphone when call goes ACTIVE)
router.post('/transcription/start', authenticate, express.json(), async (req, res) => {
  const { callControlId } = req.body;
  const sipUsername = req.user.sipUsername;

  if (!callControlId) {
    return res.status(400).json({ error: 'callControlId is required' });
  }

  try {
    const telnyx = await getOrgTelnyxClient();

    transcriptionAgentMap.set(callControlId, sipUsername);

    await telnyx.calls.actions.transcriptionStart(callControlId, {
      language: 'en',
      transcription_engine: 'Deepgram',
      transcription_model: 'flux',
      interim_results: true,
      client_state: Buffer.from('live-transcription').toString('base64'),
    });

    console.log(`[transcription] Started Deepgram Flux on outbound leg ${callControlId} for agent ${sipUsername}`);
    res.json({ success: true, callControlId });
  } catch (error) {
    transcriptionAgentMap.delete(callControlId);
    console.error('[transcription] Failed to start:', error.message);
    res.status(500).json({ error: 'Failed to start transcription' });
  }
});

// Stop transcription on a call leg
router.post('/transcription/stop', authenticate, express.json(), async (req, res) => {
  const { callControlId } = req.body;

  if (!callControlId) {
    return res.status(400).json({ error: 'callControlId is required' });
  }

  try {
    const telnyx = await getOrgTelnyxClient();
    await telnyx.calls.actions.transcriptionStop(callControlId);
    transcriptionAgentMap.delete(callControlId);
    console.log(`[transcription] Stopped on ${callControlId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[transcription] Failed to stop:', error.message);
    res.status(500).json({ error: 'Failed to stop transcription' });
  }
});

router.post('/accept-call', express.json(), async (req, res) => {
  const { sipUsername, callControlId, callerId } = req.body;

  try {
    const telnyx = await getOrgTelnyxClient();
    const webhookBase = await getWebhookBaseUrl();
    const webhookUrlWithParam = `${webhookBase}/api/voice/outbound?callControlId_Bridge=${encodeURIComponent(callControlId)}`;
    const agent = await User.findOne({ where: { sipUsername } });
    const dialResponse = await telnyx.calls.dial({
      connection_id: agent?.appConnectionId,
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: callerId,
      link_to: callControlId,
      webhook_url: webhookUrlWithParam,
      timeout_secs: 30,
    });

    // Store bridge_uuid immediately so caller hangup can cancel this leg
    const agentCallControlId = dialResponse?.data?.call_control_id;
    const updateFields = { accept_agent: sipUsername };
    if (agentCallControlId) {
      updateFields.bridge_uuid = agentCallControlId;
    }
    await Voice.update(updateFields, { where: { queue_uuid: callControlId } });
    console.log(`Call Dialed to ${sipUsername} (bridge_uuid: ${agentCallControlId})`);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error during transfer or bridging call:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/outbound', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const callControl = req.body.data.payload.call_control_id;
  const callControlId_Bridge = req.query.callControlId_Bridge;
  const hangup_source = req.body.data.payload.hangup_source;
  const clientState = req.body.data.payload.client_state;
  const sipcode = req.body.data.payload.sip_hangup_cause;
  let telnyx;
  try { telnyx = await getOrgTelnyxClient(); } catch (err) {
    console.error('[outbound] Telnyx client unavailable:', err.message);
    return res.status(200).send('OK');
  }

  if (event_type === 'call.answered') {
    // Agent answered — bridge the caller leg to the agent leg
    try {
      await telnyx.calls.actions.bridge(callControlId_Bridge, {
        call_control_id_to_bridge_with: callControl, park_after_unbridge: 'self', hold_after_unbridge: false
      });
      // Confirm bridge_uuid (may already be set from dial response)
      await Voice.update(
        { bridge_uuid: callControl },
        { where: { queue_uuid: callControlId_Bridge } }
      );
      const voiceRecord = await Voice.findOne({ where: { queue_uuid: callControlId_Bridge } });
      if (voiceRecord?.accept_agent) await setAgentBusy(voiceRecord.accept_agent);
      console.log('[outbound] Call Bridged');
    } catch (error) {
      console.error('[outbound] Error bridging:', error.message);
    }
  } else if (event_type === 'call.hangup') {
    const hangupCause = req.body.data.payload.hangup_cause;
    if (sipcode === '480' || sipcode === '486' || sipcode === '487' || hangupCause === 'timeout' || hangupCause === 'originator_cancel') {
      // Agent declined/unavailable/timeout — route to next agent

      // Check client_state for warm transfer
      const decodedClientState = clientState ? Buffer.from(clientState, 'base64').toString() : '';
      if (decodedClientState === 'Warm Transfer') {
        console.log('[outbound] Warm transfer target declined/unavailable');
        broadcast('WARM_TRANSFER_FAILED', { reason: 'Target agent declined or unavailable' });
        broadcast('OutboundCCID', null);
        await Voice.destroy({ where: { queue_uuid: callControlId_Bridge } }).catch(() => {});
        return res.status(200).send('OK');
      }

      console.log(`[outbound] Agent unavailable (SIP ${sipcode}), routing to next agent`);
      try {
        await routeToNextAgent(callControlId_Bridge);
      } catch (routeErr) {
        console.error('[outbound] Error routing to next agent:', routeErr.message);
      }
    } else {
      // Normal hangup — clean up
      console.log(`[outbound] Agent hangup (${hangupCause})`);
    }
    const voiceRecord = await Voice.findOne({ where: { queue_uuid: callControlId_Bridge } });
    if (voiceRecord?.accept_agent) {
      await setAgentOnline(voiceRecord.accept_agent);
    }
    broadcast('OutboundCCID', null);
    await Voice.destroy({ where: { queue_uuid: callControlId_Bridge } }).catch(() => {});
    return res.status(200).send('OK');
  }

  res.status(200).send('OK');
});

// GET /api/voice/calls - Call history
router.get('/calls', authenticate, async (req, res) => {
  const { page = 1, limit = 50, direction, status, startDate, endDate } = req.query;

  const where = {};
  if (direction) where.direction = direction;
  if (status) where.status = status;
  if (startDate && endDate) {
    where.startedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
  }

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const records = await CallRecord.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['startedAt', 'DESC']],
    });
    res.json({ data: records.rows, meta: { total: records.count, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    console.error('Error fetching call history:', error.message);
    res.status(500).json({ message: 'Error fetching call history' });
  }
});

// GET /api/voice/recordings - List recordings with filters
router.get('/recordings', authenticate, async (req, res) => {
  const { page = 1, size = 20, from, to, dateFrom, dateTo, connectionId, callControlId, callLegId, callSessionId, conferenceId, sipCallId } = req.query;
  try {
    const params = {
      'page[number]': parseInt(page),
      'page[size]': parseInt(size),
    };
    const filter = {};
    if (from) filter.from = from;
    if (to) filter.to = to;
    if (connectionId) filter.connection_id = connectionId;
    if (callControlId) filter.call_control_id = callControlId;
    if (callLegId) filter.call_leg_id = callLegId;
    if (callSessionId) filter.call_session_id = callSessionId;
    if (conferenceId) filter.conference_id = conferenceId;
    if (sipCallId) filter.sip_call_id = sipCallId;
    if (dateFrom || dateTo) {
      filter.created_at = {};
      if (dateFrom) filter.created_at.gte = dateFrom;
      if (dateTo) filter.created_at.lte = dateTo;
    }
    if (Object.keys(filter).length > 0) params.filter = filter;
    const telnyx = await getOrgTelnyxClient();
    const response = await telnyx.recordings.list(params);
    res.json(response);
  } catch (error) {
    console.error('Error fetching recordings:', error.message);
    res.json({ data: [] });
  }
});

// DELETE /api/voice/recordings/:id - Delete a recording
router.delete('/recordings/:id', authenticate, async (req, res) => {
  try {
    const telnyx = await getOrgTelnyxClient();
    await telnyx.recordings.delete(req.params.id);
    res.json({ message: 'Recording deleted' });
  } catch (error) {
    console.error('Error deleting recording:', error.message);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

// GET /api/voice/call-events - List call events for debugging
router.get('/call-events', authenticate, async (req, res) => {
  const { page = 1, size = 20, legId, sessionId, from, to, status, type, dateFrom, dateTo } = req.query;
  try {
    const params = {
      'page[number]': parseInt(page),
      'page[size]': parseInt(size),
    };
    const filter = {};
    if (legId) filter.leg_id = legId;
    if (sessionId) filter.application_session_id = sessionId;
    if (from) filter.from = from;
    if (to) filter.to = to;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (dateFrom || dateTo) {
      filter.occurred_at = {};
      if (dateFrom) filter.occurred_at.gte = dateFrom;
      if (dateTo) filter.occurred_at.lte = dateTo;
    }
    if (Object.keys(filter).length > 0) params.filter = filter;
    const telnyx = await getOrgTelnyxClient();
    const response = await telnyx.callEvents.list(params);
    res.json(response);
  } catch (error) {
    console.error('Error fetching call events:', error.message);
    res.json({ data: [] });
  }
});

export default router;
