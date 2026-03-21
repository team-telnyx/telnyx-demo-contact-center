import { env } from '../config/env.js';
import Telnyx from 'telnyx';
import IvrFlow from '../../models/IvrFlow.js';

const telnyx = new Telnyx({ apiKey: env.TELNYX_API });

// In-memory session tracking: callControlId → session
const ivrSessions = new Map();

// Normalize phone number: strip sip: prefix, extract E.164
function normalizePhone(raw) {
  if (!raw) return raw;
  // Remove sip: prefix and anything after @
  let num = raw.replace(/^sip:/, '').split('@')[0];
  // Remove tel: prefix
  num = num.replace(/^tel:/, '');
  // If it's already E.164 (+digits), return as-is
  if (/^\+\d+$/.test(num)) return num;
  return num;
}

async function getActiveFlow(phoneNumber) {
  const normalized = normalizePhone(phoneNumber);
  console.log(`[IVR] Looking up flow for normalized number: ${normalized} (raw: ${phoneNumber})`);
  return IvrFlow.findOne({ where: { phoneNumber: normalized, active: true } });
}

async function startSession(callControlId, phoneNumber) {
  const flow = await getActiveFlow(phoneNumber);
  if (!flow) return null;

  const flowData = flow.flowData;
  if (!flowData?.nodes) return null;

  const entryNode = flowData.nodes.find((n) => n.type === 'incomingCall');
  if (!entryNode) return null;

  const session = {
    flowId: flow.id,
    flowData,
    currentNodeId: entryNode.id,
    callControlId,
    gatherPending: false,
  };
  ivrSessions.set(callControlId, session);

  // Execute from entry node's first connection
  const nextNodeId = getNextNode(flowData, entryNode.id);
  if (nextNodeId) {
    session.currentNodeId = nextNodeId;
    await executeNode(session, nextNodeId, callControlId);
  }

  return session;
}

async function handleGatherResult(callControlId, digits) {
  const session = ivrSessions.get(callControlId);
  if (!session?.gatherPending) return false;

  session.gatherPending = false;
  const { flowData, currentNodeId } = session;
  const digit = digits.trim();

  // Try digit-specific edge first
  const edge = flowData.edges.find(
    (e) => e.source === currentNodeId && e.sourceHandle === `digit-${digit}`
  );
  if (edge) {
    session.currentNodeId = edge.target;
    await executeNode(session, edge.target, callControlId);
    return true;
  }

  // Fallback: edge without specific handle
  const defaultEdge = flowData.edges.find(
    (e) => e.source === currentNodeId && !e.sourceHandle
  );
  if (defaultEdge) {
    session.currentNodeId = defaultEdge.target;
    await executeNode(session, defaultEdge.target, callControlId);
    return true;
  }

  return false;
}

async function handleMediaEnded(callControlId) {
  const session = ivrSessions.get(callControlId);
  if (!session || session.gatherPending) return false;

  const nextNodeId = getNextNode(session.flowData, session.currentNodeId);
  if (nextNodeId) {
    session.currentNodeId = nextNodeId;
    await executeNode(session, nextNodeId, callControlId);
    return true;
  }
  return false;
}

function endSession(callControlId) {
  ivrSessions.delete(callControlId);
}

function hasSession(callControlId) {
  return ivrSessions.has(callControlId);
}

// ─── Helpers ───

function getNextNode(flowData, nodeId) {
  const edge = flowData.edges.find((e) => e.source === nodeId && !e.sourceHandle);
  return edge ? edge.target : null;
}

function getNode(flowData, nodeId) {
  return flowData.nodes.find((n) => n.id === nodeId);
}

// Auto-advance: execute next node immediately without waiting for webhook
async function autoAdvance(session, nodeId, callControlId) {
  const nextNodeId = getNextNode(session.flowData, nodeId);
  if (nextNodeId) {
    session.currentNodeId = nextNodeId;
    await executeNode(session, nextNodeId, callControlId);
  }
}

async function executeNode(session, nodeId, ccid) {
  const node = getNode(session.flowData, nodeId);
  if (!node) return;

  const d = node.data;
  console.log(`[IVR] ${node.type}: ${d.label} (call: ${ccid})`);

  try {
    switch (node.type) {
      // ── Core Call Control ──
      case 'answer':
        await telnyx.calls.actions.answer(ccid);
        break;

      case 'reject':
        await telnyx.calls.actions.reject(ccid, { cause: d.cause || 'CALL_REJECTED' });
        endSession(ccid);
        break;

      case 'hangup':
        await telnyx.calls.actions.hangup(ccid);
        endSession(ccid);
        break;

      case 'transfer':
        await telnyx.calls.actions.transfer(ccid, { to: d.to, from: d.from || undefined });
        break;

      case 'bridge':
        await telnyx.calls.actions.bridge(ccid, {
          call_control_id_to_bridge_with: d.callControlId, park_after_unbridge: d.parkAfterUnbridge || 'self',
        });
        break;

      case 'dial':
        await telnyx.calls.dial({
          connection_id: d.connectionId || env.TELNYX_CONNECTION_ID,
          to: d.to,
          from: d.from || undefined,
        });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'hold':
        // hold/unhold not available as SDK methods — use raw post with encoding
        if (d.unhold) {
          await telnyx.post(`/v2/calls/${encodeURIComponent(ccid)}/actions/unhold`, { body: {} });
        } else {
          await telnyx.post(`/v2/calls/${encodeURIComponent(ccid)}/actions/hold`, {
            body: { audio_url: d.audioUrl || undefined },
          });
        }
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'sendDTMF':
        await telnyx.calls.actions.sendDtmf(ccid, { digits: d.digits, duration_millis: d.durationMs || 250 });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'refer':
        await telnyx.calls.actions.refer(ccid, { sip_address: d.sipAddress });
        break;

      case 'clientStateUpdate':
        await telnyx.calls.actions.updateClientState(ccid, {
          client_state: Buffer.from(d.clientState || '').toString('base64'),
        });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'sendSipInfo':
        await telnyx.calls.actions.sendSipInfo(ccid, { content_type: d.sipInfoType, body: d.sipInfoBody });
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Media ──
      case 'speak':
        await telnyx.calls.actions.speak(ccid, {
          payload: d.payload || 'Hello', voice: d.voice || 'female', language: d.language || 'en-US',
        });
        break;

      case 'playAudio':
        await telnyx.calls.actions.startPlayback(ccid, {
          audio_url: d.audioUrl,
          loop: d.loop === 'infinite' ? 'infinity' : undefined,
          overlay: d.overlay || false,
        });
        break;

      case 'playbackStop':
        await telnyx.calls.actions.stopPlayback(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Gather / DTMF Routing ──
      case 'gather':
        session.gatherPending = true;
        await telnyx.calls.actions.gatherUsingSpeak(ccid, {
          payload: d.payload || 'Please make a selection.',
          voice: d.voice || 'female',
          language: d.language || 'en-US',
          maximum_digits: parseInt(d.maxDigits) || 1,
          timeout_millis: (parseInt(d.timeout) || 10) * 1000,
          valid_digits: (d.digits || '1,2,3').replace(/,/g, ''),
        });
        break;

      case 'gatherAudio':
        session.gatherPending = true;
        await telnyx.calls.actions.gatherUsingAudio(ccid, {
          audio_url: d.audioUrl,
          maximum_digits: parseInt(d.maxDigits) || 1,
          timeout_millis: (parseInt(d.timeout) || 10) * 1000,
        });
        break;

      case 'gatherAI':
        session.gatherPending = true;
        await telnyx.calls.actions.gatherUsingAI(ccid, {
          model: d.model || undefined, prompt: d.prompt || undefined,
        });
        break;

      case 'gatherStop':
        await telnyx.calls.actions.stopGather(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Queue ──
      case 'enqueue':
        await telnyx.calls.actions.enqueue(ccid, { queue_name: d.queueName || 'General_Queue' });
        break;

      case 'leaveQueue':
        await telnyx.calls.actions.leaveQueue(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Recording ──
      case 'recordStart':
        await telnyx.calls.actions.startRecording(ccid, {
          format: d.format || 'mp3',
          channels: d.channels || 'dual',
          max_length: d.maxLength ? parseInt(d.maxLength) : undefined,
          trim_silence: d.trimSilence === 'true',
        });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'recordStop':
        await telnyx.calls.actions.stopRecording(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'recordPause':
        await telnyx.calls.actions.pauseRecording(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'recordResume':
        await telnyx.calls.actions.resumeRecording(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'siprecStart':
        await telnyx.calls.actions.startSiprec(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'siprecStop':
        await telnyx.calls.actions.stopSiprec(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Streaming / Transcription / Fork ──
      case 'streamingStart':
        await telnyx.calls.actions.startStreaming(ccid, {
          stream_url: d.streamUrl, stream_track: d.streamTrack || 'both_tracks',
        });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'streamingStop':
        await telnyx.calls.actions.stopStreaming(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'transcriptionStart':
        await telnyx.calls.actions.startTranscription(ccid, { language: d.language || 'en' });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'transcriptionStop':
        await telnyx.calls.actions.stopTranscription(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'forkStart':
        await telnyx.calls.actions.startForking(ccid, {
          target: d.target, stream_type: d.streamType || 'raw',
        });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'forkStop':
        await telnyx.calls.actions.stopForking(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── AI ──
      case 'noiseSuppressionStart':
        await telnyx.calls.actions.startNoiseSuppression(ccid, { direction: d.direction || 'both' });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'noiseSuppressionStop':
        await telnyx.calls.actions.stopNoiseSuppression(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'aiAssistantStart':
        await telnyx.calls.actions.startAIAssistant(ccid, {
          model: d.model || undefined, system_prompt: d.systemPrompt || undefined,
        });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'aiAssistantStop':
        await telnyx.calls.actions.stopAIAssistant(ccid);
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Conference ──
      case 'conference':
        await telnyx.conferences.create({
          call_control_id: ccid,
          name: d.conferenceName || 'conf-' + Date.now(),
          beep_enabled: d.beepEnabled || 'always',
          start_conference_on_create: true,
        });
        break;

      default:
        console.log(`[IVR] Unknown node: ${node.type}`);
        await autoAdvance(session, nodeId, ccid);
    }
  } catch (error) {
    console.error(`[IVR] Error executing ${node.type}:`, error.message);
  }
}

export { getActiveFlow, startSession, handleGatherResult, handleMediaEnded, endSession, hasSession };
