import logger from '../middleware/errorHandler.js';

function buildAdjacency(flow: any): Record<string, any[]> {
  const adj: Record<string, any[]> = {};
  for (const node of flow.nodes) { adj[node.id] = []; }
  for (const edge of flow.edges) {
    if (!adj[edge.source]) adj[edge.source] = [];
    adj[edge.source].push(edge);
  }
  return adj;
}

function findEntryNode(flow: any): any {
  const answer = flow.nodes.find((n: any) => n.type === 'answer');
  if (answer) return answer;
  return flow.nodes[0] || null;
}

function resolveNextNode(adj: Record<string, any[]>, flow: any, currentNodeId: string, gatherResult: string | null = null): any {
  const edges = adj[currentNodeId] || [];
  if (gatherResult !== null) {
    const match = edges.find((e: any) => e.sourceHandle === gatherResult);
    if (match) return flow.nodes.find((n: any) => n.id === match.target);
  }
  const defaultEdge = edges.find((e: any) => !e.sourceHandle) || edges[0];
  if (defaultEdge) return flow.nodes.find((n: any) => n.id === defaultEdge.target);
  return null;
}

export async function executeIvrFlow(flow: any, callControlId: string, telnyxService: any, acdService: any, state: Record<string, any> = {}) {
  const adj = buildAdjacency(flow);

  if (!state.currentNodeId) {
    state.currentNodeId = findEntryNode(flow)?.id;
  }

  const currentNode = flow.nodes.find((n: any) => n.id === state.currentNodeId);
  if (!currentNode) {
    logger.warn({ callControlId }, 'No current node — IVR flow ended');
    return;
  }

  logger.info({ callControlId, nodeId: currentNode.id, type: currentNode.type }, 'Executing IVR node');

  switch (currentNode.type) {
    case 'answer':
      await telnyxService.answerCall(callControlId);
      advanceToNext(adj, flow, currentNode.id, null, callControlId, telnyxService, acdService, state);
      break;
    case 'speak':
      await telnyxService.speakOnCall(callControlId, currentNode.data.text || 'No message configured', { voice: currentNode.data.voice, language: currentNode.data.language });
      state.pendingAdvance = { nodeId: currentNode.id, gatherResult: null };
      break;
    case 'gather':
      await telnyxService.gatherDtmf(callControlId, { minDigits: currentNode.data.minDigits || 1, maxDigits: currentNode.data.maxDigits || 1, timeout: currentNode.data.timeout || 10000, validDigits: currentNode.data.validDigits });
      state.pendingGather = { nodeId: currentNode.id };
      break;
    case 'enqueue': {
      const queueName = currentNode.data.queueName || currentNode.data.queue;
      if (queueName) { acdService.enqueueCall(state.callId, queueName); logger.info({ callControlId, queueName }, 'Call enqueued via IVR'); }
      break;
    }
    case 'transfer': {
      const target = currentNode.data.target || currentNode.data.number;
      if (target) {
        logger.info({ callControlId, target }, 'Transferring call');
        await telnyxService.transferCall(callControlId, target).catch((err: any) => logger.error({ err, callControlId, target }, 'Transfer failed'));
      } else { logger.warn({ callControlId }, 'Transfer node has no target number — skipping'); }
      break;
    }
    case 'record':
      logger.info({ callControlId }, 'Record node — starting recording');
      await telnyxService.startRecording(callControlId).catch((err: any) => logger.error({ err, callControlId }, 'Failed to start recording — continuing'));
      advanceToNext(adj, flow, currentNode.id, null, callControlId, telnyxService, acdService, state);
      break;
    case 'hangup':
      await telnyxService.hangupCall(callControlId);
      break;
    case 'play': {
      const audioUrl = currentNode.data.audioUrl || currentNode.data.url;
      if (audioUrl) {
        await telnyxService.playAudio(callControlId, audioUrl);
        state.pendingAdvance = { nodeId: currentNode.id, gatherResult: null };
      } else {
        logger.warn({ callControlId }, 'Play node has no audioUrl — skipping');
        advanceToNext(adj, flow, currentNode.id, null, callControlId, telnyxService, acdService, state);
      }
      break;
    }
    case 'amd': {
      const amdType = currentNode.data.type || 'detect';
      await telnyxService.enableAmd(callControlId, { type: amdType }).catch((err: any) => logger.error({ err, callControlId }, 'Failed to start AMD'));
      advanceToNext(adj, flow, currentNode.id, null, callControlId, telnyxService, acdService, state);
      break;
    }
    case 'callback': {
      await telnyxService.speakOnCall(callControlId, currentNode.data.message || 'Press 1 to receive a callback when an agent is available, or stay on the line to wait.');
      state.pendingAdvance = { nodeId: currentNode.id, gatherResult: null };
      break;
    }
    case 'voicemail': {
      const vmMessage = currentNode.data.message || 'Please leave a message after the tone.';
      await telnyxService.speakOnCall(callControlId, vmMessage);
      state._voicemailPending = true;
      state.pendingAdvance = { nodeId: currentNode.id, gatherResult: null };
      break;
    }
    case 'whisper': {
      const whisperText = currentNode.data.message || currentNode.data.text;
      if (whisperText) {
        await telnyxService.speakOnCall(callControlId, whisperText, { voice: currentNode.data.voice || 'female' });
        state.pendingAdvance = { nodeId: currentNode.id, gatherResult: null };
      } else {
        advanceToNext(adj, flow, currentNode.id, null, callControlId, telnyxService, acdService, state);
      }
      break;
    }
    default:
      logger.warn({ type: currentNode.type }, 'Unknown IVR node type');
  }
}

function advanceToNext(adj: Record<string, any[]>, flow: any, currentNodeId: string, gatherResult: string | null, callControlId: string, telnyxService: any, acdService: any, state: Record<string, any>) {
  const nextNode = resolveNextNode(adj, flow, currentNodeId, gatherResult);
  if (nextNode) { state.currentNodeId = nextNode.id; executeIvrFlow(flow, callControlId, telnyxService, acdService, state); }
  else { logger.info({ callControlId }, 'IVR flow complete — no more nodes'); }
}

export function handleIvrEvent(eventType: string, event: any, flow: any, callControlId: string, telnyxService: any, acdService: any, state: Record<string, any>) {
  const adj = buildAdjacency(flow);

  if ((eventType === 'call.speak.ended' || eventType === 'call.playback.ended') && state.pendingAdvance) {
    const { nodeId, gatherResult } = state.pendingAdvance;
    state.pendingAdvance = null;
    if (state._voicemailPending) {
      state._voicemailPending = false;
      telnyxService.startRecording(callControlId, { format: 'mp3' }).catch((err: any) => logger.error({ err, callControlId }, 'Failed to start voicemail recording'));
      return;
    }
    const nextNode = resolveNextNode(adj, flow, nodeId, gatherResult);
    if (nextNode) { state.currentNodeId = nextNode.id; executeIvrFlow(flow, callControlId, telnyxService, acdService, state); }
  }

  if (eventType === 'call.gather.ended' && state.pendingGather) {
    const { nodeId } = state.pendingGather;
    state.pendingGather = null;
    const digits = event.digits || event.digit || '';
    const gatherResult = digits.toString();
    state.lastGatherResult = gatherResult;
    const nextNode = resolveNextNode(adj, flow, nodeId, gatherResult);
    if (nextNode) { state.currentNodeId = nextNode.id; executeIvrFlow(flow, callControlId, telnyxService, acdService, state); }
  }
}
