import axios from 'axios';
import { env } from '../config/env.js';
import Voice from '../../models/Voice.js';
import TelnyxService from './telnyx.service.js';

const VoiceService = {
  async getQueueCalls() {
    try {
      const data = await TelnyxService.getQueueCalls('General_Queue');
      return data;
    } catch (error) {
      console.error('VoiceService.getQueueCalls error:', error.message);
      throw new Error(`Failed to retrieve queue calls: ${error.message}`);
    }
  },

  async acceptCall(sipUsername, callControlId, callerId) {
    try {
      const webhookUrlWithParam = `https://${env.APP_HOST}:${env.APP_PORT}/api/voice/outbound?callControlId_Bridge=${encodeURIComponent(callControlId)}`;

      await TelnyxService.dial(
        `sip:${sipUsername}@sip.telnyx.com`,
        callerId,
        env.TELNYX_CONNECTION_ID,
        webhookUrlWithParam
      );

      console.log('Call Dialed');

      await Voice.update(
        { accept_agent: sipUsername },
        { where: { queue_uuid: callControlId } }
      );

      console.log('Database record updated with agent who accepted the call');
    } catch (error) {
      console.error('VoiceService.acceptCall error:', error.message);
      throw new Error(`Failed to accept call: ${error.message}`);
    }
  },

  async transferCall(data) {
    const { sipUsername, callerId, callControlId, outboundCCID } = data;

    let transferId;
    let isCallControlIdUsed = false;

    if (outboundCCID && outboundCCID.length > 0) {
      transferId = outboundCCID;
    } else if (callControlId) {
      isCallControlIdUsed = true;
      const callData = await Voice.findOne({
        where: { bridge_uuid: callControlId },
      });
      if (callData) {
        transferId = callData.queue_uuid;
      } else {
        throw Object.assign(new Error('Call data not found'), { status: 404 });
      }
    } else {
      throw Object.assign(new Error('No valid ID provided for transfer'), { status: 400 });
    }

    const callControlFlag = isCallControlIdUsed ? '&isCallControlIdUsed=true' : '';
    const webhookUrl = `https://${env.APP_HOST}:${env.APP_PORT}/api/voice/transfer-call?callControlId_Bridge=${transferId}${callControlFlag}`;

    try {
      const response = await TelnyxService.transfer(
        transferId,
        `sip:${sipUsername}@sip.telnyx.com`,
        callerId.number,
        webhookUrl,
        'Transfer'
      );
      return response;
    } catch (error) {
      console.error('VoiceService.transferCall error:', error.message);
      throw new Error(`Failed to transfer call: ${error.message}`);
    }
  },

  async warmTransfer(data) {
    const { callControlId, sipUsername, callerId, outboundCCID, webrtcOutboundCCID } = data;

    try {
      let queueUuid;
      if (callControlId) {
        const callData = await Voice.findOne({
          where: { bridge_uuid: callControlId },
        });
        if (callData) {
          queueUuid = callData.queue_uuid;
        }
      } else {
        const callData = await Voice.findOne({
          where: { bridge_uuid: outboundCCID },
        });
        if (callData) {
          queueUuid = callData.queue_uuid;
        }
      }

      await axios.post(
        `https://api.telnyx.com/v2/calls/${webrtcOutboundCCID}/actions/dial`,
        {
          to: `sip:${sipUsername}@sip.telnyx.com`,
          from: callerId.number,
          supervisor_role: callControlId,
          client_state: Buffer.from('Warm Transfer').toString('base64'),
        },
        {
          headers: {
            'Authorization': `Bearer ${env.TELNYX_API}`,
          },
        }
      );

      console.log('Warm Transfer Agent Dialed');
      return { queueUuid };
    } catch (error) {
      console.error('VoiceService.warmTransfer error:', error.message);
      throw new Error(`Failed to initiate warm transfer: ${error.message}`);
    }
  },

  async completeWarmTransfer(data) {
    const { callControlId } = data;

    try {
      const callData = await Voice.findOne({
        where: { bridge_uuid: callControlId },
      });

      if (!callData || !callData.conference_id) {
        throw new Error('Conference data not found for the given call');
      }

      const conferenceId = callData.conference_id;
      const queueId = callData.queue_uuid;

      const result = await TelnyxService.unholdConference(conferenceId, [queueId]);
      console.log('Call unheld');
      return result;
    } catch (error) {
      console.error('VoiceService.completeWarmTransfer error:', error.message);
      throw new Error(`Failed to complete warm transfer: ${error.message}`);
    }
  },
};

export default VoiceService;
