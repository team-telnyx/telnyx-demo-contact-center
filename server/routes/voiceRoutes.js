import express from 'express';
import { Op } from 'sequelize';
import { env } from '../src/config/env.js';
import Telnyx from 'telnyx';
import Voice from '../models/Voice.js';
import User from '../models/User.js';
import CallRecord from '../models/CallRecord.js';
import { broadcast } from './websocket.js';
import * as ivrEngine from '../src/services/ivr-engine.js';
import { authenticate } from '../src/middleware/auth.js';
import { routeCallToAgent, routeToNextAgent } from '../src/services/auto-route.js';

const telnyx = new Telnyx({ apiKey: env.TELNYX_API });
const router = express.Router();

//================================================ INBOUND CALL WEBHOOK — IVR ENGINE + FALLBACK ================================================

router.post('/webhook', express.json(), async (req, res) => {
  const data = req.body.data;
  const direction = data.payload.direction;
  const callControlId = data.payload.call_control_id;

  try {
    // ── call.initiated (incoming) ──
    if (data.event_type === 'call.initiated' && direction === 'incoming') {
      Voice.create({
        queue_uuid: callControlId,
        telnyx_number: data.payload.to,
        destination_number: data.payload.from,
        direction: data.payload.direction,
      }).catch((error) => console.error('Error saving call to database:', error));

      // Create call history record
      CallRecord.create({
        telnyxCallControlId: callControlId,
        direction: 'inbound',
        fromNumber: data.payload.from,
        toNumber: data.payload.to,
        status: 'queued',
        startedAt: new Date(),
      }).catch((error) => console.error('Error creating call record:', error));

      // Check if there's an active IVR flow for the dialed number
      const telnyxNumber = data.payload.to;
      const session = await ivrEngine.startSession(callControlId, telnyxNumber);

      if (session) {
        console.log(`[IVR] Flow started for ${telnyxNumber}, call ${callControlId}`);
      } else {
        console.log(`[Default] No IVR flow for ${telnyxNumber}, using default queue`);
        await telnyx.calls.actions.answer(callControlId);
      }
    }

    // ── call.answered ──
    if (data.event_type === 'call.answered') {
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

    // ── call.enqueued ──
    if (data.event_type === 'call.enqueued') {
      const queueName = data.payload.queue || 'General_Queue';
      broadcast('NEW_CALL', data);
      console.log('Call Enqueued:', callControlId, 'Queue:', queueName);

      Voice.update(
        { queue_name: queueName },
        { where: { queue_uuid: callControlId } }
      ).catch((error) => console.error('Error saving call to database:', error));

      // Auto-route: try to dial an available agent
      const routed = await routeCallToAgent(callControlId);
      if (!routed) {
        // No agent available — play hold music until one comes online
        await telnyx.calls.actions.startPlayback(callControlId, {
          audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3',
        });
      }
    }

    // ── call.speak.ended — IVR engine advances to next node ──
    if (data.event_type === 'call.speak.ended') {
      if (ivrEngine.hasSession(callControlId)) {
        await ivrEngine.handleMediaEnded(callControlId);
      }
    }

    // ── call.playback.ended — IVR engine advances to next node ──
    if (data.event_type === 'call.playback.ended') {
      if (ivrEngine.hasSession(callControlId)) {
        await ivrEngine.handleMediaEnded(callControlId);
      }
    }

    // ── call.gather.ended — IVR engine routes based on digit pressed ──
    if (data.event_type === 'call.gather.ended') {
      const digits = data.payload.digits;
      if (ivrEngine.hasSession(callControlId) && digits) {
        const handled = await ivrEngine.handleGatherResult(callControlId, digits);
        if (!handled) {
          console.log(`[IVR] No route for digit "${digits}", hanging up`);
          await telnyx.calls.actions.hangup(callControlId);
        }
      }
    }

    // ── call.hangup — Clean up IVR session and Voice record ──
    if (data.event_type === 'call.hangup') {
      ivrEngine.endSession(callControlId);

      // Finalize call history record
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
      // Remove from queue records so auto-route doesn't pick up dead calls
      await Voice.destroy({
        where: { queue_uuid: callControlId }
      }).catch((err) => console.error('Error cleaning up voice record:', err.message));
      // Also clean up if this was a bridge leg
      await Voice.destroy({
        where: { bridge_uuid: callControlId }
      }).catch((err) => console.error('Error cleaning up bridge record:', err.message));
    }
  } catch (error) {
    console.error(`[webhook] Error handling ${data.event_type}:`, error.message);
  }

  res.status(200).send('OK');
});

router.get('/queue', async (req, res) => {
  try {
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
  const webhookUrlWithParam = `https://${env.APP_HOST}:${env.APP_PORT}/api/voice/outbound?callControlId_Bridge=${encodeURIComponent(callControlId)}`;

  try {
    await telnyx.calls.dial({
      connection_id: env.TELNYX_CONNECTION_ID,
      to: `sip:${sipUsername}@sip.telnyx.com`,
      from: callerId,
      webhook_url: webhookUrlWithParam,
    });
    console.log('Call Dialed');

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
    const response = await telnyx.calls.actions.transfer(transferId, {
      webhook_url: `https://${env.APP_HOST}:${env.APP_PORT}/api/voice/transfer-call?callControlId_Bridge=${transferId}${callControlFlag}`,
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
    if (outboundCCID) {
      pstnCallControlId = outboundCCID;
    } else if (callControlId) {
      const callData = await Voice.findOne({ where: { bridge_uuid: callControlId } });
      if (callData) {
        pstnCallControlId = callData.queue_uuid;
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
      const voiceRecord = await Voice.findOne({ where: { queue_uuid: pstnCallControlId } })
        || await Voice.findOne({ where: { bridge_uuid: callControlId } });
      fromNumber = voiceRecord?.telnyx_number || voiceRecord?.destination_number;
    }

    const supervisorWebhookUrl = `https://${env.APP_HOST}:${env.APP_PORT}/api/voice/supervisor-leg?pstnCCID=${encodeURIComponent(pstnCallControlId)}&bridgeCCID=${encodeURIComponent(callControlId || outboundCCID || '')}`;

    const dialBody = {
      connection_id: env.TELNYX_CONNECTION_ID,
      to: `sip:${targetSipUsername}@sip.telnyx.com`,
      from: fromNumber,
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
    if (event_type === 'call.initiated' && direction === 'outgoing' && state === 'parked') {
      broadcast('WebRTC_OutboundCCID', callControlId);

      Voice.create({
        telnyx_number: data.payload.from,
        destination_number: data.payload.to,
        direction: data.payload.direction,
        queue_uuid: callControlId,
      }).catch(error => console.error('Error saving call to database:', error));

      await telnyx.calls.actions.answer(callControlId, {
        client_state: Buffer.from(callControlId).toString('base64')
      });
      console.log('WebRTC Call Answered');
    }

    if (event_type === 'call.answered' && clientState === Buffer.from(callControlId).toString('base64')) {
      const transferId = req.body.data.payload.call_control_id;

      await telnyx.calls.dial({
        connection_id: env.TELNYX_CONNECTION_ID,
        to: toNumber,
        from: fromNumber,
        client_state: Buffer.from(transferId).toString('base64'),
        webhook_url: `https://${env.APP_HOST}:${env.APP_PORT}/api/voice/outbound-webrtc-bridge?callControlId_Bridge=${transferId}`,
      });
      console.log('Outbound Call Dialed');
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

  if (event_type === 'call.answered') {
    broadcast('OutboundCCID', callControl);
    try {
      await telnyx.calls.actions.bridge(callControlId_Bridge, {
        call_control_id_to_bridge_with: callControl, park_after_unbridge: 'self'
      });

      await Voice.update(
        { bridge_uuid: callControl },
        { where: { queue_uuid: callControlId_Bridge } }
      );
      console.log('Call Bridged');
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

export default router;
