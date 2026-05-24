import logger from '../middleware/errorHandler.js';

const activeConnections = new Map<string, any>();

export function isDeepgramEnabled(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY?.trim());
}

function buildDeepgramUrl(): string {
  const url = new URL('wss://api.deepgram.com/v1/listen');
  url.searchParams.set('encoding', 'mulaw');
  url.searchParams.set('sample_rate', '8000');
  url.searchParams.set('channels', '1');
  url.searchParams.set('interim_results', 'true');
  url.searchParams.set('punctuate', 'true');
  url.searchParams.set('diarize', 'true');
  url.searchParams.set('model', 'nova-3');
  url.searchParams.set('language', 'en-AU');
  return url.toString();
}

export function createDeepgramConnection(
  callControlId: string,
  onTranscript?: (data: { text: string; isFinal: boolean; speaker: number; start: number; end: number }) => void,
) {
  if (!isDeepgramEnabled()) {
    logger.debug({ callControlId }, 'Deepgram disabled — skipping connection');
    return null;
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  const wsUrl = buildDeepgramUrl();

  logger.info({ callControlId, url: wsUrl }, 'Creating Deepgram connection');

  const state: any = { ws: null, segments: [], finalTranscript: '', ready: false };
  activeConnections.set(callControlId, state);

  import('ws').then(({ default: WebSocket }) => {
    const ws = new WebSocket(wsUrl, { headers: { Authorization: `Token ${apiKey}` } });
    state.ws = ws;

    ws.on('open', () => { state.ready = true; logger.info({ callControlId }, 'Deepgram WebSocket open'); });

    ws.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type !== 'Results') return;
        const alt = msg.channel?.alternatives?.[0];
        if (!alt?.transcript) return;
        const isFinal = msg.is_final === true;
        const speaker = alt.words?.[0]?.speaker ?? 0;
        const start = msg.start ?? 0;
        const end = (msg.start ?? 0) + (msg.duration ?? 0);
        const text = alt.transcript;

        if (isFinal) {
          state.finalTranscript += (state.finalTranscript ? ' ' : '') + text;
          state.segments.push({ speaker, text, start, end, is_final: true });
        }

        onTranscript?.({ text, isFinal, speaker, start, end });
      } catch (err) {
        logger.warn({ err, callControlId }, 'Failed to parse Deepgram message');
      }
    });

    ws.on('error', (err: any) => { logger.error({ err, callControlId }, 'Deepgram WebSocket error'); state.ready = false; });
    ws.on('close', (code: number, reason: any) => { state.ready = false; logger.info({ callControlId, code }, 'Deepgram WebSocket closed'); activeConnections.delete(callControlId); });
  }).catch((err: any) => { logger.error({ err }, 'Failed to import ws module for Deepgram'); });

  return {
    get state() { return state; },
    sendAudio(audioBuffer: Buffer) { if (state.ws?.readyState === 1) state.ws.send(audioBuffer); },
    close() { try { state.ws?.close(); } catch (_) {} activeConnections.delete(callControlId); logger.info({ callControlId }, 'Deepgram connection closed'); },
  };
}

export function getDeepgramConnection(callControlId: string) {
  return activeConnections.get(callControlId);
}

export function getFinalTranscript(callControlId: string): string {
  return activeConnections.get(callControlId)?.finalTranscript ?? '';
}

export function closeAllConnections() {
  for (const [callId, state] of activeConnections) {
    try { state.ws?.close(); } catch (_) {}
    logger.info({ callControlId: callId }, 'Deepgram connection closed (cleanup)');
  }
  activeConnections.clear();
}
