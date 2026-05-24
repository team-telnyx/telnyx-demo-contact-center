import { Router, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import { loadEnv } from '../config/env.js';
import * as telnyxService from '../services/telnyx.js';
import * as acdService from '../services/acd.js';
import bus from '../services/event-bus.js';
import { executeIvrFlow, handleIvrEvent } from '../services/ivr-engine.js';
import {
  isTranscriptionEnabled,
  handleTranscriptionEvent,
  getFinalTranscript,
  getTranscriptSegments,
  cleanupTranscription,
  closeAllTranscriptions,
} from '../services/transcription.js';
import { generateCaseNotes } from '../services/llm.js';
import {
  emitCallRinging,
  emitCallAnswered,
  emitCallEnded,
  emitTranscriptPartial,
  emitTranscriptFinal,
  emitCaseNotesReady,
  emitChatNew,
  emitChatMessage,
  emitRecordingSaved,
  emitDebugWebhook,
  getIO,
} from '../services/socket.js';
import { getStickySender, sendSms as telnyxSendSms, numberLookup } from '../services/telnyx.js';
import { downloadAndStoreMedia } from '../services/file-storage.js';

/**
 * In-memory call state map: callControlId → state object
 *
 * Each state object:
 *   callId          — our DB UUID
 *   currentNodeId   — current IVR node
 *   pendingAdvance  — { nodeId, gatherResult } waiting for speak.ended
 *   pendingGather   — { nodeId } waiting for gather.ended
 *   lastGatherResult
 */
const callStates = new Map();

/**
 * SLA target — a call is "within SLA" if an agent answers within this many
 * seconds of the caller entering the queue. Default 20s is the standard
 * contact-center benchmark (the "80/20 rule" — 80% of calls answered in 20s).
 *
 * Override via env: SLA_TARGET_SECONDS=30
 */
const SLA_TARGET_SECONDS = Number(process.env.SLA_TARGET_SECONDS) || 20;

export function createWebhookRouter(models: any) {
  const router = Router();

  // ── Internal webhook: Go webhook handler → Node.js ───────────────────────
  // Receives validated, forwarded events from the Go webhook-handler service.
  // Authenticated via X-Internal-API-Key header.
  router.post('/telnyx/internal', async (req: Request, res: Response) => {
    const apiKey = req.headers['x-internal-api-key'];
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      logger.warn({ hasKey: !!apiKey }, 'Internal webhook: unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = req.body;
    if (!event?.event_type) {
      return res.status(400).json({ error: 'Missing event_type' });
    }

    logger.info({ eventType: event.event_type, callControlId: event.raw_event?.payload?.call_control_id }, 'Internal webhook received from Go handler');

    // Re-construct the event in the same format as the direct webhook handler
    // so downstream processing (Socket.IO, DB, etc.) works identically.
    const data = event.raw_event;
    if (data) {
      const payload = data.payload || {};
      const eventType = data.event_type || event.event_type;

      // Emit real-time Socket.IO event
      try {
        const io = getIO();
        io.emit('call:event', {
          event_type: eventType,
          call_state: event.call_state,
          raw_event: data,
          timestamp: event.timestamp,
        });
      } catch (err) {
        logger.debug({ err }, 'Socket.IO emit for internal webhook failed');
      }

      // Push to debug ring buffer
      const webhookEntry = {
        id: `wh_int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        eventType,
        callControlId: payload.call_control_id || null,
        direction: payload.direction || null,
        from: payload.from || null,
        to: payload.to || null,
        receivedAt: new Date().toISOString(),
        processingTime: 0,
        payload,
        error: null,
        source: 'go-webhook-handler',
      };
      try { emitDebugWebhook(getIO(), webhookEntry); } catch { /* Socket not initialized */ }
    }

    res.json({ status: 'ok' });
  });

  // Telnyx webhooks: POST /api/webhooks
  router.post('/', async (req: Request, res: Response) => {
    // Always ack immediately — Telnyx requires a fast 200
    res.sendStatus(200);

    // Timestamp for processing time measurement
    const receivedAt = new Date().toISOString();
    const startMs = Date.now();

    // Telnyx v2 envelope: { data: { event_type, id, payload: { call_control_id, ... } } }
    // Flatten so downstream handlers can read fields directly off `event`.
    const data      = req.body?.data;
    const eventType = data?.event_type;
    const eventId   = data?.id;

    if (!data || !eventType) {
      logger.warn({ body: req.body }, 'Malformed webhook payload — ignored');
      return;
    }

    const event = { ...(data.payload || {}), event_type: eventType, occurred_at: data.occurred_at };

    logger.info({ eventType, eventId, callControlId: event.call_control_id }, 'Webhook received');

    // ── Debug ring buffer: push every webhook event ──────────────────
    const webhookEntry = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventType,
      callControlId: event.call_control_id || null,
      direction: event.direction || null,
      from: event.from || null,
      to: event.to || null,
      receivedAt,
      processingTime: null,  // filled after handler completes
      payload: data.payload || {},
      error: null,
    };

    try {
      switch (eventType) {
        case 'call.initiated':
          await handleCallInitiated(event, models);
          break;
        case 'call.answered':
          await handleCallAnswered(event, models);
          break;
        case 'call.hangup':
          await handleCallHangup(event, models);
          break;
        case 'call.bridged':
          await handleCallBridged(event, models);
          break;
        case 'call.dtmf.received':
          await handleDtmfReceived(event, models);
          break;
        case 'call.gather.ended':
          await handleGatherEnded(event, models);
          break;
        case 'call.speak.ended':
          await handleSpeakEnded(event, models);
          break;
        case 'call.playback.ended':
          await handlePlaybackEnded(event, models);
          break;
        case 'call.recording.saved':
          await handleRecordingSaved(event, models);
          break;
        case 'call.transcription':
          await handleTranscription(event, models);
          break;
        case 'streaming.started':
          logger.info({ callControlId: event.call_control_id }, 'Media streaming started');
          break;
        case 'streaming.stopped':
          logger.info({ callControlId: event.call_control_id }, 'Media streaming stopped');
          break;
        case 'call.machine.detection.ended':
          await handleAmdResult(event, models);
          break;
        case 'message.received':
          await handleSmsReceived(event, models);
          break;
        case 'message.sent':
        case 'message.delivered':
        case 'message.failed':
          await handleSmsStatus(event, models);
          break;
        default:
          logger.debug({ eventType }, 'Unhandled event type — ignored');
      }
    } catch (err) {
      logger.error({ err, eventType, eventId }, 'Webhook handler threw — call may be in bad state');
      webhookEntry.error = err.message || String(err);
      // Push to internal event log too
      logger.error({ eventType, callControlId: event.call_control_id, eventId, err }, 'Webhook handler threw for event');
    }

    // Fill processing time and push to ring buffer
    webhookEntry.processingTime = Date.now() - startMs;
    // Broadcast new webhook event via Socket.IO
    try { emitDebugWebhook(getIO(), webhookEntry); } catch { /* Socket not initialized */ }
  });

  return router;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * call.initiated
 * A new inbound call has arrived. Create a DB record and run the IVR flow.
 */
async function handleCallInitiated(event: any, models: any) {
  const { call_control_id: callControlId, call_session_id: callSessionId, direction, from, to } = event;

  logger.info({ callControlId, from, to, direction }, 'Call initiated');

  // Telnyx uses 'incoming'/'outgoing'; our DB enum uses 'inbound'/'outbound'.
  const normalizedDirection =
    direction === 'incoming' ? 'inbound'
    : direction === 'outgoing' ? 'outbound'
    : direction || 'inbound';

  // The ACD service may have already created an agent-leg row before this
  // webhook fires (race). findOrCreate avoids the unique-key collision and
  // means we'll exit early if this is an agent-dial leg we already know about.
  const [call, created] = await models.Call.findOrCreate({
    where: { callControlId },
    defaults: {
      callControlId,
      callSessionId,
      direction: normalizedDirection,
      from,
      to,
      status: 'ringing',
      startedAt: new Date(),
    },
  });

  if (!created) {
    logger.info({ callControlId, callPurpose: call.callPurpose }, 'Call.initiated for pre-existing leg — skipping IVR setup');
    return;
  }

  const state = {
    callId: call.id,
    currentNodeId: null,
    pendingAdvance: null,
    pendingGather: null,
    lastGatherResult: null,
  };
  callStates.set(callControlId, state);

  emitCallRinging({ callId: call.id, callControlId, from, to, direction, agentId: call.agentId });

  // Outbound calls (e.g. agent-initiated from the softphone) skip the IVR
  // entirely. Telnyx will send call.answered when the far end picks up,
  // and the existing handler will start transcription on that leg.
  if (normalizedDirection === 'outbound') {
    logger.info({ callControlId, from, to }, 'Outbound call — skipping IVR, transcription will start on answer');
    return;
  }

  // Look up the IVR flow assigned to this DID
  const numberAssignment = await models.NumberAssignment.findOne({
    where: { phoneNumber: to },
    include: [{ model: models.IvrFlow, as: 'ivrFlow' }],
  });

  const flow = numberAssignment?.ivrFlow;

  if (!flow || !flow.published) {
    logger.warn({ callControlId, to }, 'No published IVR flow for this number — answering with default message');
    // Answer and play a generic message
    await telnyxService.answerCall(callControlId);
    await telnyxService.speakOnCall(
      callControlId,
      'Thank you for calling. Our system is being set up. Please try again later.',
    );
    setTimeout(() => telnyxService.hangupCall(callControlId).catch(() => {}), 8000);
    return;
  }

  // Link call to IVR flow
  await call.update({ ivrFlowId: flow.id });

  // Execute first IVR step (answer + speak)
  await executeIvrFlow(flow, callControlId, telnyxService, acdService, state);
}

/**
 * call.answered
 * The call has been answered (by us or agent). Start Telnyx transcription if enabled.
 */
async function handleCallAnswered(event: any, models: any) {
  const { call_control_id: callControlId } = event;

  logger.info({ callControlId }, 'Call answered');

  const call = await models.Call.findOne({ where: { callControlId } });
  if (!call) return;

  // Handle whisper calls — when supervisor's whisper leg is answered, speak the message
  if (call.callPurpose === 'whisper') {
    const parentCall = call.parentCallId ? await models.Call.findByPk(call.parentCallId) : null;
    logger.info({ callControlId, parentCallControlId: parentCall?.callControlId }, 'Whisper call answered — supervisor can now listen');
    if (parentCall?.callControlId) {
      await telnyxService.bridgeCall(callControlId, parentCall.callControlId).catch((err) =>
        logger.error({ err, callControlId }, 'Failed to bridge whisper call'),
      );
    }
    return;
  }

  // Handle transfer calls — when the target picks up
  if (call.callPurpose === 'transfer') {
    logger.info({ callControlId }, 'Transfer target answered');
    await call.update({ status: 'active' });
    emitCallAnswered({ callId: call.id, callControlId, agentId: call.agentId });
    return;
  }

  // Handle agent-answer legs — bridge to the parent inbound call, then start STT
  if (call.callPurpose === 'agent_answer') {
    const parentCall = call.parentCallId ? await models.Call.findByPk(call.parentCallId) : null;
    if (!parentCall?.callControlId) {
      logger.error({ callControlId, parentCallId: call.parentCallId }, 'Agent leg answered but parent call missing — hanging up');
      await telnyxService.hangupCall(callControlId).catch(() => {});
      return;
    }

    logger.info({ agentLegCallControlId: callControlId, parentCallControlId: parentCall.callControlId }, 'Agent leg answered — bridging to inbound caller');

    // ── SLA: compute time-to-answer for the inbound leg ───────────────────
    // We grab this *before* bridging so a failed bridge doesn't poison the
    // measurement. acdService stamps enqueuedAt when the IVR routes the
    // caller into a queue.
    const enqueuedAt = acdService.getEnqueuedAt(parentCall.id);
    if (enqueuedAt) {
      const timeToAnswerSec = Math.max(0, Math.round((Date.now() - enqueuedAt) / 1000));
      const answeredWithinSla = timeToAnswerSec <= SLA_TARGET_SECONDS;
      // Stash on the in-memory parent state so the hangup handler can write
      // these onto the CallRecord. We don't have a CallRecord yet (created at
      // hangup) so we can't persist directly here.
      const parentState = callStates.get(parentCall.callControlId);
      if (parentState) {
        parentState.timeToAnswer = timeToAnswerSec;
        parentState.answeredWithinSla = answeredWithinSla;
      }
      logger.info({ parentCallId: parentCall.id, timeToAnswerSec, answeredWithinSla }, 'SLA measured');
    }

    try {
      await telnyxService.bridgeCall(callControlId, parentCall.callControlId);
      await call.update({ status: 'active' });
      await parentCall.update({ status: 'active' });
      emitCallAnswered({ callId: parentCall.id, callControlId: parentCall.callControlId, agentId: call.agentId || parentCall.agentId });

      // Emit event bus: call started (agent-bridged inbound call)
      bus.emit('call:started', { callId: parentCall.id, callControlId: parentCall.callControlId, agentId: call.agentId || parentCall.agentId, direction: parentCall.direction, from: parentCall.from, to: parentCall.to, queueName: parentCall.queueName });
    } catch (err) {
      logger.error({ err, callControlId }, 'Failed to bridge agent leg to inbound — releasing');
      await telnyxService.hangupCall(callControlId).catch(() => {});
      return;
    }

    // Start transcription on the inbound (parent) leg — this is the leg with
    // the actual conversation audio after bridging.
    if (!isTranscriptionEnabled()) {
      logger.info({ parentCallControlId: parentCall.callControlId }, 'Transcription disabled — skipping');
      return;
    }
    try {
      const env = loadEnv();
      await telnyxService.startTranscription(parentCall.callControlId, {
        engine: env.TELNYX_STT_ENGINE || 'Deepgram',
        tracks: env.TELNYX_STT_TRACKS || 'both',
        model: env.TELNYX_STT_MODEL,
        language: env.TELNYX_STT_LANGUAGE || 'auto',
      });
      logger.info({ parentCallControlId: parentCall.callControlId }, 'Telnyx call transcription started on bridged call');
    } catch (err) {
      logger.error({ err, callControlId: parentCall.callControlId }, 'Failed to start call transcription on bridged call');
    }
    return;
  }

  await call.update({ status: 'active' });
  emitCallAnswered({ callId: call.id, callControlId, agentId: call.agentId });

  // Emit event bus: call started
  bus.emit('call:started', { callId: call.id, callControlId, agentId: call.agentId, direction: call.direction, from: call.from, to: call.to });

  // ── Start Telnyx Call Control Transcription ───────────────────────────
  if (!isTranscriptionEnabled()) {
    logger.info({ callControlId }, 'Transcription disabled — skipping');
    return;
  }

  try {
    const env = loadEnv();
    await telnyxService.startTranscription(callControlId, {
      engine: env.TELNYX_STT_ENGINE || 'Deepgram',
      tracks: env.TELNYX_STT_TRACKS || 'both',
      model: env.TELNYX_STT_MODEL,
      language: env.TELNYX_STT_LANGUAGE || 'auto',
    });
    logger.info({ callControlId }, 'Telnyx call transcription started');
  } catch (err) {
    logger.error({ err, callControlId }, 'Failed to start call transcription — continuing without transcript');
  }
}

/**
 * call.transcription
 * Real-time transcription result from Telnyx Call Control.
 * Accumulates transcript and emits Socket.IO events to the frontend.
 */
async function handleTranscription(event: any, models: any) {
  // Look up the agentId for the call so we can scope the Socket.IO event
  const callControlId = event.call_control_id;
  let agentId = null;
  if (callControlId) {
    const call = await models.Call.findOne({ where: { callControlId } });
    agentId = call?.agentId || null;
  }

  handleTranscriptionEvent(
    event,
    // emitPartial
    (ccId, data) => emitTranscriptPartial(ccId, data, agentId),
    // emitFinal
    (ccId, data) => emitTranscriptFinal(ccId, data, agentId),
  );
}

/**
 * call.hangup
 * Call ended. Stop transcription, finalise transcript, run AI case notes, emit Socket event.
 */
async function handleCallHangup(event: any, models: any) {
  const { call_control_id: callControlId, hangup_cause: hangupCause } = event;

  logger.info({ callControlId, hangupCause }, 'Call hung up');

  const call = await models.Call.findOne({ where: { callControlId } });
  if (!call) return;

  // Propagate hangup to the bridged leg — if either side hangs up,
  // we tear down the partner leg too. Best-effort, swallow errors.
  try {
    if (call.callPurpose === 'agent_answer' && call.parentCallId) {
      const parent = await models.Call.findByPk(call.parentCallId);
      if (parent && parent.status !== 'ended' && parent.callControlId) {
        await telnyxService.hangupCall(parent.callControlId).catch(() => {});
      }
    } else if (call.callPurpose === 'primary') {
      const sibling = await models.Call.findOne({
        where: { parentCallId: call.id, callPurpose: 'agent_answer' },
      });
      if (sibling && sibling.status !== 'ended' && sibling.callControlId) {
        await telnyxService.hangupCall(sibling.callControlId).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn({ err, callControlId }, 'Error propagating hangup to bridged leg');
  }

  const endedAt = new Date();
  const durationMs: number = call.startedAt ? endedAt.getTime() - new Date(call.startedAt).getTime() : 0;
  const durationSec = Math.round(durationMs / 1000);

  await call.update({ status: 'ended', endedAt });

  // Stop transcription if active and collect final transcript
  let finalTranscript = '';
  let segments = [];

  if (isTranscriptionEnabled()) {
    try {
      await telnyxService.stopTranscription(callControlId).catch(() => {});
    } catch (_) {}
    finalTranscript = getFinalTranscript(callControlId);
    segments = getTranscriptSegments(callControlId);
  }

  // Persist transcript record
  if (finalTranscript) {
    await models.Transcript.upsert({
      callId: call.id,
      fullText: finalTranscript,
      segments,
    });
  }

  // Clean up transcription state
  cleanupTranscription(callControlId);

  // ── SLA: pull from in-memory state (set in handleCallAnswered) ────────
  // For inbound calls, look at the primary leg's state. For agent-answer
  // legs we never get here directly; the primary leg's hangup is what
  // produces the CallRecord. Default to null if the call was never queued.
  const slaState =
    callStates.get(callControlId) ||
    (call.callPurpose === 'agent_answer' && call.parentCallId
      ? callStates.get((await models.Call.findByPk(call.parentCallId))?.callControlId)
      : null);
  const timeToAnswer = slaState?.timeToAnswer ?? null;
  const answeredWithinSla = slaState?.answeredWithinSla ?? null;

  // ── Create CallRecord ─────────────────────────────────────────────────
  const callRecord = await models.CallRecord.create({
    callId: call.id,
    agentId: call.agentId,
    direction: call.direction,
    from: call.from,
    to: call.to,
    status: 'ended',
    queueName: call.queueName,
    duration: durationSec,
    startedAt: call.startedAt,
    endedAt,
    timeToAnswer,
    answeredWithinSla,
    caseNotesStatus: 'pending',
  });

  // Consumed the SLA-tracking enqueue timestamp; clear it.
  acdService.clearEnqueuedAt(call.id);

  // ── Release agent if one was assigned ────────────────────────────────
  if (call.agentId) {
    await acdService.releaseAgent(call.agentId, models);
  }

  // ── Update queue entry and agent session state in DB ─────────────
  await acdService.handleCallEnded(call.id, call.agentId, models);

  // ── If call hung up while still queued (caller abandoned), mark it
  await acdService.dequeueCall(call.id);

  emitCallEnded({ callId: call.id, callControlId, duration: durationSec, agentId: call.agentId });

  // Emit event bus: call ended
  bus.emit('call:ended', { callId: call.id, callControlId, duration: durationSec, agentId: call.agentId, from: call.from, to: call.to, direction: call.direction, queueName: call.queueName, hangupCause });

  // Clean up in-memory state
  callStates.delete(callControlId);

  // ── AI case notes (async, non-blocking) ──────────────────────────────
  setImmediate(() => generateAndSaveCaseNotes(call, callRecord, finalTranscript, models));
}

/**
 * Generate AI case notes post-call.
 * All failures are logged but never re-thrown — the call record always persists.
 */
async function generateAndSaveCaseNotes(call: any, callRecord: any, finalTranscript: string, models: any) {
  try {
    // If transcript is empty, mark and skip
    if (!finalTranscript?.trim()) {
      await callRecord.update({ caseNotesStatus: 'skipped_no_transcript' });
      logger.info({ callId: call.id }, 'No transcript — skipping AI case notes');
      return;
    }

    await callRecord.update({ caseNotesStatus: 'generating' });

    const result = await generateCaseNotes(finalTranscript);

    if (result.skipped) {
      // LLM disabled or errored
      const status = result.reason === 'no_llm_key' ? 'skipped_no_llm_key' : 'error';
      await callRecord.update({ caseNotesStatus: status });
      logger.info({ callId: call.id, reason: result.reason }, 'AI case notes skipped/failed');
      return;
    }

    // Persist CaseNote + Tasks
    const caseNote = await models.CaseNote.create({
      callId: call.id,
      callerName: result.callerName,
      summary: result.summary,
      keyPoints: result.keyPoints,
      sentiment: result.sentiment,
      rawLlmOutput: result.rawLlmOutput,
    });

    if (Array.isArray(result.tasks) && result.tasks.length > 0) {
      await models.Task.bulkCreate(
        result.tasks.map((t) => ({
          caseNoteId: caseNote.id,
          callId: call.id,
          type: t.type || 'follow_up',
          description: t.description || '',
          priority: ['low', 'medium', 'high', 'critical'].includes(t.priority) ? t.priority : 'medium',
          due: t.due ? new Date(t.due) : null,
        })),
      );
    }

    await callRecord.update({ caseNotesStatus: 'done' });

    logger.info({ callId: call.id, sentiment: result.sentiment, taskCount: result.tasks?.length }, 'AI case notes saved');
    emitCaseNotesReady(call.id, { callId: call.id, caseNoteId: caseNote.id, sentiment: result.sentiment }, call.agentId);
  } catch (err) {
    logger.error({ err, callId: call.id }, 'Unexpected error saving AI case notes');
    await callRecord.update({ caseNotesStatus: 'error' }).catch(() => {});
  }
}

// ── Secondary handlers ────────────────────────────────────────────────────────

async function handleCallBridged(event: any, models: any) {
  const { call_control_id: callControlId } = event;
  logger.info({ callControlId }, 'Call bridged');

  const call = await models.Call.findOne({ where: { callControlId } });
  if (call) await call.update({ status: 'active' });
}

async function handleDtmfReceived(event: any, models: any) {
  const { call_control_id: callControlId, digit } = event;
  logger.info({ callControlId, digit }, 'DTMF received');
}

async function handleGatherEnded(event: any, models: any) {
  const { call_control_id: callControlId, digits } = event;
  logger.info({ callControlId, digits }, 'Gather ended');

  const state = callStates.get(callControlId);
  if (!state) return;

  const call = await models.Call.findOne({
    where: { callControlId },
    include: [{ model: models.IvrFlow, as: 'ivrFlow' }],
  });

  if (call?.ivrFlow) {
    handleIvrEvent('call.gather.ended', event, call.ivrFlow, callControlId, telnyxService, acdService, state);
  }
}

async function handleSpeakEnded(event: any, models: any) {
  const { call_control_id: callControlId } = event;
  logger.debug({ callControlId }, 'Speak ended');

  const state = callStates.get(callControlId);
  if (!state) return;

  const call = await models.Call.findOne({
    where: { callControlId },
    include: [{ model: models.IvrFlow, as: 'ivrFlow' }],
  });

  if (call?.ivrFlow) {
    handleIvrEvent('call.speak.ended', event, call.ivrFlow, callControlId, telnyxService, acdService, state);
  }
}

async function handlePlaybackEnded(event: any, models: any) {
  logger.debug({ callControlId: event.call_control_id }, 'Playback ended');
}

async function handleRecordingSaved(event: any, models: any) {
  const { call_control_id: callControlId, recording_url: recordingUrl } = event;
  logger.info({ callControlId, recordingUrl }, 'Recording saved');

  const call = await models.Call.findOne({ where: { callControlId } });
  if (call) {
    await call.update({ recordingUrl });

    const record = await models.CallRecord.findOne({ where: { callId: call.id } });
    if (record) await record.update({ recordingUrl });

    // Broadcast new recording to connected clients
    try {
      emitRecordingSaved(getIO(), {
      id: record?.id || call.id,
      callControlId,
      recordingUrl,
      callId: call.id,
      agentId: call.agentId,
      from: call.from,
      to: call.to,
      direction: call.direction,
      startedAt: call.startedAt,
    });
    } catch { /* Socket not initialized */ }
  }

  // Emit event bus: recording saved
  bus.emit('recording:saved', { callId: call?.id, callControlId, recordingUrl });

  // ── Auto-analyze if enabled ──────────────────────────────────────────
  const autoAnalyze = process.env.TELNYX_AUTO_ANALYZE_CALLS === 'true';
  if (!autoAnalyze || !call) return;

  try {
    const agentId = call.agentId;
    if (!agentId) {
      logger.info({ callControlId }, 'Auto-analyze skipped — no agent assigned');
      return;
    }

    const record = await models.CallRecord.findOne({ where: { callId: call.id } });
    const callRecordId = record?.id || null;

    // Check for existing analysis
    const existing = callRecordId
      ? await models.CallAnalysis.findOne({ where: { callRecordId } })
      : null;
    if (existing) {
      logger.info({ callControlId, analysisId: existing.id }, 'Auto-analyze skipped — analysis already exists');
      return;
    }

    // Check if there's a transcript from real-time transcription
    const transcript = await models.Transcript.findOne({ where: { callId: call.id } });
    const transcriptText = transcript?.fullText || '';

    if (transcriptText) {
      // Transcript available — go straight to analysis
      const analysis = await models.CallAnalysis.create({
        callRecordId,
        agentId,
        audioUrl: recordingUrl,
        transcriptText,
        durationSeconds: record?.duration || null,
        status: 'analyzing',
      });

      // Process async
      setImmediate(async () => {
        const { processUploadedCall } = await import('../services/call-analysis.js');
        await processUploadedCall(analysis, models);
      });

      logger.info({ callControlId, analysisId: analysis.id }, 'Auto-analyze triggered with existing transcript');
    } else if (recordingUrl) {
      // No transcript — queue for offline transcription
      const analysis = await models.CallAnalysis.create({
        callRecordId,
        agentId,
        audioUrl: recordingUrl,
        durationSeconds: record?.duration || null,
        status: 'transcribing',
      });

      // Process async
      setImmediate(async () => {
        const { processUploadedCall } = await import('../services/call-analysis.js');
        await processUploadedCall(analysis, models);
      });

      logger.info({ callControlId, analysisId: analysis.id }, 'Auto-analyze triggered — queued for offline transcription');
    }
  } catch (err) {
    logger.error({ err, callControlId }, 'Auto-analyze failed after recording saved');
  }
}

/**
 * call.machine.detection.ended
 * AMD result — 'human', 'machine', or 'not_sure'.
 * If machine: hang up (or leave voicemail). If human: proceed.
 */
async function handleAmdResult(event: any, models: any) {
  const { call_control_id: callControlId, result } = event;
  logger.info({ callControlId, result }, 'AMD result received');

  const call = await models.Call.findOne({ where: { callControlId } });
  if (!call) return;

  await call.update({ amdResult: result });

  if (result === 'machine') {
    logger.info({ callControlId }, 'AMD detected answering machine — hanging up');
    await telnyxService.hangupCall(callControlId).catch(() => {});
    await call.update({ status: 'ended', endedAt: new Date() });
    emitCallEnded({ callId: call.id, callControlId, hangupCause: 'amd_machine', agentId: call.agentId });
  } else {
    logger.info({ callControlId, result }, 'AMD detected human (or not_sure) — proceeding');
  }
}

// ── SMS Handlers ──────────────────────────────────────────────────────────────

// ── Opt-out / Opt-in keyword sets ──────────────────────────────────────────
const OPT_OUT_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'end', 'quit']);
const OPT_IN_KEYWORDS = new Set(['start', 'yes', 'unstop']);

async function handleSmsReceived(event: any, models: any) {
  // Telnyx messaging payload structure:
  // event.from?.phone_number, event.to?.[0]?.phone_number, event.text
  const fromNumber = event.from?.phone_number || event.from;
  const toNumber = event.to?.[0]?.phone_number || event.to;
  const text = event.text || event.body || '';
  const telnyxMsgId = event.id;
  const media = event.media; // MMS: array of media objects

  logger.info({ from: fromNumber, to: toNumber, textLen: text.length, hasMedia: !!(media && media.length) }, 'SMS received');

  // Find or create contact by phone
  let contact = await models.Contact.findOne({ where: { phoneNumber: fromNumber } });
  let isNewContact = false;
  if (!contact) {
    contact = await models.Contact.create({
      phoneNumber: fromNumber,
      name: fromNumber,
    });
    isNewContact = true;
    logger.info({ contactId: contact.id, phone: fromNumber }, 'Auto-created contact from SMS');
  }

  // ── Number Lookup enrichment (fire-and-forget, cached on contact.metadata.lookup) ─
  // Only run when missing or stale (>30 days). Non-fatal on failure.
  const lookupAge = contact.metadata?.lookup?.lookedUpAt
    ? Date.now() - new Date(contact.metadata.lookup.lookedUpAt).getTime()
    : Infinity;
  const LOOKUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  if (isNewContact || !contact.metadata?.lookup || lookupAge > LOOKUP_TTL_MS) {
    numberLookup(fromNumber, { includeCnam: true })
      .then(async (lookup: any) => {
        const summary = {
          countryCode: lookup?.country_code,
          phoneNumber: lookup?.phone_number,
          carrier: {
            name: lookup?.carrier?.name,
            type: lookup?.carrier?.type,                 // mobile | landline | voip | unknown
            mobileCountryCode: lookup?.carrier?.mobile_country_code,
            mobileNetworkCode: lookup?.carrier?.mobile_network_code,
          },
          portability: lookup?.portability,
          callerName: lookup?.caller_name?.caller_name,
          lookedUpAt: new Date().toISOString(),
        };
        await contact.update({
          metadata: { ...contact.metadata, lookup: summary },
          // Backfill display name from CNAM if we still only have the raw number
          ...((contact.name === fromNumber && summary.callerName)
            ? { name: summary.callerName }
            : {}),
        });
        logger.info({ contactId: contact.id, carrier: summary.carrier?.name, type: summary.carrier?.type }, 'Number lookup enriched contact');
      })
      .catch((err: any) => {
        logger.warn({ err: err?.message, status: err?.status, phone: fromNumber }, 'Number lookup failed (non-fatal)');
      });
  }

  // ── Opt-out handling ──────────────────────────────────────────────────
  const normalizedText = text.trim().toLowerCase();
  if (OPT_OUT_KEYWORDS.has(normalizedText)) {
    await contact.update({
      metadata: {
        ...contact.metadata,
        optOut: true,
        optOutAt: new Date(),
      },
    });
    logger.info({ contactId: contact.id, phone: fromNumber, keyword: normalizedText }, 'SMS opt-out received');
    try {
      await telnyxSendSms(toNumber, fromNumber, 'You have been unsubscribed. Reply START to resubscribe.');
    } catch (err) {
      logger.error({ err }, 'Failed to send opt-out confirmation SMS');
    }
    return;
  }

  // ── Opt-in handling ──────────────────────────────────────────────────
  if (OPT_IN_KEYWORDS.has(normalizedText)) {
    await contact.update({
      metadata: {
        ...contact.metadata,
        optOut: false,
        optInAt: new Date(),
      },
    });
    logger.info({ contactId: contact.id, phone: fromNumber, keyword: normalizedText }, 'SMS opt-in received');
    try {
      await telnyxSendSms(toNumber, fromNumber, 'You have been resubscribed.');
    } catch (err) {
      logger.error({ err }, 'Failed to send opt-in confirmation SMS');
    }
    // Continue processing the message — don't return
  }

  // ── Sticky sender / find existing conversation ────────────────────────
  let conversation = await models.Conversation.findOne({
    where: {
      channel: 'sms',
      status: { [Op.ne]: 'closed' },
      visitorPhone: fromNumber,
    },
  });

  if (!conversation) {
    // Use sticky sender to pick the Telnyx number for this conversation
    let telnyxNumber: string | null = toNumber;
    try {
      telnyxNumber = await getStickySender(fromNumber, models);
    } catch (err) {
      logger.warn({ err, fromNumber }, 'Sticky sender failed — using inbound to number');
    }

    conversation = await models.Conversation.create({
      channel: 'sms',
      status: 'waiting',
      visitorName: contact.name || fromNumber,
      visitorPhone: fromNumber,
      contactId: contact.id,
      telnyxNumber: telnyxNumber || toNumber,
    });

    // Notify agents of new SMS conversation
    emitChatNew(conversation);

    // ── SMS Queue Routing via ACD ───────────────────────────────────────
    try {
      const queueName = 'sms';
      const assignedAgent = await acdService.findAvailableAgent(models, queueName);
      if (assignedAgent) {
        await conversation.update({ agentId: assignedAgent.id, status: 'active' });
        logger.info({ conversationId: conversation.id, agentId: assignedAgent.id }, 'SMS conversation auto-assigned via ACD');

        try {
          const io = getIO();
          io.to(`agent:${assignedAgent.id}`).emit('chat:accepted', {
            conversationId: conversation.id,
            agentId: assignedAgent.id,
          });
          io.to(`conversation:${conversation.id}`).emit('chat:accepted', {
            conversationId: conversation.id,
            agentId: assignedAgent.id,
          });
        } catch { /* socket not ready */ }
      }
    } catch (err) {
      logger.warn({ err, conversationId: conversation.id }, 'SMS ACD auto-assign failed (non-fatal)');
    }
  }

  // ── MMS: handle inbound media ─────────────────────────────────────────
  let contentType: string = 'text';
  let contentText: string = text;
  let messageMetadata: any = {};

  if (media && Array.isArray(media) && media.length > 0) {
    const firstMedia = media[0];
    const mediaUrl = firstMedia.url || firstMedia.content_url;
    const mediaType = firstMedia.content_type || firstMedia.type || '';

    if (mediaUrl) {
      try {
        const stored = await downloadAndStoreMedia(mediaUrl, mediaType);
        contentType = mediaType.startsWith('image/') ? 'image' : 'file';
        messageMetadata = {
          fileUrl: stored.fileUrl,
          fileName: stored.fileName,
          mimeType: mediaType,
          mediaSource: 'mms',
        };
        if (!contentText) {
          contentText = stored.fileName || 'MMS attachment';
        }
      } catch (err) {
        logger.error({ err, mediaUrl }, 'Failed to download/store MMS media');
        contentType = 'text';
        contentText = text || '[MMS media — download failed]';
        messageMetadata = { mmsMediaUrl: mediaUrl, mmsError: (err as any).message };
      }
    }
  }

  // Create message
  const message = await models.Message.create({
    conversationId: conversation.id,
    sender: 'visitor',
    content: contentText,
    contentType,
    metadata: messageMetadata,
    externalId: telnyxMsgId,
  });

  // Emit to conversation room + agents
  emitChatMessage(conversation.id, {
    id: message.id,
    conversationId: conversation.id,
    senderType: 'visitor',
    content: contentText,
    contentType,
    createdAt: message.createdAt,
  });

  logger.info({ conversationId: conversation.id, messageId: message.id }, 'SMS message stored and emitted');
}

async function handleSmsStatus(event: any, models: any) {
  const telnyxMsgId = event.id;
  const eventType = event.event_type || '';
  // Telnyx event types we care about:
  //   message.sent | message.delivered | message.delivery_failed | message.finalized
  // Telnyx "message.finalized" carries to[].status + errors[] with the *terminal* state.
  let status = eventType.replace('message.', '') || 'unknown';
  let errors: any[] | undefined;

  if (eventType === 'message.finalized') {
    // Pick the worst per-recipient status as the message status
    const recipients: any[] = Array.isArray(event.to) ? event.to : [];
    const statuses = recipients.map((r) => r?.status).filter(Boolean);
    if (statuses.includes('delivery_failed')) status = 'failed';
    else if (statuses.includes('delivered')) status = 'delivered';
    else if (statuses.includes('sent')) status = 'sent';
    else status = statuses[0] || 'finalized';
    if (Array.isArray(event.errors) && event.errors.length > 0) errors = event.errors;
  } else if (eventType === 'message.delivery_failed') {
    status = 'failed';
    if (Array.isArray(event.errors) && event.errors.length > 0) errors = event.errors;
  }

  logger.info({ telnyxMsgId, eventType, status, errorCount: errors?.length || 0 }, 'SMS status update');

  if (!telnyxMsgId) return;
  const msg = await models.Message.findOne({ where: { externalId: telnyxMsgId } });
  if (!msg) return;

  const newMeta = { ...(msg.metadata || {}) };
  if (errors && errors.length > 0) {
    newMeta.deliveryErrors = errors.map((e: any) => ({
      code: e.code,
      title: e.title,
      detail: e.detail,
    }));
  }
  await msg.update({ status, metadata: newMeta });
  logger.info({ messageId: msg.id, status }, 'SMS message status updated');

  // Notify the inbox so the agent sees status change live
  try {
    const { emitMessageStatus } = await import('../services/socket.js');
    emitMessageStatus(msg.conversationId, {
      id: msg.id,
      conversationId: msg.conversationId,
      status,
      deliveryErrors: newMeta.deliveryErrors,
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to emit SMS status to socket');
  }
}
