import { Op } from 'sequelize';
import { getOrgTelnyxClient, getWebhookBaseUrl } from './org-telnyx.js';
import sequelize from '../../config/database.js';
import User from '../../models/User.js';
import Voice from '../../models/Voice.js';
import Conversations from '../../models/Conversations.js';
import { broadcast } from '../../routes/websocket.js';
import { holdMusicCache } from './ivr-engine.js';

/**
 * Try to route a queued call to an available agent.
 * @param {string} callControlId - The queued call's call_control_id
 * @param {string[]} excludeAgents - SIP usernames to skip (already tried/declined)
 * Returns true if an agent was dialed, false otherwise.
 */
export async function routeCallToAgent(callControlId, excludeAgents = []) {
  const voiceRecord = await Voice.findOne({ where: { queue_uuid: callControlId } });
  if (!voiceRecord) {
    console.log('[Auto-route] No voice record found for', callControlId);
    return false;
  }

  const queueName = voiceRecord.queue_name || 'General_Queue';
  console.log(`[Auto-route] Looking for agents in queue: ${queueName}`);
  const where = {
    status: 'online',
    assignedQueue: queueName,
  };
  if (excludeAgents.length > 0) {
    where.sipUsername = { [Op.notIn]: excludeAgents };
  }

  // Find agents and their active call counts in two queries (no N+1)
  const candidates = await User.findAll({
    where,
    order: [['routingPriority', 'ASC']],
  });

  if (candidates.length === 0) {
    console.log(`[Auto-route] No available agents for queue ${queueName}`);
    return false;
  }

  // Single query: count active calls per agent (by sipUsername or username)
  const allIdentifiers = candidates.flatMap(a => [a.sipUsername, a.username]);
  const activeCalls = await Voice.findAll({
    attributes: ['accept_agent', [sequelize.fn('COUNT', sequelize.col('uuid')), 'callCount']],
    where: {
      accept_agent: { [Op.in]: allIdentifiers },
      queue_name: { [Op.ne]: null },
    },
    group: ['accept_agent'],
    raw: true,
  });

  const callCountMap = {};
  for (const row of activeCalls) {
    callCountMap[row.accept_agent] = parseInt(row.callCount) || 0;
  }

  let availableAgent = null;
  for (const agent of candidates) {
    const count = (callCountMap[agent.sipUsername] || 0) + (callCountMap[agent.username] || 0);
    if (count < (agent.maxCalls || 1)) {
      availableAgent = agent;
      break;
    }
  }

  if (!availableAgent) {
    console.log(`[Auto-route] No available agents for queue ${queueName}`);
    return false;
  }

  const fromNumber = voiceRecord.telnyx_number;
  const webhookBase = await getWebhookBaseUrl();
  const webhookUrl = `${webhookBase}/api/voice/outbound?callControlId_Bridge=${encodeURIComponent(callControlId)}`;

  console.log(`[Auto-route] Dialing agent ${availableAgent.sipUsername} for call ${callControlId} (from: ${fromNumber})`);

  try {
    const telnyx = await getOrgTelnyxClient();
    const dialResponse = await telnyx.calls.dial({
      connection_id: availableAgent.appConnectionId,
      to: `sip:${availableAgent.sipUsername}@sip.telnyx.com`,
      from: fromNumber,
      link_to: callControlId,
      webhook_url: webhookUrl,
      timeout_secs: 30,
    });
    // Store the agent's call_control_id as bridge_uuid immediately when dialing
    const agentCallControlId = dialResponse?.data?.call_control_id;
    // Track this agent as tried
    const triedSoFar = voiceRecord.tried_agents || [];
    triedSoFar.push(availableAgent.sipUsername);
    const updateFields = { accept_agent: availableAgent.sipUsername, tried_agents: triedSoFar };
    if (agentCallControlId) {
      updateFields.bridge_uuid = agentCallControlId;
    }
    await Voice.update(
      updateFields,
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

  // Use the full persisted list of tried agents
  const triedAgents = voiceRecord.tried_agents || [];
  if (declinedAgent && !triedAgents.includes(declinedAgent)) {
    triedAgents.push(declinedAgent);
  }

  // Reset accept_agent so the call is back in queue, persist tried list
  await Voice.update(
    { accept_agent: null, tried_agents: triedAgents },
    { where: { queue_uuid: callControlId } }
  );

  console.log(`[Auto-route] Agent ${declinedAgent} declined/busy, trying next agent (excluding: ${triedAgents.join(', ')})`);
  const routed = await routeCallToAgent(callControlId, triedAgents);

  if (!routed) {
    console.log('[Auto-route] No more agents available, caller stays in queue');
    const cached = holdMusicCache.get(callControlId);
    if (cached && cached.expires > Date.now()) {
      try {
        const telnyx = await getOrgTelnyxClient();
        await telnyx.calls.actions.startPlayback(callControlId, {
          audio_url: cached.url,
        });
      } catch (err) {
        console.error('[Auto-route] Failed to play hold music:', err.message);
      }
    }
  }
}

/**
 * Remove a specific agent from the tried_agents list for all queued calls in a given queue.
 * Called when an agent comes back online so they become eligible for pending calls again.
 * @param {string} queueName - Queue name to filter calls (null = all queues)
 * @param {string} agentId - The SIP username to remove from tried_agents lists
 */
export async function clearTriedAgentFromQueue(queueName, agentId) {
  const where = { accept_agent: null, queue_name: { [Op.ne]: null } };
  if (queueName) {
    where.queue_name = queueName;
  }

  const queuedCalls = await Voice.findAll({ where });
  let cleared = 0;

  for (const call of queuedCalls) {
    const triedAgents = call.tried_agents || [];
    if (triedAgents.includes(agentId)) {
      const updated = triedAgents.filter(a => a !== agentId);
      await Voice.update(
        { tried_agents: updated },
        { where: { queue_uuid: call.queue_uuid } }
      );
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`[Auto-route] Cleared agent ${agentId} from tried_agents in ${cleared} queued call(s)`);
  }
}

/**
 * Check all queued calls and try to route them to available agents.
 * Called when an agent comes online.
 * @param {string} [agentId] - Optional SIP username of the agent that just came online;
 *   if provided, that agent is removed from tried_agents for all pending calls first.
 */
export async function routeQueuedCallsToAgent(agentId) {
  // If a specific agent came online, clear them from tried_agents so they can be retried
  if (agentId) {
    await clearTriedAgentFromQueue(null, agentId);
  }

  const queuedCalls = await Voice.findAll({
    where: { accept_agent: null, queue_name: { [Op.ne]: null } },
    order: [['createdAt', 'ASC']],
  });

  if (queuedCalls.length === 0) {
    console.log('[Auto-route] No queued calls waiting');
    return;
  }

  // If no specific agent provided, clear tried_agents for all queued calls
  // (legacy behavior for generic "check for queued calls" scenarios)
  if (!agentId) {
    for (const call of queuedCalls) {
      await Voice.update(
        { tried_agents: [] },
        { where: { queue_uuid: call.queue_uuid } }
      );
    }
  }

  console.log(`[Auto-route] Found ${queuedCalls.length} queued call(s), attempting to route...`);

  for (const call of queuedCalls) {
    const routed = await routeCallToAgent(call.queue_uuid);
    if (routed) {
      console.log(`[Auto-route] Routed queued call ${call.queue_uuid}`);
    } else {
      console.log(`[Auto-route] Could not route queued call ${call.queue_uuid}`);
    }
  }
}

/**
 * Auto-route an SMS conversation to an available agent.
 * Uses the same priority-based routing as voice, with maxConversations capacity check.
 * @param {string} conversationId - The conversation's conversation_id hash
 * @param {string} queueName - Queue name to match agents (default: General_Queue)
 */
export async function routeSmsToAgent(conversationId, queueName = 'General_Queue') {
  try {
    const agents = await User.findAll({
      where: { status: 'online', assignedQueue: queueName, role: 'agent' },
      order: [['routingPriority', 'ASC']],
    });

    if (agents.length === 0) {
      console.log(`[SMS-route] No available agents for conversation ${conversationId}`);
      return false;
    }

    // Single query: count active conversations per agent (only recent — last 24h activity)
    const usernames = agents.map(a => a.username);
    const activeConvos = await Conversations.findAll({
      attributes: ['agent_assigned', [sequelize.fn('COUNT', sequelize.col('id')), 'convoCount']],
      where: {
        agent_assigned: { [Op.in]: usernames },
        assigned: true,
        updatedAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      group: ['agent_assigned'],
      raw: true,
    });

    const convoCountMap = {};
    for (const row of activeConvos) {
      convoCountMap[row.agent_assigned] = parseInt(row.convoCount) || 0;
    }

    for (const agent of agents) {
      const assignedCount = convoCountMap[agent.username] || 0;

      if (assignedCount < (agent.maxConversations || 5)) {
        await Conversations.update(
          { agent_assigned: agent.username, assigned: true },
          { where: { conversation_id: conversationId } }
        );

        const conversation = await Conversations.findOne({ where: { conversation_id: conversationId } });
        broadcast('CONVERSATION_ASSIGNED', conversation);

        console.log(`[SMS-route] Assigned conversation ${conversationId} to ${agent.username} (${assignedCount + 1}/${agent.maxConversations || 5})`);
        return true;
      }
    }

    console.log(`[SMS-route] No available agents for conversation ${conversationId}`);
    return false;
  } catch (err) {
    console.error('[SMS-route] Error routing conversation:', err.message);
    return false;
  }
}
