import { Op } from 'sequelize';
import Telnyx from 'telnyx';
import { env } from '../config/env.js';
import User from '../../models/User.js';
import Voice from '../../models/Voice.js';

const telnyx = new Telnyx({ apiKey: env.TELNYX_API });

/**
 * Try to route a queued call to an available agent.
 * @param {string} callControlId - The queued call's call_control_id
 * @param {string[]} excludeAgents - SIP usernames to skip (already tried/declined)
 * Returns true if an agent was dialed, false otherwise.
 */
export async function routeCallToAgent(callControlId, excludeAgents = []) {
  const where = { status: 'online' };
  if (excludeAgents.length > 0) {
    where.sipUsername = { [Op.notIn]: excludeAgents };
  }

  const availableAgent = await User.findOne({
    where,
    order: [['routingPriority', 'ASC']],
  });
  if (!availableAgent) {
    console.log('[Auto-route] No available agents');
    return false;
  }

  const voiceRecord = await Voice.findOne({ where: { queue_uuid: callControlId } });
  if (!voiceRecord) {
    console.log('[Auto-route] No voice record found for', callControlId);
    return false;
  }

  const fromNumber = voiceRecord.telnyx_number;
  const webhookUrl = `https://${env.APP_HOST}:${env.APP_PORT}/api/voice/outbound?callControlId_Bridge=${encodeURIComponent(callControlId)}`;

  console.log(`[Auto-route] Dialing agent ${availableAgent.sipUsername} for call ${callControlId} (from: ${fromNumber})`);

  try {
    await telnyx.calls.dial({
      connection_id: env.TELNYX_CONNECTION_ID,
      to: `sip:${availableAgent.sipUsername}@sip.telnyx.com`,
      from: fromNumber,
      webhook_url: webhookUrl,
    });
    await Voice.update(
      { accept_agent: availableAgent.sipUsername },
      { where: { queue_uuid: callControlId } }
    );
    console.log(`[Auto-route] Dialed agent ${availableAgent.sipUsername}`);
    return true;
  } catch (err) {
    console.error('[Auto-route] Failed to dial agent:', err.message);
    return false;
  }
}

/**
 * Agent declined or was busy — route to the next available agent.
 * @param {string} callControlId - The queued call's call_control_id
 * @param {string} declinedAgent - The SIP username that declined
 */
export async function routeToNextAgent(callControlId, declinedAgent) {
  const voiceRecord = await Voice.findOne({ where: { queue_uuid: callControlId } });
  if (!voiceRecord) {
    console.log('[Auto-route] No voice record for declined call', callControlId);
    return;
  }

  // Collect all agents that have already been tried for this call
  const triedAgents = [declinedAgent];

  // Reset accept_agent so the call is back in queue
  await Voice.update(
    { accept_agent: null },
    { where: { queue_uuid: callControlId } }
  );

  console.log(`[Auto-route] Agent ${declinedAgent} declined/busy, trying next agent (excluding: ${triedAgents.join(', ')})`);
  const routed = await routeCallToAgent(callControlId, triedAgents);

  if (!routed) {
    console.log('[Auto-route] No more agents available, caller stays in queue with hold music');
    try {
      await telnyx.calls.actions.startPlayback(callControlId, {
        audio_url: 'http://com.twilio.music.classical.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3',
      });
    } catch (err) {
      console.error('[Auto-route] Failed to play hold music:', err.message);
    }
  }
}

/**
 * Check all queued calls and try to route the oldest one to an available agent.
 * Called when an agent comes online.
 */
export async function routeQueuedCallsToAgent() {
  const queuedCall = await Voice.findOne({
    where: { accept_agent: null, queue_name: { [Op.ne]: null } },
    order: [['createdAt', 'ASC']],
  });

  if (!queuedCall) {
    console.log('[Auto-route] No queued calls waiting');
    return;
  }

  console.log(`[Auto-route] Found queued call ${queuedCall.queue_uuid}, attempting to route...`);
  const routed = await routeCallToAgent(queuedCall.queue_uuid);

  if (!routed) {
    console.log('[Auto-route] Could not route queued call');
  }
}
