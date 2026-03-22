import { getOrgTelnyxClient } from './org-telnyx.js';
import IvrFlow from '../../models/IvrFlow.js';

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

  // Use published version for execution, fall back to draft
  const flowData = flow.publishedFlowData || flow.flowData;
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

// Helper: strip empty/default values so only explicitly configured params are sent to the API
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || v === 0 || v === false) continue;
    out[k] = v;
  }
  return out;
}

// Helper: resolve voice param — provider voice IDs go as 'voice' (provider format), simple goes as 'voice'
function resolveVoice(voice) {
  if (!voice || voice === 'female' || voice === 'male') return { voice: voice || 'female' };
  return { voice: voice }; // Provider format like AWS.Polly.Joanna-Neural
}

async function executeNode(session, nodeId, ccid) {
  const telnyx = await getOrgTelnyxClient();
  const node = getNode(session.flowData, nodeId);
  if (!node) return;

  const d = node.data;
  console.log(`[IVR] ${node.type}: ${d.label} (call: ${ccid})`);

  try {
    switch (node.type) {
      // ── Core Call Control ──
      case 'answer': {
        const answerBody = {};
        if (d.clientState) answerBody.client_state = Buffer.from(d.clientState).toString('base64');
        if (d.preferredCodecs) answerBody.preferred_codecs = d.preferredCodecs;
        if (d.record === 'record-from-answer' || d.record === 'record-from-ringing') answerBody.record = d.record;
        if (answerBody.record) {
          if (d.recordFormat) answerBody.record_format = d.recordFormat;
          if (d.recordChannels) answerBody.record_channels = d.recordChannels;
          if (d.recordMaxLength && parseInt(d.recordMaxLength) > 0) answerBody.record_max_length = parseInt(d.recordMaxLength);
          if (d.recordTimeoutSecs && parseInt(d.recordTimeoutSecs) > 0) answerBody.record_timeout_secs = parseInt(d.recordTimeoutSecs);
          if (d.recordTrack && d.recordTrack !== 'both') answerBody.record_track = d.recordTrack;
          if (d.recordTrim) answerBody.record_trim = d.recordTrim;
          if (d.recordCustomFileName) answerBody.record_custom_file_name = d.recordCustomFileName;
        }
        if (d.sendSilenceWhenIdle === true) answerBody.send_silence_when_idle = true;
        if (d.streamUrl) {
          answerBody.stream_url = d.streamUrl;
          if (d.streamTrack) answerBody.stream_track = d.streamTrack;
        }
        if (d.webhookUrl) answerBody.webhook_url = d.webhookUrl;
        await telnyx.calls.actions.answer(ccid, answerBody);
        break;
      }

      case 'reject':
        await telnyx.calls.actions.reject(ccid, clean({
          cause: d.cause || 'CALL_REJECTED',
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        endSession(ccid);
        break;

      case 'hangup':
        await telnyx.calls.actions.hangup(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        endSession(ccid);
        break;

      case 'transfer':
        await telnyx.calls.actions.transfer(ccid, clean({
          to: d.to,
          from: d.from || undefined,
          from_display_name: d.fromDisplayName || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
          webhook_url: d.webhookUrl || undefined,
          timeout_secs: d.timeoutSecs ? parseInt(d.timeoutSecs) : undefined,
          time_limit_secs: d.timeLimitSecs ? parseInt(d.timeLimitSecs) : undefined,
          park_after_unbridge: d.parkAfterUnbridge || undefined,
          sip_auth_username: d.sipAuthUsername || undefined,
          sip_auth_password: d.sipAuthPassword || undefined,
          record: d.record || undefined,
          record_format: d.recordFormat || undefined,
          record_channels: d.recordChannels || undefined,
          record_track: d.recordTrack || undefined,
          record_max_length: d.recordMaxLength ? parseInt(d.recordMaxLength) : undefined,
          answering_machine_detection: d.answeringMachineDetection || undefined,
          audio_url: d.audioUrl || undefined,
        }));
        break;

      case 'bridge':
        await telnyx.calls.actions.bridge(ccid, clean({
          call_control_id_to_bridge_with: d.callControlId,
          park_after_unbridge: d.parkAfterUnbridge || 'self',
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
          play_ringtone: d.playRingtone || undefined,
          ringtone: d.ringtone || undefined,
          hold_after_unbridge: d.holdAfterUnbridge || undefined,
          mute_dtmf: d.muteDtmf !== 'none' ? d.muteDtmf : undefined,
          prevent_double_bridge: d.preventDoubleBridge || undefined,
          queue: d.queue || undefined,
          record: d.record || undefined,
          record_format: d.recordFormat || undefined,
          record_channels: d.recordChannels || undefined,
          record_track: d.recordTrack || undefined,
          record_max_length: d.recordMaxLength ? parseInt(d.recordMaxLength) : undefined,
        }));
        break;

      case 'dial':
        await telnyx.calls.dial(clean({
          connection_id: d.connectionId,
          to: d.to,
          from: d.from || undefined,
          from_display_name: d.fromDisplayName || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
          timeout_secs: d.timeoutSecs ? parseInt(d.timeoutSecs) : undefined,
          time_limit_secs: d.timeLimitSecs ? parseInt(d.timeLimitSecs) : undefined,
          webhook_url: d.webhookUrl || undefined,
          record: d.record || undefined,
          record_format: d.recordFormat || undefined,
          sip_auth_username: d.sipAuthUsername || undefined,
          sip_auth_password: d.sipAuthPassword || undefined,
          answering_machine_detection: d.answeringMachineDetection || undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'sendDTMF':
        await telnyx.calls.actions.sendDtmf(ccid, clean({
          digits: d.digits,
          duration_millis: parseInt(d.durationMs) || 250,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'refer':
        await telnyx.calls.actions.refer(ccid, clean({
          sip_address: d.sipAddress,
          sip_auth_username: d.sipAuthUsername || undefined,
          sip_auth_password: d.sipAuthPassword || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        break;

      case 'clientStateUpdate':
        await telnyx.calls.actions.updateClientState(ccid, {
          client_state: Buffer.from(d.clientState || '').toString('base64'),
        });
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'sendSipInfo':
        await telnyx.calls.actions.sendSipInfo(ccid, {
          content_type: d.sipInfoType,
          body: d.sipInfoBody,
        });
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Media ──
      case 'speak': {
        await telnyx.calls.actions.speak(ccid, clean({
          payload: d.payload || 'Hello',
          ...resolveVoice(d.voice),
          language: d.language || 'en-US',
          payload_type: d.payloadType || 'text',
          service_level: d.serviceLevel || 'premium',
          loop: d.loop ? parseInt(d.loop) : undefined,
          target_legs: d.targetLegs || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        break;
      }

      case 'playAudio':
        await telnyx.calls.actions.startPlayback(ccid, clean({
          audio_url: d.audioUrl || undefined,
          media_name: d.mediaName || undefined,
          audio_type: d.audioType || undefined,
          loop: d.loop ? parseInt(d.loop) : undefined,
          overlay: d.overlay || false,
          target_legs: d.targetLegs || undefined,
          cache_audio: d.cacheAudio !== false,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        break;

      case 'playbackStop':
        await telnyx.calls.actions.stopPlayback(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Gather / DTMF Routing ──
      case 'gather': {
        session.gatherPending = true;
        await telnyx.calls.actions.gatherUsingSpeak(ccid, clean({
          payload: d.payload || 'Please make a selection.',
          ...resolveVoice(d.voice),
          language: d.language || 'en-US',
          payload_type: d.payloadType || 'text',
          service_level: d.serviceLevel || 'premium',
          maximum_digits: parseInt(d.maxDigits) || 1,
          minimum_digits: d.minDigits ? parseInt(d.minDigits) : undefined,
          timeout_millis: (parseInt(d.timeout) || 10) * 1000,
          inter_digit_timeout_millis: d.interDigitTimeout ? parseInt(d.interDigitTimeout) * 1000 : undefined,
          valid_digits: (d.digits || '1,2,3').replace(/,/g, ''),
          invalid_payload: d.invalidPayload || undefined,
          maximum_tries: d.maxTries ? parseInt(d.maxTries) : undefined,
          terminating_digit: d.terminatingDigit || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        break;
      }

      case 'gatherAudio':
        session.gatherPending = true;
        await telnyx.calls.actions.gatherUsingAudio(ccid, clean({
          audio_url: d.audioUrl || undefined,
          media_name: d.mediaName || undefined,
          invalid_audio_url: d.invalidAudioUrl || undefined,
          invalid_media_name: d.invalidMediaName || undefined,
          maximum_digits: parseInt(d.maxDigits) || 1,
          minimum_digits: d.minDigits ? parseInt(d.minDigits) : undefined,
          timeout_millis: (parseInt(d.timeout) || 10) * 1000,
          inter_digit_timeout_millis: d.interDigitTimeout ? parseInt(d.interDigitTimeout) * 1000 : undefined,
          maximum_tries: d.maxTries ? parseInt(d.maxTries) : undefined,
          valid_digits: d.validDigits || undefined,
          terminating_digit: d.terminatingDigit || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        break;

      case 'gatherAI':
        session.gatherPending = true;
        await telnyx.calls.actions.gatherUsingAI(ccid, clean({
          parameters: { properties: '', required: '', type: '' },
          greeting: d.greeting || undefined,
          gather_ended_speech: d.gatherEndedSpeech || undefined,
          ...resolveVoice(d.voice),
          language: d.language || undefined,
          user_response_timeout_ms: d.userResponseTimeoutMs ? parseInt(d.userResponseTimeoutMs) : undefined,
          send_partial_results: d.sendPartialResults || undefined,
          send_message_history_updates: d.sendMessageHistoryUpdates || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        break;

      case 'gatherStop':
        await telnyx.calls.actions.stopGather(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Queue ──
      case 'enqueue':
        await telnyx.calls.actions.enqueue(ccid, clean({
          queue_name: d.queueName || 'General_Queue',
          max_size: d.maxSize ? parseInt(d.maxSize) : undefined,
          max_wait_time_secs: d.maxWaitTimeSecs ? parseInt(d.maxWaitTimeSecs) : undefined,
          keep_after_hangup: d.keepAfterHangup || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        break;

      case 'leaveQueue':
        await telnyx.calls.actions.leaveQueue(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Recording ──
      case 'recordStart':
        await telnyx.calls.actions.startRecording(ccid, clean({
          format: d.format || 'mp3',
          channels: d.channels || 'dual',
          max_length: d.maxLength ? parseInt(d.maxLength) : undefined,
          play_beep: d.playBeep || undefined,
          recording_track: d.recordingTrack || 'both',
          timeout_secs: d.timeoutSecs ? parseInt(d.timeoutSecs) : undefined,
          custom_file_name: d.customFileName || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'recordStop':
        await telnyx.calls.actions.stopRecording(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'recordPause':
        await telnyx.calls.actions.pauseRecording(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'recordResume':
        await telnyx.calls.actions.resumeRecording(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'siprecStart':
        await telnyx.calls.actions.startSiprec(ccid, clean({
          connector_name: d.connectorName || undefined,
          siprec_track: d.siprecTrack || undefined,
          session_timeout_secs: d.sessionTimeoutSecs ? parseInt(d.sessionTimeoutSecs) : undefined,
          secure: d.secure || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'siprecStop':
        await telnyx.calls.actions.stopSiprec(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Streaming / Transcription / Fork ──
      case 'streamingStart':
        await telnyx.calls.actions.startStreaming(ccid, clean({
          stream_url: d.streamUrl,
          stream_track: d.streamTrack || 'both_tracks',
          stream_codec: d.streamCodec || undefined,
          stream_auth_token: d.streamAuthToken || undefined,
          enable_dialogflow: d.enableDialogflow || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'streamingStop':
        await telnyx.calls.actions.stopStreaming(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'transcriptionStart':
        await telnyx.calls.actions.startTranscription(ccid, clean({
          transcription_engine: d.transcriptionEngine || 'Telnyx',
          language: d.language || 'en',
          transcription_tracks: d.transcriptionTracks || 'inbound',
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'transcriptionStop':
        await telnyx.calls.actions.stopTranscription(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'forkStart':
        await telnyx.calls.actions.startForking(ccid, clean({
          target: d.target || undefined,
          rx: d.rx || undefined,
          tx: d.tx || undefined,
          stream_type: d.streamType || 'decrypted',
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'forkStop':
        await telnyx.calls.actions.stopForking(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── AI ──
      case 'noiseSuppressionStart':
        await telnyx.calls.actions.startNoiseSuppression(ccid, clean({
          direction: d.direction || 'both',
          noise_suppression_engine: d.engine || 'Krisp',
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'noiseSuppressionStop':
        await telnyx.calls.actions.stopNoiseSuppression(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'aiAssistantStart':
        await telnyx.calls.actions.startAIAssistant(ccid, clean({
          ...resolveVoice(d.voice),
          greeting: d.greeting || undefined,
          assistant: d.systemPrompt ? { system_prompt: d.systemPrompt } : undefined,
          send_message_history_updates: d.sendMessageHistoryUpdates || undefined,
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      case 'aiAssistantStop':
        await telnyx.calls.actions.stopAIAssistant(ccid, clean({
          client_state: d.clientState ? Buffer.from(d.clientState).toString('base64') : undefined,
        }));
        await autoAdvance(session, nodeId, ccid);
        break;

      // ── Conference ──
      case 'conference':
        await telnyx.conferences.create(clean({
          call_control_id: ccid,
          name: d.conferenceName || 'conf-' + Date.now(),
          beep_enabled: d.beepEnabled || 'always',
          start_conference_on_create: d.startOnCreate !== false,
          max_participants: d.maxParticipants ? parseInt(d.maxParticipants) : undefined,
        }));
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
