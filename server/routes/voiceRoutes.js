import express from 'express';
import { Op } from 'sequelize';
import { getOrgTelnyxClient, getWebhookBaseUrl } from '../src/services/org-telnyx.js';
import Voice from '../models/Voice.js';
import User from '../models/User.js';
import CallRecord from '../models/CallRecord.js';
import { broadcast } from './websocket.js';
import * as ivrEngine from '../src/services/ivr-engine.js';
import { authenticate } from '../src/middleware/auth.js';
import { routeCallToAgent, routeToNextAgent } from '../src/services/auto-route.js';

const router = express.Router();

//================================================ INBOUND CALL WEBHOOK — IVR ENGINE + FALLBACK ================================================

async function handleCallInitiated(telnyx, data, callControlId) {
  Voice.create({
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
    await telnyx.calls.actions.answer(callControlId);
  }
}

async function handleCallAnswered(telnyx, data, callControlId) {
  CallRecord.update(
    { status: 'active', answeredAt: new Date() },
    { where: { telnyxCallControlId: callControlId } }
  ).catch(() => {});

  if (ivrEngine.hasSession(callControlId)) {
    await ivrEngine.handleMediaEnded(callControlId);
  } else {
    await telnyx.calls.actions.enqueue(callControlId, { queue_name: 'General_Queue' });
  }
}

async function handleCallEnqueued(telnyx, data, callControlId) {
  const queueName = data.payload.queue || 'General_Queue';
  broadcast('NEW_CALL', data);
  console.log('Call Enqueued:', callControlId, 'Queue:', queueName);

  await Voice.update(
    { queue_name: queueName },
    { where: { queue_uuid: callControlId } }
  ).catch((error) => console.error('Error saving call to database:', error));

  const routed = await routeCallToAgent(callControlId);
  if (!routed) {
    await telnyx.calls.actions.startPlayback(callControlId, {
      audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3',
    });
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

async function handleCallHangup(data, callControlId) {
  ivrEngine.endSession(callControlId);

  const voiceRecord = await Voice.findOne({ where: { queue_uuid: callControlId } });
  CallRecord.update(
    {
      status: data.payload.hangup_cause === 'normal_clearing' ? 'completed' : 'missed',
      endedAt: new Date(),
      agentUsername: voiceRecord?.accept_agent || null,
      queueName: voiceRecord?.queue_name || null,
    },
    { where: { telnyxCallControlId: callControlId } }
  ).catch(() => {});

  await Voice.destroy({ where: { queue_uuid: callControlId } })
    .catch((err) => console.error('Error cleaning up voice record:', err.message));
  await Voice.destroy({ where: { bridge_uuid: callControlId } })
    .catch((err) => console.error('Error cleaning up bridge record:', err.message));
}

const webhookHandlers = {
  'call.initiated': (telnyx, data, ccid) => data.payload.direction === 'incoming' ? handleCallInitiated(telnyx, data, ccid) : null,
  'call.answered': handleCallAnswered,
  'call.enqueued': handleCallEnqueued,
  'call.speak.ended': (telnyx, data, ccid) => handleMediaEnded(ccid),
  'call.playback.ended': (telnyx, data, ccid) => handleMediaEnded(ccid),
  'call.gather.ended': handleGatherEnded,
  'call.hangup': (telnyx, data, ccid) => handleCallHangup(data, ccid),
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

router.post('/accept-call', express.json(), async (req, res) => {
  const { sipUsername, callControlId, callerId } = req.body;

  try {
    const telnyx = await getOrgTelnyxClient();
    const webhookBase = await getWebhookBaseUrl();
    const webhookUrlWithParam = `${webhookBase}/api/voice/outbound?callControlId_Bridge=${encodeURIComponent(callControlId)}`;
    const agent = await User.findOne({ where: { sipUsername } });
    await telnyx.calls.dial({
      connection_id: agent?.appConnectionId,
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: callerId,
      link_to: callControlId,
      webhook_url: webhookUrlWithParam,
    });
    console.log('Call Dialed (linked to queued leg)');

    await Voice.update(
      { accept_agent: sipUsername },
      { where: { queue_uuid: callControlId } }
    );
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error during transfer or bridging call:', error.message);
    res.status(500).send('Internal Server Error');
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
    try {
      await telnyx.calls.actions.bridge(callControlId_Bridge, {
        call_control_id_to_bridge_with: callControl, park_after_unbridge: 'self'
      });

      await Voice.update(
        { bridge_uuid: callControl },
        { where: { queue_uuid: callControlId_Bridge } }
      );
      console.log('Call Bridged');
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error during call bridging:', error.message);
      res.status(500).send('Internal Server Error');
    }
  } else if (event_type === 'call.hangup') {
    // Agent declined (486), unavailable (480), or busy (487)
    if (sipcode === '480' || sipcode === '486' || sipcode === '487') {
      const voiceRecord = await Voice.findOne({ where: { queue_uuid: callControlId_Bridge } });
      const declinedAgent = voiceRecord?.accept_agent;
      console.log(`[Outbound] Agent ${declinedAgent} declined/busy (SIP ${sipcode}), routing to next agent`);
      routeToNextAgent(callControlId_Bridge, declinedAgent).catch(err =>
        console.error('[Outbound] Error routing to next agent:', err.message)
      );
      res.status(200).send('OK');
    } else if (hangup_source === 'callee' && clientState !== Buffer.from('Warm Transfer').toString('base64')) {
      // Normal hangup from callee during active call
      try {
        await telnyx.calls.actions.hangup(callControlId_Bridge);
        console.log('Call Hung Up');
        res.status(200).send('OK');
      } catch (error) {
        console.error('Error hanging up call:', error.message);
        res.status(500).send('Internal Server Error');
      }
    } else {
      res.status(200).send('OK');
    }
  } else {
    res.status(200).send('OK');
  }
});

//=================================================== AGENT COLD TRANSFER ===================================================

router.post('/transfer', express.json(), async (req, res) => {
  const { sipUsername, callerId, callControlId, outboundCCID } = req.body;

  // Look up the target agent's SIP username
  const targetAgent = await User.findOne({ where: { username: sipUsername } });
  const targetSipUsername = targetAgent?.sipUsername || sipUsername;

  let transferId;
  let isCallControlIdUsed = false;

  if (outboundCCID && outboundCCID.length > 0) {
    transferId = outboundCCID;
  } else if (callControlId) {
    isCallControlIdUsed = true;
    const callData = await Voice.findOne({ where: { bridge_uuid: callControlId } });
    if (callData) {
      transferId = callData.queue_uuid;
    } else {
      return res.status(404).send('Call data not found');
    }
  } else {
    return res.status(400).send('No valid ID provided for transfer');
  }

  const callControlFlag = isCallControlIdUsed ? '&isCallControlIdUsed=true' : '';

  try {
    const telnyx = await getOrgTelnyxClient();
    const webhookBase = await getWebhookBaseUrl();
    const response = await telnyx.calls.actions.transfer(transferId, {
      webhook_url: `${webhookBase}/api/voice/transfer-call?callControlId_Bridge=${transferId}${callControlFlag}`,
      from: callerId.number,
      to: `sip:${targetSipUsername}@sip.telnyx.com`,
      client_state: Buffer.from('Transfer').toString('base64')
    });
    res.send(response);
  } catch (error) {
    console.error('Error transferring call:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/transfer-call', express.json(), async (req, res) => {
  try {
    const telnyx = await getOrgTelnyxClient();
    const event_type = req.body.data.event_type;
    const callControlId_Bridge = req.query.callControlId_Bridge;
    const isCallControlIdUsed = req.query.isCallControlIdUsed === 'true';
    const hangup_source = req.body.data.payload.hangup_source;
    const sipcode = req.body.data.payload.sip_hangup_cause;
    let transferId;

    if (!isCallControlIdUsed) {
      const callData = await Voice.findOne({ where: { bridge_uuid: callControlId_Bridge } });
      transferId = callData ? callData.queue_uuid : null;
    } else {
      transferId = callControlId_Bridge;
    }

    if (event_type === 'call.answered' && !isCallControlIdUsed) {
      try {
        await telnyx.calls.actions.hangup(transferId);
        broadcast('OutboundCCID', null);
      } catch (error) {
        console.error('Error hanging up call on answer:', error.message);
      }
    }

    if (event_type === 'call.hangup' && hangup_source === 'callee' && isCallControlIdUsed) {
      broadcast('OutboundCCID', null);
      try {
        await telnyx.calls.actions.hangup(transferId);
      } catch (error) {
        console.error('Error hanging up call on hangup:', error.message);
      }
    }

    // Agent unavailable — re-enqueue
    if (event_type === 'call.hangup' && (sipcode === '480' || sipcode === '486')) {
      broadcast('OutboundCCID', null);
      const targetId = isCallControlIdUsed ? transferId : callControlId_Bridge;
      try {
        await telnyx.calls.actions.speak(targetId, {
          payload: 'The agent is not available. Transferring you back into the queue.',
          voice: 'female',
          language: 'en-US'
        });

        await telnyx.calls.actions.enqueue(targetId, { queue_name: 'General_Queue' });

        if (!isCallControlIdUsed) {
          await telnyx.calls.actions.startPlayback(targetId, {
            audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3'
          });
          await telnyx.calls.actions.hangup(transferId);
        }
      } catch (error) {
        console.error('Error re-enqueuing call:', error.message);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error.message);
    if (!res.headersSent) res.status(500).send('Internal Server Error');
  }
});

//=================================================== AGENT WARM TRANSFER (Supervisor Barge) ===================================================

router.post('/warm-transfer', express.json(), async (req, res) => {
  const { sipUsername, callControlId, outboundCCID, webrtcOutboundCCID, callerId } = req.body;

  let pstnCallControlId;

  try {
    const telnyx = await getOrgTelnyxClient();

    if (outboundCCID) {
      // Outbound call: outboundCCID IS the PSTN leg (stored as bridge_uuid)
      pstnCallControlId = outboundCCID;
      console.log(`[warm-transfer] Outbound call — PSTN leg: ${pstnCallControlId}, agent WebRTC leg: ${webrtcOutboundCCID || callControlId}`);
    } else if (callControlId) {
      // Inbound call: callControlId is the agent's bridge leg, look up the original PSTN/queue leg
      const callData = await Voice.findOne({ where: { bridge_uuid: callControlId } });
      if (callData) {
        pstnCallControlId = callData.queue_uuid;
        console.log(`[warm-transfer] Inbound call — PSTN leg: ${pstnCallControlId}, agent bridge leg: ${callControlId}`);
      } else {
        return res.status(404).json({ error: 'Call session not found' });
      }
    } else {
      return res.status(400).json({ error: 'No call control ID provided' });
    }

    // Look up the target agent's SIP username (frontend sends username, not sipUsername)
    const targetAgent = await User.findOne({ where: { username: sipUsername } });
    const targetSipUsername = targetAgent?.sipUsername || sipUsername;

    // Get a valid from number — fall back to the Telnyx number from the Voice record
    let fromNumber = callerId?.number;
    if (!fromNumber || fromNumber === 'Unknown') {
      const voiceRecord = await Voice.findOne({ where: { bridge_uuid: pstnCallControlId } })
        || await Voice.findOne({ where: { queue_uuid: pstnCallControlId } })
        || await Voice.findOne({ where: { bridge_uuid: callControlId } });
      fromNumber = voiceRecord?.telnyx_number || voiceRecord?.destination_number;
    }

    const webhookBase = await getWebhookBaseUrl();
    const supervisorWebhookUrl = `${webhookBase}/api/voice/supervisor-leg?pstnCCID=${encodeURIComponent(pstnCallControlId)}&bridgeCCID=${encodeURIComponent(callControlId || outboundCCID || '')}`;

    const dialBody = {
      connection_id: targetAgent?.appConnectionId,
      to: `sip:${targetSipUsername}@sip.telnyx.com`,
      from: fromNumber,
      link_to: pstnCallControlId,
      supervise_call_control_id: pstnCallControlId,
      supervisor_role: 'barge',
      webhook_url: supervisorWebhookUrl,
    };
    console.log(`[warm-transfer] Dial request:`, JSON.stringify(dialBody));

    const dialResponse = await telnyx.calls.dial(dialBody);

    const thirdPartyCallControlId = dialResponse?.data?.call_control_id;
    console.log(`[warm-transfer] Target agent dialed, call_control_id: ${thirdPartyCallControlId}`);

    if (callControlId) {
      await Voice.update(
        { conference_id: thirdPartyCallControlId },
        { where: { bridge_uuid: callControlId } }
      );
    } else if (outboundCCID) {
      await Voice.update(
        { conference_id: thirdPartyCallControlId },
        { where: { bridge_uuid: outboundCCID } }
      );
    }

    res.json({
      success: true,
      pstnCallControlId,
      thirdPartyCallControlId,
      status: 'dialing',
    });
  } catch (error) {
    const detail = error.error?.errors?.[0]?.detail || error.message;
    console.error('Error handling warm transfer:', error.message);
    res.status(error.status || 500).json({ error: `Failed to initiate warm transfer: ${detail}` });
  }
});

// Supervisor leg webhook — tracks whether the dialed supervisor answered or failed
router.post('/supervisor-leg', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const callControlId = req.body.data.payload.call_control_id;
  const sipcode = req.body.data.payload.sip_hangup_cause;
  const hangupCause = req.body.data.payload.hangup_cause;
  const pstnCCID = req.query.pstnCCID;
  const bridgeCCID = req.query.bridgeCCID;

  if (event_type === 'call.answered') {
    console.log(`[supervisor-leg] Supervisor answered, 3-way call active (${callControlId})`);
    broadcast('WARM_TRANSFER_STARTED', {
      pstnCallControlId: pstnCCID,
      thirdPartyCallControlId: callControlId,
      targetAgent: req.body.data.payload.to,
    });
  }

  if (event_type === 'call.hangup') {
    const reason = hangupCause || `SIP ${sipcode}` || 'unknown';
    // If the supervisor never answered (declined/busy/timeout)
    if (sipcode === '480' || sipcode === '486' || sipcode === '487' || hangupCause === 'timeout') {
      console.log(`[supervisor-leg] Supervisor declined/unavailable: ${reason}`);
      broadcast('WARM_TRANSFER_FAILED', { reason: `Agent declined or unavailable (${reason})` });
    } else {
      // Supervisor hung up after being in the call — transfer completed or agent left
      console.log(`[supervisor-leg] Supervisor leg ended: ${reason}`);
      broadcast('WARM_TRANSFER_COMPLETED', { callControlId: bridgeCCID });
    }
  }

  res.status(200).send('OK');
});

router.post('/complete-warm-transfer', express.json(), async (req, res) => {
  const { callControlId, outboundCCID, webrtcOutboundCCID } = req.body;

  try {
    const telnyx = await getOrgTelnyxClient();
    const agentLeg = webrtcOutboundCCID || callControlId;

    if (agentLeg) {
      console.log(`[complete-warm-transfer] Hanging up agent leg: ${agentLeg}`);
      await telnyx.calls.actions.hangup(agentLeg);
    }

    broadcast('WARM_TRANSFER_COMPLETED', { callControlId, outboundCCID });
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing warm transfer:', error.message);
    res.status(500).json({ error: 'Failed to complete warm transfer' });
  }
});

//============= PARK OUTBOUND CALLS FUNCTIONALITY ===================

router.post('/outbound-webrtc', express.json(), async (req, res) => {
  const fromNumber = req.body.data.payload.from;
  const toNumber = req.body.data.payload.to;
  const callControlId = req.body.data.payload.call_control_id;
  const event_type = req.body.data.event_type;
  const direction = req.body.data.payload.direction;
  const state = req.body.data.payload.state;
  const clientState = req.body.data.payload.client_state;
  const data = req.body.data;

  try {
    const telnyx = await getOrgTelnyxClient();
    const webhookBase = await getWebhookBaseUrl();

    if (event_type === 'call.initiated' && direction === 'outgoing' && state === 'parked') {
      broadcast('WebRTC_OutboundCCID', callControlId);

      // Look up calling agent by their SIP credential connection ID
      const sipConnectionId = data.payload.connection_id;
      const initiatingAgent = sipConnectionId
        ? await User.findOne({ where: { webrtcConnectionId: sipConnectionId } })
        : null;
      console.log(`[Outbound-WebRTC] initiated: sipConn=${sipConnectionId}, agent=${initiatingAgent?.username || 'NOT FOUND'}, voiceApp=${initiatingAgent?.appConnectionId || 'NONE'}`);

      Voice.create({
        telnyx_number: data.payload.from,
        destination_number: data.payload.to,
        direction: data.payload.direction,
        queue_uuid: callControlId,
        accept_agent: initiatingAgent?.username || null,
      }).catch(error => console.error('Error saving call to database:', error));

      // Answer the WebRTC leg on the SIP credential connection
      await telnyx.calls.actions.answer(callControlId, {
        client_state: Buffer.from(callControlId).toString('base64')
      });
      console.log(`WebRTC Call Answered (agent: ${initiatingAgent?.username})`);
    }

    if (event_type === 'call.answered' && clientState === Buffer.from(callControlId).toString('base64')) {
      const transferId = req.body.data.payload.call_control_id;

      // Look up agent and original caller ID from Voice record (stored on call.initiated)
      const voiceRecord = await Voice.findOne({ where: { queue_uuid: callControlId } });
      const callingAgent = voiceRecord?.accept_agent
        ? await User.findOne({ where: { username: voiceRecord.accept_agent } })
        : null;

      if (!callingAgent?.appConnectionId) {
        console.error(`[Outbound-WebRTC] No Voice App for agent ${voiceRecord?.accept_agent}`);
        return;
      }

      // Use the from number stored at call.initiated (user's selected caller ID)
      const callerIdNumber = voiceRecord?.telnyx_number || fromNumber;

      console.log(`[Outbound-WebRTC] Dialing ${toNumber} from ${callerIdNumber} via Voice App ${callingAgent.appConnectionId}`);

      // Dial outbound PSTN leg using the agent's Voice App connection
      await telnyx.calls.dial({
        connection_id: callingAgent.appConnectionId,
        to: toNumber,
        from: callerIdNumber,
        link_to: transferId,
        client_state: Buffer.from(transferId).toString('base64'),
        webhook_url: `${webhookBase}/api/voice/outbound-webrtc-bridge?callControlId_Bridge=${transferId}`,
      });
      console.log('Outbound Call Dialed (linked to agent leg)');
    }
  } catch (error) {
    console.error('Error handling webhook:', error.message);
    if (error.response) console.error('Error response:', error.response.data);
  }

  res.status(200).send('OK');
});

//============= PARK OUTBOUND CALLS - BRIDGE LEG ===================

router.post('/outbound-webrtc-bridge', express.json(), async (req, res) => {
  const event_type = req.body.data.event_type;
  const callControlId_Bridge = req.query.callControlId_Bridge;
  const callControl = req.body.data.payload.call_control_id;
  const hangup_source = req.body.data.payload.hangup_source;
  const clientState = req.body.data.payload.client_state;
  let telnyx;
  try { telnyx = await getOrgTelnyxClient(); } catch (err) {
    console.error('[outbound-webrtc-bridge] Telnyx client unavailable:', err.message);
    return res.status(200).send('OK');
  }

  if (event_type === 'call.answered') {
    broadcast('OutboundCCID', callControl);
    try {
      // Bridge on the PSTN/destination leg (callControl) with agent leg in body
      // park_after_unbridge: 'self' parks the PSTN leg so it can be re-bridged on warm transfer
      await telnyx.calls.actions.bridge(callControl, {
        call_control_id_to_bridge_with: callControlId_Bridge, park_after_unbridge: 'self'
      });

      await Voice.update(
        { bridge_uuid: callControl },
        { where: { queue_uuid: callControlId_Bridge } }
      );
      console.log('Call Bridged (PSTN leg parked)');
      return res.status(200).send('OK');
    } catch (error) {
      console.error('Error during call bridging:', error.message);
      return res.status(500).send('Internal Server Error');
    }
  }

  if (event_type === 'call.hangup' && hangup_source === 'callee' && clientState !== Buffer.from('Transfer').toString('base64')) {
    try {
      await telnyx.calls.actions.hangup(callControlId_Bridge);
      broadcast('OutboundCCID', null);
      console.log('Call Hung Up');
      return res.status(200).send('OK');
    } catch (error) {
      console.error('Error hanging up call:', error.message);
      return res.status(500).send('Internal Server Error');
    }
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
