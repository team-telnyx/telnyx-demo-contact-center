import Telnyx from 'telnyx';
import logger from '../middleware/errorHandler.js';

let telnyxClient: any;
let telnyxApiKey: string | undefined;

export function initTelnyx(apiKey: string) {
  telnyxClient = new Telnyx(apiKey);
  telnyxApiKey = apiKey;
  return telnyxClient;
}

export async function callControlAction(callControlId: string, action: string, body: Record<string, any> = {}) {
  if (!telnyxApiKey) throw new Error('Telnyx not initialized — call initTelnyx() first');
  const url = `https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/${action}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Telnyx ${action} failed: ${res.status} ${res.statusText}`);
    (err as any).status = res.status;
    (err as any).body = data;
    throw err;
  }
  return data;
}

export function getTelnyx() {
  if (!telnyxClient) throw new Error('Telnyx not initialized — call initTelnyx() first');
  return telnyxClient;
}

export async function answerCall(callControlId: string) {
  logger.info({ callControlId }, 'Answering call');
  return telnyxClient.calls.answer(callControlId);
}

export async function speakOnCall(callControlId: string, text: string, options: Record<string, any> = {}) {
  logger.info({ callControlId, text: text.substring(0, 50) }, 'Speaking on call');
  const cleanOptions = Object.fromEntries(
    Object.entries(options).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  return telnyxClient.calls.speak(callControlId, {
    payload: text,
    payload_type: 'text',
    voice: 'female',
    language: 'en-US',
    ...cleanOptions,
  });
}

export async function gatherDtmf(callControlId: string, options: Record<string, any> = {}) {
  logger.info({ callControlId }, 'Gathering DTMF');

  if (options.prompt) {
    return telnyxClient.calls.gather_using_speak(callControlId, {
      payload: options.prompt,
      voice: 'female',
      language: 'en-US',
      payload_type: 'text',
      valid_digits: options.validDigits,
      min_digits: options.minDigits || 1,
      max_digits: options.maxDigits || 1,
      timeout_millis: options.timeout || 10000,
    });
  }

  return telnyxClient.calls.gather(callControlId, {
    minimum_digits: options.minDigits || 1,
    maximum_digits: options.maxDigits || 1,
    timeout_millis: options.timeout || 10000,
    valid_digits: options.validDigits,
    terminating_digit: options.terminatingDigit,
  });
}

export async function playAudio(callControlId: string, audioUrl: string, options: Record<string, any> = {}) {
  logger.info({ callControlId, audioUrl }, 'Playing audio');
  const cleanOptions = Object.fromEntries(
    Object.entries(options).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  return telnyxClient.calls.playback_start(callControlId, { audio_url: audioUrl, ...cleanOptions });
}

export async function stopPlayback(callControlId: string, options: Record<string, any> = {}) {
  logger.info({ callControlId }, 'Stopping playback');
  return telnyxClient.calls.playback_stop(callControlId, options);
}

export async function hangupCall(callControlId: string) {
  logger.info({ callControlId }, 'Hanging up call');
  return telnyxClient.calls.hangup(callControlId);
}

export async function startStreaming(callControlId: string, streamUrl: string) {
  logger.info({ callControlId, streamUrl }, 'Starting media streaming');
  return telnyxClient.calls.streaming_start(callControlId, {
    stream_url: streamUrl,
    stream_track: 'inbound_track',
  });
}

export async function stopStreaming(callControlId: string) {
  logger.info({ callControlId }, 'Stopping media streaming');
  return telnyxClient.calls.streaming_stop(callControlId);
}

export async function transferCall(callControlId: string, toNumber: string, params: Record<string, any> = {}) {
  logger.info({ callControlId, toNumber }, 'Transferring call');
  return telnyxClient.calls.transfer(callControlId, {
    to: toNumber,
    ...params,
  });
}

export async function bridgeCall(callControlId: string, targetCallControlId: string) {
  logger.info({ callControlId, targetCallControlId }, 'Bridging calls');
  return telnyxClient.calls.bridge(callControlId, {
    call_control_id: targetCallControlId,
  });
}

const DEFAULT_HOLD_MUSIC_URL = 'https://cdn.telnyx.com/hold-music/jazz-1.mp3';

export async function startMusicOnHold(callControlId: string, musicUrl?: string) {
  logger.info({ callControlId, musicUrl }, 'Starting music on hold');
  return telnyxClient.calls.playback_start(callControlId, {
    audio_url: musicUrl || DEFAULT_HOLD_MUSIC_URL,
    loop: 'infinity',
  });
}

export async function stopMusicOnHold(callControlId: string) {
  logger.info({ callControlId }, 'Stopping music on hold');
  return telnyxClient.calls.playback_stop(callControlId);
}

export async function holdCall(callControlId: string, options: Record<string, any> = {}) {
  logger.info({ callControlId }, 'Holding call (start music-on-hold)');
  return startMusicOnHold(callControlId, options.musicUrl);
}

export async function unholdCall(callControlId: string) {
  logger.info({ callControlId }, 'Unholding call (stop music-on-hold)');
  return stopMusicOnHold(callControlId);
}

export async function muteCall(callControlId: string) {
  logger.warn({ callControlId }, 'muteCall called but mute is a WebRTC client-side action, not Call Control');
  throw new Error('muteCall is not implemented (use Telnyx WebRTC SDK call.mute() on the client)');
}

export async function unmuteCall(callControlId: string) {
  logger.warn({ callControlId }, 'unmuteCall called but unmute is a WebRTC client-side action, not Call Control');
  throw new Error('unmuteCall is not implemented (use Telnyx WebRTC SDK call.unmute() on the client)');
}

export async function startRecording(callControlId: string, params: Record<string, any> = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  logger.info({ callControlId, format: cleanParams.format, channels: cleanParams.channels }, 'Starting recording');
  return telnyxClient.calls.record_start(callControlId, {
    format: 'mp3',
    channels: 'single',
    ...cleanParams,
  });
}

export async function stopRecording(callControlId: string) {
  logger.info({ callControlId }, 'Stopping recording');
  return telnyxClient.calls.record_stop(callControlId);
}

export async function pauseRecording(callControlId: string) {
  logger.info({ callControlId }, 'Pausing recording');
  return telnyxClient.calls.record_pause(callControlId);
}

export async function resumeRecording(callControlId: string) {
  logger.info({ callControlId }, 'Resuming recording');
  return telnyxClient.calls.record_resume(callControlId);
}

export async function enableAmd(callControlId: string, options: Record<string, any> = {}) {
  logger.info({ callControlId, type: options.type || 'detect' }, 'Enabling AMD on call');

  const body: Record<string, any> = {
    detection_mode: options.detection_mode || options.type || 'detect',
  };
  const cfg: Record<string, any> = {
    after_greeting_silence_millis: options.afterGreetingSilence ?? 800,
    initial_silence_millis: options.initialSilence ?? 3500,
  };
  if (options.totalAnalysisTime != null) cfg.total_analysis_time_millis = options.totalAnalysisTime;
  if (options.betweenWordsSilence != null) cfg.between_words_silence_millis = options.betweenWordsSilence;
  body.answering_machine_detection_config = cfg;
  for (const [k, v] of Object.entries(options)) {
    if (['type', 'afterGreetingSilence', 'initialSilence', 'totalAnalysisTime',
         'betweenWordsSilence', 'detection_mode', 'answering_machine_detection_config'].includes(k)) continue;
    if (v !== undefined && v !== null && v !== '') body[k] = v;
  }

  return callControlAction(callControlId, 'answering_machine_detection_start', body);
}

export async function enableNoiseSuppression(callControlId: string, options: Record<string, any> = {}) {
  logger.info({ callControlId }, 'Enabling noise suppression');
  return telnyxClient.calls.suppression_start(callControlId, {
    direction: options.direction || 'both',
  });
}

export async function disableNoiseSuppression(callControlId: string) {
  logger.info({ callControlId }, 'Disabling noise suppression');
  return telnyxClient.calls.suppression_stop(callControlId);
}

export async function startTranscription(callControlId: string, options: Record<string, any> = {}) {
  const engineRaw   = options.engine || 'Deepgram';
  const engine      = engineRaw === 'B' ? 'Telnyx' : engineRaw;
  const isDeepgram  = engine === 'Deepgram';
  const isTelnyxWh  = engine === 'Telnyx';

  const model = options.model
    || (isDeepgram ? 'nova-3' : isTelnyxWh ? 'openai/whisper-large-v3-turbo' : undefined);

  // Build the engine config — do NOT nest transcription_engine/transcription_model
  // inside engine_config (causes 422 from Call Control API).
  const engineConfig: Record<string, any> = {};
  if (options.language && options.language !== 'auto') engineConfig.language = options.language;
  if (isDeepgram) {
    engineConfig.interim_results = true;
    engineConfig.smart_format    = true;
    engineConfig.diarize         = true;
  }

  logger.info({ callControlId, engine, model, tracks: options.tracks || 'both' }, 'Starting call transcription');

  const params: Record<string, any> = {
    transcription_engine: engine,
    transcription_engine_config: engineConfig,
    transcription_tracks: options.tracks || 'both',
  };
  // Model goes at the top level, not inside engine_config
  if (model) params.transcription_model = model;

  return telnyxClient.calls.transcriptionStart(callControlId, params);
}

export async function stopTranscription(callControlId: string) {
  logger.info({ callControlId }, 'Stopping call transcription');
  return telnyxClient.calls.transcriptionStop(callControlId);
}

export async function dialCall(params: Record<string, any>) {
  logger.info({ to: params.to, from: params.from }, 'Dialling outbound call');
  const response = await telnyxClient.calls.dial({
    connection_id: params.connectionId,
    to: params.to,
    from: params.from,
    ...params,
  });
  return response.data;
}

/**
 * Number Lookup — enriches a phone number with carrier, line type (mobile/landline/voip),
 * portability, and caller name (CNAM) via Telnyx Number Lookup API.
 * Docs: https://developers.telnyx.com/api/number-lookup/lookup-number
 */
export async function numberLookup(
  phoneNumber: string,
  opts: { type?: 'carrier' | 'caller-name'; includeCnam?: boolean } = {},
): Promise<any> {
  if (!telnyxApiKey) throw new Error('Telnyx not initialized');
  const types: string[] = [];
  if (opts.type === 'carrier' || !opts.type) types.push('carrier');
  if (opts.includeCnam || opts.type === 'caller-name') types.push('caller-name');
  const qs = types.length ? `?type=${types.join(',')}` : '';
  const url = `https://api.telnyx.com/v2/number_lookup/${encodeURIComponent(phoneNumber)}${qs}`;
  logger.info({ phoneNumber, types }, 'Telnyx number lookup');
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Accept': 'application/json',
    },
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Number lookup failed: ${res.status}`);
    (err as any).body = data;
    throw err;
  }
  return data?.data || data;
}

/**
 * Fetch Call Control Detail Records (CDRs) from Telnyx.
 * Docs: https://developers.telnyx.com/api/detail-records
 *
 * Returns the raw `data` array (array of detail-record objects) plus pagination meta.
 * Throws on non-2xx.
 */
export async function fetchCallDetailRecords(opts: {
  dateRange?: string;     // 'today' | 'yesterday' | 'last_week' | 'this_week' | 'last_month' | 'this_month' | 'last_N_days'
  createdAtGte?: string;  // ISO date (>=)
  createdAtLt?: string;   // ISO date (<)
  direction?: 'inbound' | 'outbound';
  pageNumber?: number;
  pageSize?: number;      // max 50 per Telnyx
  sort?: string;          // e.g. '-created_at'
} = {}): Promise<{ data: any[]; meta: any }> {
  if (!telnyxApiKey) throw new Error('Telnyx not initialized — call initTelnyx() first');

  const params = new URLSearchParams();
  params.set('filter[record_type]', 'call-control');
  if (opts.dateRange)    params.set('filter[date_range]', opts.dateRange);
  if (opts.createdAtGte) params.set('filter[created_at][gte]', opts.createdAtGte);
  if (opts.createdAtLt)  params.set('filter[created_at][lt]',  opts.createdAtLt);
  if (opts.direction)    params.set('filter[direction]', opts.direction);
  params.set('page[number]', String(opts.pageNumber ?? 1));
  params.set('page[size]',   String(Math.min(opts.pageSize ?? 50, 50)));
  params.set('sort', opts.sort ?? '-created_at');

  const url = `https://api.telnyx.com/v2/detail_records?${params.toString()}`;
  logger.info({ url }, 'Fetching Telnyx CDR detail records');

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Accept': 'application/json',
    },
  });
  const txt = await res.text();
  let body: any;
  try { body = txt ? JSON.parse(txt) : {}; } catch { body = { raw: txt }; }
  if (!res.ok) {
    const err = new Error(`Telnyx CDR fetch failed: ${res.status} ${res.statusText}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return { data: body?.data ?? [], meta: body?.meta ?? {} };
}

export async function sendSms(from: string, to: string, text: string, mediaUrls?: string[], messagingProfileId?: string) {
  if (!telnyxApiKey) throw new Error('Telnyx not initialized');
  logger.info({ from, to, textLen: text.length, hasMedia: !!(mediaUrls && mediaUrls.length), messagingProfileId: messagingProfileId || 'none' }, 'Sending SMS');
  const body: any = { from, to, text, type: 'SMS' };
  if (messagingProfileId) {
    body.messaging_profile_id = messagingProfileId;
  }
  if (mediaUrls && mediaUrls.length > 0) {
    body.type = 'MMS';
    body.media_urls = mediaUrls;
  }
  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`SMS send failed: ${res.status}`);
    (err as any).body = data;
    throw err;
  }
  return data;
}

/**
 * Get the Telnyx number to use for sending to a given recipient.
 *
 * Priority order:
 *  1. Sticky sender — reuse the same number if there's an open conversation with this visitor
 *  2. Profile-matched — if opts.messagingProfileId is given, prefer numbers in that profile
 *  3. Country-matched — prefer numbers whose countryCode matches the recipient's country prefix
 *  4. LRU fallback — least-recently-used SMS-enabled number
 */
export async function getStickySender(
  visitorPhone: string,
  models: any,
  opts: { messagingProfileId?: string; preferCountry?: string } = {},
): Promise<string> {
  const { Op } = await import('sequelize');

  // 1. Sticky: reuse existing open-conversation number
  const existing = await models.Conversation.findOne({
    where: { visitorPhone, channel: 'sms', status: { [Op.ne]: 'closed' } },
  });
  if (existing?.telnyxNumber) return existing.telnyxNumber;

  // Load all SMS-enabled numbers, LRU order
  const allNumbers = await models.NumberAssignment.findAll({
    where: { smsEnabled: true },
    order: [['lastUsedAt', 'ASC NULLS FIRST']],
  });
  if (allNumbers.length === 0) throw new Error('No SMS-enabled numbers configured');

  // 2. Messaging-profile match
  if (opts.messagingProfileId) {
    const profileMatch = allNumbers.find((n: any) => n.messagingProfileId === opts.messagingProfileId);
    if (profileMatch) {
      await profileMatch.update({ lastUsedAt: new Date() });
      return profileMatch.phoneNumber;
    }
  }

  // 3. Country match — infer from recipient's E.164 prefix
  const inferredCountry = opts.preferCountry || inferCountryFromE164(visitorPhone);
  if (inferredCountry) {
    const countryMatch = allNumbers.find((n: any) => n.countryCode === inferredCountry);
    if (countryMatch) {
      await countryMatch.update({ lastUsedAt: new Date() });
      return countryMatch.phoneNumber;
    }
  }

  // 4. LRU fallback
  await allNumbers[0].update({ lastUsedAt: new Date() });
  return allNumbers[0].phoneNumber;
}

/**
 * Very lightweight E.164 country inference.
 * Covers the most common CC prefixes — enough for demo routing.
 */
function inferCountryFromE164(e164: string): string | null {
  const n = e164.replace(/\D/g, '');
  if (n.startsWith('1'))  return 'US';   // +1 US/CA — prefer US; agents can override
  if (n.startsWith('44')) return 'GB';
  if (n.startsWith('61')) return 'AU';
  if (n.startsWith('64')) return 'NZ';
  if (n.startsWith('63')) return 'PH';
  if (n.startsWith('81')) return 'JP';
  if (n.startsWith('82')) return 'KR';
  if (n.startsWith('86')) return 'CN';
  if (n.startsWith('49')) return 'DE';
  if (n.startsWith('33')) return 'FR';
  if (n.startsWith('39')) return 'IT';
  if (n.startsWith('34')) return 'ES';
  if (n.startsWith('31')) return 'NL';
  if (n.startsWith('65')) return 'SG';
  if (n.startsWith('91')) return 'IN';
  if (n.startsWith('55')) return 'BR';
  if (n.startsWith('52')) return 'MX';
  return null;
}
