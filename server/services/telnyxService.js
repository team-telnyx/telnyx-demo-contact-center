import axios from 'axios';

class TelnyxService {
  constructor() {
    this.apiKey = process.env.TELNYX_API;
    this.baseURL = 'https://api.telnyx.com/v2';
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    // Telnyx client will be handled via direct API calls using axios
  }

  async getPhoneNumbers(tag, page = 1, size = 20) {
    try {
      const response = await axios.get(`${this.baseURL}/phone_numbers`, {
        params: {
          'page[number]': page,
          'page[size]': size,
          'filter[tag]': tag,
        },
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      throw error;
    }
  }

  async dialCall(connectionId, to, from, webhookUrl, clientState = null) {
    try {
      const callData = {
        connection_id: connectionId,
        to,
        from,
        webhook_url: webhookUrl,
        ...(clientState && { client_state: clientState })
      };

      const response = await axios.post(`${this.baseURL}/calls`, callData, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error('Error dialing call:', error);
      throw error;
    }
  }

  // dialCallWithSupervisor removed - was only used for warm transfers

  async answerCall(callControlId, clientState = null) {
    try {
      const data = {
        ...(clientState && { client_state: clientState })
      };

      const response = await axios.post(
        `${this.baseURL}/calls/${callControlId}/actions/answer`,
        data,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error answering call:', error);
      throw error;
    }
  }

  async hangupCall(callControlId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/calls/${callControlId}/actions/hangup`,
        {},
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error hanging up call:', error);
      throw error;
    }
  }

  async bridgeCalls(callControlId, bridgeToCallControlId, parkAfterUnbridge = false) {
    try {
      const response = await axios.post(
        `${this.baseURL}/calls/${callControlId}/actions/bridge`,
        {
          call_control_id: bridgeToCallControlId,
          park_after_unbridge: parkAfterUnbridge
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error bridging calls:', error);
      throw error;
    }
  }

  async transferCall(callControlId, to, from, webhookUrl, clientState = null) {
    try {
      const data = {
        to,
        from,
        webhook_url: webhookUrl,
        ...(clientState && { client_state: clientState })
      };

      const response = await axios.post(
        `${this.baseURL}/calls/${callControlId}/actions/transfer`,
        data,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error transferring call:', error);
      throw error;
    }
  }

  async speakText(callControlId, text, voice = 'female', language = 'en-US') {
    try {
      const response = await axios.post(
        `${this.baseURL}/calls/${callControlId}/actions/speak`,
        {
          payload: text,
          voice,
          language
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error speaking text:', error);
      throw error;
    }
  }

  async enqueueCall(callControlId, queueName) {
    try {
      const response = await axios.post(
        `${this.baseURL}/calls/${callControlId}/actions/enqueue`,
        { queue_name: queueName },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error enqueuing call:', error);
      throw error;
    }
  }

  async playbackStart(callControlId, audioUrl) {
    try {
      const response = await axios.post(
        `${this.baseURL}/calls/${callControlId}/actions/playback_start`,
        { audio_url: audioUrl },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error starting playback:', error);
      throw error;
    }
  }

  async getQueueCalls(queueName) {
    try {
      const response = await axios.get(
        `${this.baseURL}/queues/${queueName}/calls`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting queue calls:', error);
      throw error;
    }
  }

  async updateClientState(callControlId, clientState) {
    try {
      const response = await axios.put(
        `${this.baseURL}/calls/${callControlId}/actions/client_state_update`,
        { client_state: clientState },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating client state:', error);
      throw error;
    }
  }
}

export default new TelnyxService();