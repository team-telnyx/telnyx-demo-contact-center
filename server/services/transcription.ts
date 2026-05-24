import logger from '../middleware/errorHandler.js';

const activeTranscriptions = new Map<string, { segments: any[]; finalTranscript: string }>();

export function isTranscriptionEnabled(): boolean {
  return process.env.TELNYX_STT_ENABLED !== 'false';
}

export function getTranscriptionTracks(): string {
  return process.env.TELNYX_STT_TRACKS || 'both';
}

export function getTranscriptionModel(): string {
  return process.env.TELNYX_STT_MODEL || 'openai/whisper-large-v3-turbo';
}

export function getTranscriptionLanguage(): string {
  return process.env.TELNYX_STT_LANGUAGE || 'auto';
}

export function handleTranscriptionEvent(
  event: any,
  emitPartial: (callControlId: string, data: any) => void,
  emitFinal: (callControlId: string, data: any) => void,
) {
  const callControlId = event.call_control_id;
  const data = event.transcription_data;

  if (!data || !callControlId) return;

  const text = data.transcript || '';
  const isFinal = data.is_final === true;
  const confidence = data.confidence ?? 0;

  let state = activeTranscriptions.get(callControlId);
  if (!state) {
    state = { segments: [], finalTranscript: '' };
    activeTranscriptions.set(callControlId, state);
  }

  if (isFinal) {
    state.finalTranscript += (state.finalTranscript ? ' ' : '') + text;
    state.segments.push({ text, confidence, is_final: true });
    emitFinal(callControlId, { text, confidence });
    logger.info({ callControlId, text: text.substring(0, 80), confidence }, 'Transcription final');
  } else {
    emitPartial(callControlId, { text, confidence });
    logger.debug({ callControlId, text: text.substring(0, 80) }, 'Transcription partial');
  }
}

export function getFinalTranscript(callControlId: string): string {
  return activeTranscriptions.get(callControlId)?.finalTranscript ?? '';
}

export function getTranscriptSegments(callControlId: string): any[] {
  return activeTranscriptions.get(callControlId)?.segments ?? [];
}

export function cleanupTranscription(callControlId: string) {
  activeTranscriptions.delete(callControlId);
  logger.info({ callControlId }, 'Transcription state cleaned up');
}

export function closeAllTranscriptions() {
  activeTranscriptions.clear();
  logger.info('All transcription state cleared');
}
