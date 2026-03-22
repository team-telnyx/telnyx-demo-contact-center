import { getOrgTelnyxClient } from './org-telnyx.js';

const TelnyxService = {
  async dial(to, from, connectionId, webhookUrl, clientState) {
    const telnyx = await getOrgTelnyxClient();
    const params = { connection_id: connectionId, to, from, webhook_url: webhookUrl };
    if (clientState) params.client_state = Buffer.from(clientState).toString('base64');
    return telnyx.calls.dial(params);
  },

  async bridge(callControlId, targetCallControlId, parkAfterUnbridge) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.post(`/v2/calls/${callControlId}/actions/bridge`, {
      body: { call_control_id: targetCallControlId, park_after_unbridge: parkAfterUnbridge || 'self' }
    });
  },

  async transfer(callControlId, to, from, webhookUrl, clientState) {
    const telnyx = await getOrgTelnyxClient();
    const body = { to, from, webhook_url: webhookUrl };
    if (clientState) body.client_state = Buffer.from(clientState).toString('base64');
    return telnyx.post(`/v2/calls/${callControlId}/actions/transfer`, { body });
  },

  async hangup(callControlId) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.post(`/v2/calls/${callControlId}/actions/hangup`, { body: {} });
  },

  async enqueue(callControlId, queueName) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.post(`/v2/calls/${callControlId}/actions/enqueue`, {
      body: { queue_name: queueName }
    });
  },

  async answer(callControlId, clientState) {
    const telnyx = await getOrgTelnyxClient();
    const body = {};
    if (clientState) body.client_state = Buffer.from(clientState).toString('base64');
    return telnyx.post(`/v2/calls/${callControlId}/actions/answer`, { body });
  },

  async speak(callControlId, text, voice, language) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.post(`/v2/calls/${callControlId}/actions/speak`, {
      body: { payload: text, voice: voice || 'female', language: language || 'en-US' }
    });
  },

  async playbackStart(callControlId, audioUrl) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.post(`/v2/calls/${callControlId}/actions/playback_start`, {
      body: { audio_url: audioUrl }
    });
  },

  async createConference(callControlId, name, clientState) {
    const telnyx = await getOrgTelnyxClient();
    const params = {
      call_control_id: callControlId,
      name: name || 'conf-' + Date.now(),
      beep_enabled: 'always',
      start_conference_on_create: true,
    };
    if (clientState) params.client_state = Buffer.from(clientState).toString('base64');
    return telnyx.conferences.create(params);
  },

  async joinConference(conferenceId, callControlId, hold) {
    const telnyx = await getOrgTelnyxClient();
    const body = { call_control_id: callControlId };
    if (hold) {
      body.hold = true;
      body.hold_audio_url = 'http://com.twilio.music.classical.s3.amazonaws.com/oldDog_-_endless_goodbye_%28instr.%29.mp3';
    }
    return telnyx.post(`/v2/conferences/${conferenceId}/actions/join`, { body });
  },

  async unholdConference(conferenceId, callControlIds) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.post(`/v2/conferences/${conferenceId}/actions/unhold`, {
      body: { call_control_ids: callControlIds }
    });
  },

  async getPhoneNumbersByTag(tag) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.get('/v2/phone_numbers', {
      query: { 'page[number]': 1, 'page[size]': 20, 'filter[tag]': tag }
    });
  },

  async getQueueCalls(queueName) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.get(`/v2/queues/${queueName || 'General_Queue'}/calls`);
  },

  async sendMessage(from, to, text) {
    const telnyx = await getOrgTelnyxClient();
    return telnyx.messages.send({ from, to, text });
  },
};

export default TelnyxService;
