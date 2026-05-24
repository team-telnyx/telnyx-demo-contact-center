import { Op } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import {
  emitCallRoutedToAgent,
  emitQueueUpdate,
  emitAgentWrapUpStart,
  emitAgentWrapUpEnd,
  emitAgentStatusUpdate,
  emitQueueCallEnqueued,
  emitQueueCallRouted,
  emitQueueCallAbandoned,
} from './socket.js';
import * as telnyxService from './telnyx.js';
import { loadEnv } from '../config/env.js';
import bus from './event-bus.js';

const enqueuedAtByCallId = new Map<string, number>();

let _models: any = null;

const QUEUE_CACHE_TTL_MS = 30 * 1000;
const _queueCache = new Map<string, { queue: any; expiresAt: number }>();
const _roundRobinIndex = new Map<string, number>();
const _wrapUpTimers = new Map<string, NodeJS.Timeout>();

async function getQueueConfig(queueName: string, models: any) {
  const now = Date.now();
  const cached = _queueCache.get(queueName);
  if (cached && cached.expiresAt > now) return cached.queue;

  try {
    const queue = await models.Queue.findOne({ where: { name: queueName } });
    _queueCache.set(queueName, { queue, expiresAt: now + QUEUE_CACHE_TTL_MS });
    return queue;
  } catch (err) {
    logger.error({ err, queueName }, 'Failed to load queue config — falling back to defaults');
    return null;
  }
}

export function invalidateQueueCache(queueName?: string) {
  if (queueName) _queueCache.delete(queueName);
  else _queueCache.clear();
}

function resetRoundRobin(queueName?: string) {
  if (queueName) _roundRobinIndex.delete(queueName);
  else _roundRobinIndex.clear();
}

function agentMeetsSkills(agent: any, requiredSkills: any[]): boolean {
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) return true;
  const agentSkills: any[] = Array.isArray(agent.skills) ? agent.skills : [];
  for (const req of requiredSkills) {
    if (!req || !req.name) continue;
    const reqLevel = Number(req.level ?? 1);
    const match = agentSkills.find((s) => s && s.name === req.name);
    if (!match) return false;
    if (Number(match.level ?? 0) < reqLevel) return false;
  }
  return true;
}

function skillsMatchScore(agent: any, requiredSkills: any[]): number {
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
    return (Array.isArray(agent.skills) ? agent.skills : []).reduce(
      (sum: number, s: any) => sum + Number(s?.level ?? 0), 0,
    );
  }
  const agentSkills: any[] = Array.isArray(agent.skills) ? agent.skills : [];
  let score = 0;
  for (const req of requiredSkills) {
    const match = agentSkills.find((s: any) => s && s.name === req.name);
    if (!match) continue;
    score += Number(match.level ?? 0) - Number(req.level ?? 1) + 1;
  }
  return score;
}

export function initAcd(models: any) {
  _models = models;
  _queueCache.clear();
  _roundRobinIndex.clear();
}

export async function recoverState(models: any) {
  if (!models) return;
  logger.info('Recovering ACD state from database...');

  const agents = await models.Agent.findAll();
  const statusMap: Record<string, string> = {
    online: 'available', busy: 'busy', wrap_up: 'wrap_up',
    away: 'offline', break: 'break', dnd: 'offline', offline: 'offline',
  };

  for (const agent of agents) {
    const sessionStatus = statusMap[agent.status] || 'offline';
    await models.AgentSession.upsert({
      agentId: agent.id,
      status: sessionStatus,
      currentCallId: agent.activeCallId || null,
      statusChangedAt: new Date(),
      lastHeartbeat: new Date(),
    });
  }

  const [updated] = await models.QueueEntry.update(
    { status: 'timed_out' },
    { where: { status: { [Op.in]: ['waiting', 'routing'] } } },
  );
  if (updated > 0) {
    logger.warn({ count: updated }, 'Marked orphaned queue entries as timed_out on restart');
  }

  const waitingEntries = await models.QueueEntry.findAll({
    where: { status: { [Op.in]: ['waiting', 'routing'] } },
  });
  for (const entry of waitingEntries) {
    enqueuedAtByCallId.set(entry.callId, new Date(entry.enqueuedAt).getTime());
  }

  logger.info({
    agentsSynced: agents.length, orphanedEntries: updated, slaTracked: waitingEntries.length,
  }, 'ACD state recovery complete');
}

export async function enqueueCall(
  callId: string,
  queueName: string,
  { callerNumber, callerName, callSessionId }: { callerNumber?: string; callerName?: string; callSessionId?: string } = {},
) {
  const models = _models;
  if (!models) {
    logger.error({ callId, queueName }, 'enqueueCall called before initAcd — dropping');
    return;
  }

  let callerNum = callerNumber || null;
  let callerNm = callerName || null;
  let callSessId = callSessionId || null;
  if (!callerNum || !callSessId) {
    try {
      const call = await models.Call.findByPk(callId);
      if (call) {
        callerNum = callerNum || call.from || null;
        callerNm = callerNm || call.callerName || null;
        callSessId = callSessId || call.callSessionId || null;
      }
    } catch (_) { /* best-effort */ }
  }

  const enqueuedAt = Date.now();
  await models.QueueEntry.create({
    queueName, callId, callSessionId: callSessId,
    callerNumber: callerNum, callerName: callerNm,
    enqueuedAt: new Date(enqueuedAt), priority: 0, status: 'waiting',
  });

  enqueuedAtByCallId.set(callId, enqueuedAt);

  const depth = await models.QueueEntry.count({ where: { queueName, status: 'waiting' } });
  logger.info({ callId, queueName, depth }, 'Call enqueued (DB)');

  emitQueueCallEnqueued(queueName, { callId, depth });
  emitQueueUpdate(await getQueueStatus());
  bus.emit('call:queued', { callId, queueName, depth });
  _checkQueueDepthExceeded(queueName, depth);

  attemptRoute(queueName, models).catch((err: any) =>
    logger.error({ err, queueName }, 'Error during immediate route attempt'),
  );
}

function _checkQueueDepthExceeded(queueName: string, depth: number) {
  if (!depth || depth === 0) return;
  const maxDepth = 50;
  if (depth > maxDepth) {
    bus.emit('queue:depth_exceeded', { queueName, depth, maxDepth });
  }
}

export async function dequeueCall(callId: string, { status = 'abandoned' }: { status?: string } = {}) {
  const models = _models;
  if (!models) return;

  const entry = await models.QueueEntry.findOne({
    where: { callId, status: { [Op.in]: ['waiting', 'routing'] } },
  });
  if (!entry) return;

  await entry.update({ status });
  enqueuedAtByCallId.delete(callId);

  logger.info({ callId, queueName: entry.queueName, newStatus: status }, 'Call dequeued (DB)');

  if (status === 'abandoned') {
    emitQueueCallAbandoned(entry.queueName, { callId });
  }

  emitQueueUpdate(await getQueueStatus());
}

export function getEnqueuedAt(callId: string): number | undefined {
  return enqueuedAtByCallId.get(callId);
}

export function clearEnqueuedAt(callId: string) {
  enqueuedAtByCallId.delete(callId);
}

export async function findAvailableAgent(models: any, queueName: string): Promise<any> {
  const now = new Date();
  const queueCfg = await getQueueConfig(queueName, models);
  const strategy = queueCfg?.strategy || 'priority';
  const requiredSkills = queueCfg?.requiredSkills || [];

  const availableSessions = await models.AgentSession.findAll({
    where: { status: 'available' },
    include: [{
      model: models.Agent, as: 'agent',
      where: {
        queues: { [Op.overlap]: [queueName] },
        activeCallId: null,
        [Op.or]: [{ wrapUpUntil: null }, { wrapUpUntil: { [Op.lt]: now } }],
      },
    }],
  });

  if (availableSessions.length === 0) {
    const candidates = await models.Agent.findAll({
      where: {
        status: 'online', queues: { [Op.overlap]: [queueName] }, activeCallId: null,
        [Op.or]: [{ wrapUpUntil: null }, { wrapUpUntil: { [Op.lt]: now } }],
      },
    });
    if (candidates.length === 0) return null;
    const eligible = candidates.filter((a: any) => agentMeetsSkills(a, requiredSkills));
    if (eligible.length === 0) {
      logger.debug({ queueName, candidates: candidates.length, requiredSkills }, 'No agents satisfy requiredSkills');
      return null;
    }
    return applyRoutingStrategy(eligible, strategy, queueName, requiredSkills);
  }

  const candidates = availableSessions.map((s: any) => s.agent).filter(Boolean);
  if (candidates.length === 0) return null;

  const eligible = candidates.filter((a: any) => agentMeetsSkills(a, requiredSkills));
  if (eligible.length === 0) {
    logger.debug({ queueName, candidates: candidates.length, requiredSkills }, 'No agents satisfy requiredSkills');
    return null;
  }

  return applyRoutingStrategy(eligible, strategy, queueName, requiredSkills);
}

function applyRoutingStrategy(eligible: any[], strategy: string, queueName: string, requiredSkills: any[]): any {
  switch (strategy) {
    case 'round-robin': {
      const sorted = eligible.slice().sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
      const idx = (_roundRobinIndex.get(queueName) ?? 0) % sorted.length;
      const pick = sorted[idx];
      _roundRobinIndex.set(queueName, (idx + 1) % sorted.length);
      return pick;
    }
    case 'least-recent':
    case 'most-idle': {
      const sorted = eligible.slice().sort((a: any, b: any) => {
        const ta = a.lastCallEndedAt ? new Date(a.lastCallEndedAt).getTime() : 0;
        const tb = b.lastCallEndedAt ? new Date(b.lastCallEndedAt).getTime() : 0;
        return ta - tb;
      });
      return sorted[0];
    }
    case 'skills-weighted': {
      let best = eligible[0];
      let bestScore = skillsMatchScore(best, requiredSkills);
      for (let i = 1; i < eligible.length; i += 1) {
        const s = skillsMatchScore(eligible[i], requiredSkills);
        if (s > bestScore) { best = eligible[i]; bestScore = s; }
      }
      return best;
    }
    case 'priority':
    default: {
      const sorted = eligible.slice().sort((a: any, b: any) => (a.priority ?? 99) - (b.priority ?? 99));
      return sorted[0];
    }
  }
}

export async function assignAgent(agentId: string, callId: string, models: any) {
  const now = new Date();
  await models.Agent.update({ status: 'busy', activeCallId: callId }, { where: { id: agentId } });
  await models.AgentSession.update({ status: 'busy', currentCallId: callId, statusChangedAt: now }, { where: { agentId } });
  await models.QueueEntry.update({ status: 'routing', assignedAgentId: agentId }, { where: { callId, status: 'waiting' } });
  logger.info({ agentId, callId }, 'Agent assigned to call');
}

export async function releaseAgent(agentId: string, models: any) {
  await startWrapUp(agentId, models);
}

export async function startWrapUp(agentId: string, models: any, queueName?: string) {
  const agent = await models.Agent.findByPk(agentId);
  if (!agent) return;

  let wrapUpSeconds = 30;
  const candidateQueue = queueName || (agent.queues && agent.queues[0]);
  if (candidateQueue) {
    const cfg = await getQueueConfig(candidateQueue, models);
    if (cfg?.wrapUpSeconds != null) wrapUpSeconds = cfg.wrapUpSeconds;
  }

  const wrapUpUntil = new Date(Date.now() + wrapUpSeconds * 1000);
  const now = new Date();

  await agent.update({ status: 'wrap_up', activeCallId: null, wrapUpUntil });
  await models.AgentSession.update({ status: 'wrap_up', currentCallId: null, statusChangedAt: now }, { where: { agentId } });

  logger.info({ agentId, wrapUpUntil, wrapUpSeconds }, 'Agent entering wrap-up');
  emitAgentWrapUpStart(agentId, wrapUpUntil);
  emitAgentStatusUpdate(agentId, 'wrap_up', agent.userId);

  for (const qn of (agent.queues ?? [])) resetRoundRobin(qn);

  const existing = _wrapUpTimers.get(agentId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    _wrapUpTimers.delete(agentId);
    completeWrapUp(agentId, models).catch((err: any) =>
      logger.error({ err, agentId }, 'Auto-complete wrap-up failed'),
    );
  }, wrapUpSeconds * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  _wrapUpTimers.set(agentId, timer);
}

export async function completeWrapUp(agentId: string, models: any) {
  const agent = await models.Agent.findByPk(agentId);
  if (!agent) return;

  const timer = _wrapUpTimers.get(agentId);
  if (timer) { clearTimeout(timer); _wrapUpTimers.delete(agentId); }

  const wasWrapping = agent.status === 'wrap_up' || agent.wrapUpUntil != null;
  if (!wasWrapping) return;

  const nextStatus = ['offline', 'away', 'break', 'dnd'].includes(agent.status) ? agent.status : 'online';
  const now = new Date();

  await agent.update({
    status: nextStatus, wrapUpUntil: null, activeCallId: null,
    lastCallEndedAt: now, totalCallsHandled: (agent.totalCallsHandled || 0) + 1,
  });

  const sessionStatusMap: Record<string, string> = {
    online: 'available', away: 'offline', offline: 'offline', break: 'break', dnd: 'offline',
  };
  const sessionStatus = sessionStatusMap[nextStatus] || 'offline';

  await models.AgentSession.update({ status: sessionStatus, currentCallId: null, statusChangedAt: now }, { where: { agentId } });

  logger.info({ agentId, nextStatus, sessionStatus }, 'Agent wrap-up complete');
  emitAgentWrapUpEnd(agentId);
  emitAgentStatusUpdate(agentId, nextStatus, agent.userId);

  for (const qn of (agent.queues ?? [])) resetRoundRobin(qn);

  if (nextStatus === 'online') {
    for (const queueName of (agent.queues ?? [])) {
      await attemptRoute(queueName, models).catch((err: any) =>
        logger.error({ err, queueName }, 'Error routing after wrap-up complete'),
      );
    }
  }
}

export async function checkQueueOverflow(queueName: string, models: any): Promise<{ action: string; callId: string } | null> {
  const waitingEntries = await models.QueueEntry.findAll({
    where: { queueName, status: 'waiting' }, order: [['enqueuedAt', 'ASC']],
  });
  if (waitingEntries.length === 0) return null;

  const cfg = await getQueueConfig(queueName, models);
  if (!cfg) return null;

  const now = Date.now();
  const oldestEntry = waitingEntries[0];
  const oldestWaitMs = now - new Date(oldestEntry.enqueuedAt).getTime();
  const depth = waitingEntries.length;
  const overSize = cfg.maxQueueSize != null && depth > cfg.maxQueueSize;
  const overWait = cfg.maxWaitSeconds != null && oldestWaitMs > cfg.maxWaitSeconds * 1000;
  if (!overSize && !overWait) return null;

  const entry = oldestEntry;
  const action = cfg.overflowAction || 'hangup';
  logger.warn({ queueName, depth, oldestWaitMs, action, reason: overSize ? 'size' : 'wait' }, 'Queue overflow — applying overflow action');

  let call: any = null;
  try { call = await models.Call.findByPk(entry.callId); } catch (_) { /* noop */ }
  const callControlId = call?.callControlId;

  try {
    switch (action) {
      case 'voicemail': {
        if (callControlId) {
          await telnyxService.speakOnCall(callControlId, 'We are sorry, all agents are busy. Please leave a message after the tone and we will call you back.').catch(() => {});
          await telnyxService.startRecording(callControlId, { format: 'mp3' }).catch(() => {});
        }
        await dequeueCall(entry.callId, { status: 'abandoned' });
        break;
      }
      case 'callback': {
        await dequeueCall(entry.callId, { status: 'abandoned' });
        if (models.Callback?.create) {
          await models.Callback.create({
            callId: entry.callId, queueName,
            phoneNumber: call?.from || entry.callerNumber || null,
            requestedAt: new Date(), status: 'pending',
          }).catch((err: any) => logger.error({ err, callId: entry.callId }, 'Failed to persist Callback'));
        }
        if (callControlId) {
          await telnyxService.speakOnCall(callControlId, 'Thanks for waiting. We have queued a callback and will return your call shortly.').catch(() => {});
          await telnyxService.hangupCall(callControlId).catch(() => {});
        }
        break;
      }
      case 'transfer': {
        if (callControlId && cfg.overflowTarget) {
          await telnyxService.transferCall(callControlId, cfg.overflowTarget).catch((err: any) =>
            logger.error({ err, callControlId, target: cfg.overflowTarget }, 'Overflow transfer failed'));
        }
        await dequeueCall(entry.callId, { status: 'abandoned' });
        break;
      }
      case 'hangup':
      default: {
        if (callControlId) {
          await telnyxService.speakOnCall(callControlId, 'We are sorry, all agents are busy. Please try again later.').catch(() => {});
          await telnyxService.hangupCall(callControlId).catch(() => {});
        }
        await dequeueCall(entry.callId, { status: 'abandoned' });
        break;
      }
    }
  } catch (err) {
    logger.error({ err, queueName, action }, 'Overflow action failed');
  }

  if (['voicemail', 'callback', 'hangup'].includes(action)) {
    bus.emit('call:missed', {
      callId: entry.callId, queueName, overflowAction: action,
      phoneNumber: call?.from || entry.callerNumber || null,
    });
  }

  return { action, callId: entry.callId };
}

export async function attemptRoute(queueName: string, models: any): Promise<{ callId: string; agentId: string } | undefined> {
  const waitingCount = await models.QueueEntry.count({ where: { queueName, status: 'waiting' } });
  if (waitingCount === 0) return;

  try { await checkQueueOverflow(queueName, models); } catch (err: any) { logger.error({ err, queueName }, 'checkQueueOverflow threw'); }

  const remainingWaiting = await models.QueueEntry.count({ where: { queueName, status: 'waiting' } });
  if (remainingWaiting === 0) return;

  const agent = await findAvailableAgent(models, queueName);
  if (!agent) {
    logger.debug({ queueName, depth: remainingWaiting }, 'No available agents — call remains queued');
    return;
  }

  const entry = await models.QueueEntry.findOne({
    where: { queueName, status: 'waiting' },
    order: [['enqueuedAt', 'ASC'], ['priority', 'DESC']],
  });
  if (!entry) return;

  const { callId } = entry;
  await assignAgent(agent.id, callId, models);

  const inboundCall = await models.Call.findByPk(callId);
  if (!inboundCall) {
    logger.error({ callId }, 'Inbound call missing from DB — cannot route');
    await releaseAgent(agent.id, models);
    return;
  }

  await inboundCall.update({ agentId: agent.id, status: 'active', queueName });
  await entry.update({ status: 'routing', assignedAgentId: agent.id });

  logger.info({ callId, agentId: agent.id, queueName }, 'Call routed to agent — originating agent leg');

  emitCallRoutedToAgent(agent.id, { callId, queueName, agentId: agent.id });
  emitQueueCallRouted(queueName, { callId, agentId: agent.id });
  emitQueueUpdate(await getQueueStatus());

  try {
    const env = loadEnv();
    const sipUri = `sip:${env.TELNYX_SIP_USERNAME}@sip.telnyx.com`;
    const fromNumber = inboundCall.to || env.TELNYX_FROM_NUMBER || '+10000000000';

    const clientState = Buffer.from(JSON.stringify({
      kind: 'agent_answer', parentCallControlId: inboundCall.callControlId, agentId: agent.id,
    })).toString('base64');

    const dialResp = await telnyxService.dialCall({
      connectionId: env.TELNYX_APP_CONNECTION_ID, to: sipUri, from: fromNumber,
      client_state: clientState, timeout_secs: 30,
    });

    const agentLegCallControlId = dialResp.call_control_id;
    const agentLegCallSessionId = dialResp.call_session_id;

    await models.Call.create({
      callControlId: agentLegCallControlId, callSessionId: agentLegCallSessionId,
      direction: 'outbound', from: fromNumber, to: sipUri, status: 'ringing',
      callPurpose: 'agent_answer', parentCallId: inboundCall.id, agentId: agent.id, startedAt: new Date(),
    });

    logger.info({ inboundCallControlId: inboundCall.callControlId, agentLegCallControlId, agentId: agent.id }, 'Agent leg originated — waiting for answer');
  } catch (err) {
    logger.error({ err, callId, agentId: agent.id }, 'Failed to originate agent leg — releasing agent');
    await releaseAgent(agent.id, models).catch(() => {});
  }

  return { callId, agentId: agent.id };
}

export async function onAgentOnline(agentId: string, models: any) {
  const agent = await models.Agent.findByPk(agentId);
  if (!agent) return;
  const now = new Date();

  await models.AgentSession.upsert({
    agentId, status: 'available', currentCallId: null, statusChangedAt: now, lastHeartbeat: now,
  });

  for (const queueName of (agent.queues ?? [])) resetRoundRobin(queueName);
  for (const queueName of (agent.queues ?? [])) {
    await attemptRoute(queueName, models).catch((err: any) =>
      logger.error({ err, queueName }, 'Error routing on agent online'),
    );
  }
}

export async function onAgentOffline(agentId: string, models: any) {
  const agent = await models.Agent.findByPk(agentId);
  if (!agent) return;
  const now = new Date();

  await models.AgentSession.update({ status: 'offline', currentCallId: null, statusChangedAt: now }, { where: { agentId } });
  for (const queueName of (agent.queues ?? [])) resetRoundRobin(queueName);
}

export async function handleAgentStatusChange(agentId: string, newStatus: string, models: any) {
  const now = new Date();
  const statusMap: Record<string, string> = {
    online: 'available', busy: 'busy', wrap_up: 'wrap_up',
    away: 'offline', break: 'break', dnd: 'offline', offline: 'offline',
  };
  const sessionStatus = statusMap[newStatus] || 'offline';

  await models.AgentSession.upsert({
    agentId, status: sessionStatus, statusChangedAt: now, lastHeartbeat: now,
  });

  const agent = await models.Agent.findByPk(agentId);
  if (agent) { for (const queueName of (agent.queues ?? [])) resetRoundRobin(queueName); }
  if (newStatus === 'online') { await onAgentOnline(agentId, models); }
}

export async function handleCallEnded(callId: string, agentId: string | null, models: any) {
  if (!models) return;
  const entry = await models.QueueEntry.findOne({ where: { callId, status: { [Op.in]: ['waiting', 'routing'] } } });
  if (entry) {
    const newStatus = entry.status === 'waiting' ? 'abandoned' : 'answered';
    await entry.update({ status: newStatus, answeredAt: newStatus === 'answered' ? new Date() : null });
  } else {
    const routingEntry = await models.QueueEntry.findOne({ where: { callId, status: 'routing' } });
    if (routingEntry) { await routingEntry.update({ status: 'answered', answeredAt: new Date() }); }
  }
  if (agentId) {
    await models.AgentSession.update({ currentCallId: null }, { where: { agentId, currentCallId: callId } });
  }
  enqueuedAtByCallId.delete(callId);
}

export async function getQueueStatus(): Promise<Record<string, { depth: number; oldestWaitMs: number }>> {
  const models = _models;
  if (!models) return {};

  const status: Record<string, any> = {};
  const entries = await models.QueueEntry.findAll({ where: { status: 'waiting' }, attributes: ['queueName', 'enqueuedAt'], order: [['enqueuedAt', 'ASC']] });

  const byQueue: Record<string, any[]> = {};
  for (const e of entries) {
    if (!byQueue[e.queueName]) byQueue[e.queueName] = [];
    byQueue[e.queueName].push(e);
  }

  const now = Date.now();
  for (const [name, q] of Object.entries(byQueue)) {
    const oldestWaitMs = q.length > 0 ? now - new Date(q[0].enqueuedAt).getTime() : 0;
    status[name] = { depth: q.length, oldestWaitMs };
  }

  const allQueueNames = await models.QueueEntry.findAll({ attributes: ['queueName'], group: ['queueName'] });
  for (const qn of allQueueNames) {
    if (!status[qn.queueName]) status[qn.queueName] = { depth: 0, oldestWaitMs: 0 };
  }

  return status;
}

export async function getQueueSnapshot(): Promise<{ name: string; depth: number; oldestWaitMs: number; avgWaitMs: number }[]> {
  const models = _models;
  if (!models) return [];

  const now = Date.now();
  const entries = await models.QueueEntry.findAll({ where: { status: 'waiting' }, attributes: ['queueName', 'enqueuedAt'], order: [['enqueuedAt', 'ASC']] });

  const byQueue: Record<string, any[]> = {};
  for (const e of entries) {
    if (!byQueue[e.queueName]) byQueue[e.queueName] = [];
    byQueue[e.queueName].push(e);
  }

  return Object.entries(byQueue).map(([name, q]) => {
    const waits = q.map((e: any) => now - new Date(e.enqueuedAt).getTime());
    const oldestWaitMs = waits.length ? Math.max(...waits) : 0;
    const avgWaitMs = waits.length ? Math.round(waits.reduce((a: number, b: number) => a + b, 0) / waits.length) : 0;
    return { name, depth: q.length, oldestWaitMs, avgWaitMs };
  });
}

export async function getQueueLiveStats(models: any, queueName: string, { windowMinutes = 60 }: { windowMinutes?: number } = {}) {
  const now = Date.now();

  const waitingEntries = await models.QueueEntry.findAll({ where: { queueName, status: 'waiting' }, attributes: ['enqueuedAt'], order: [['enqueuedAt', 'ASC']] });
  const depth = waitingEntries.length;
  const waits = waitingEntries.map((e: any) => now - new Date(e.enqueuedAt).getTime());
  const oldestWaitMs = waits.length ? Math.max(...waits) : 0;
  const avgWaitMs = waits.length ? Math.round(waits.reduce((a: number, b: number) => a + b, 0) / waits.length) : 0;

  const allAgents = await models.Agent.findAll({ where: { queues: { [Op.overlap]: [queueName] } }, attributes: ['id', 'status'] });
  const agentsTotal = allAgents.length;
  const agentsOnline = allAgents.filter((a: any) => a.status === 'online').length;

  const since = new Date(now - windowMinutes * 60 * 1000);
  const records = await models.CallRecord.findAll({ where: { queueName, startedAt: { [Op.gte]: since } }, attributes: ['status', 'answeredWithinSla'] });
  const callsAnswered = records.filter((r: any) => r.status === 'completed' || r.status === 'ended').length;
  const callsAbandoned = records.filter((r: any) => r.status === 'abandoned' || r.status === 'missed').length;
  const withinSla = records.filter((r: any) => r.answeredWithinSla === true).length;
  const slaPercent = callsAnswered > 0 ? Math.round((withinSla / callsAnswered) * 100) : 100;

  return { depth, oldestWaitMs, avgWaitMs, agentsOnline, agentsTotal, slaPercent, callsAnswered, callsAbandoned };
}

export async function reapStaleQueueEntries(maxAgeMs = 10 * 60 * 1000): Promise<number> {
  const models = _models;
  if (!models) return 0;

  const cutoff = new Date(Date.now() - maxAgeMs);
  const [reaped] = await models.QueueEntry.update(
    { status: 'timed_out' },
    { where: { status: 'waiting', enqueuedAt: { [Op.lt]: cutoff } } },
  );

  if (reaped > 0) {
    logger.warn({ reaped }, 'Reaped stale queue entries');
    const reapedEntries = await models.QueueEntry.findAll({ where: { status: 'timed_out', enqueuedAt: { [Op.lt]: cutoff } }, attributes: ['callId'] });
    for (const e of reapedEntries) { enqueuedAtByCallId.delete(e.callId); }
    emitQueueUpdate(await getQueueStatus());
  }

  return reaped;
}

let _reaperTimer: NodeJS.Timeout | null = null;

export function startQueueReaper({ intervalMs = 60 * 1000, maxAgeMs = 10 * 60 * 1000 }: { intervalMs?: number; maxAgeMs?: number } = {}) {
  if (_reaperTimer) return;
  _reaperTimer = setInterval(() => {
    reapStaleQueueEntries(maxAgeMs).catch((err: any) => { logger.error({ err }, 'Queue reaper error'); });
  }, intervalMs);
  if (typeof _reaperTimer.unref === 'function') _reaperTimer.unref();
  logger.info({ intervalMs, maxAgeMs }, 'ACD queue reaper started');
}

export function stopQueueReaper() {
  if (_reaperTimer) { clearInterval(_reaperTimer); _reaperTimer = null; }
}
