import { Router, Request, Response, NextFunction } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import { getQueueSnapshot, getQueueStatus } from '../services/acd.js';
import { emitWallboardUpdate } from '../services/socket.js';
import { requireRole } from '../middleware/auth.js';

/**
 * SLA target (seconds) — must mirror webhooks.js. The wallboard reports
 * "% of answered calls where timeToAnswer <= SLA_TARGET_SECONDS" over today.
 */
const SLA_TARGET_SECONDS = Number(process.env.SLA_TARGET_SECONDS) || 20;

export function createWallboardRouter(models: any) {
  const router = Router();

  // Wallboard is visible to all authenticated users
  // (role info is still included so the UI can tailor the view)
  // router.use(requireRole('admin', 'supervisor'));

  // ── GET /api/wallboard/live ────────────────────────────────────────────
  // Single endpoint that returns everything the wallboard renders. Also
  // broadcasts the same payload over Socket.IO so other clients can keep
  // their UI fresh without polling.
  router.get('/live', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await computeWallboardSnapshot(models);
      // Push the same payload over the socket so any other connected
      // supervisor gets a free refresh.
      emitWallboardUpdate(data);
      res.json(data);
    } catch (err) {
      logger.error({ err }, 'Wallboard /live failed');
      next(err);
    }
  });

  return router;
}

/**
 * Compute a full wallboard snapshot.
 *
 * Pulls live ACD state + today's CallRecord aggregates + agent statuses
 * and returns the shape consumed by /client/app/(dashboard)/wallboard.
 */
export async function computeWallboardSnapshot(models: any) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const whereToday = { startedAt: { [Op.gte]: todayStart } };

  // ── Live queue snapshot (in-memory ACD state) ─────────────────────────
  const queueSnap = await getQueueSnapshot();
  const callsInQueue = queueSnap.reduce((sum, q) => sum + q.depth, 0);
  const longestWaitMs = queueSnap.reduce((max, q) => Math.max(max, q.oldestWaitMs), 0);

  // ── Active calls (in DB right now) ────────────────────────────────────
  // We only count "primary" or unmarked calls in 'active' state to avoid
  // double-counting agent-answer legs.
  const activeCallsCount = await models.Call.count({
    where: {
      status: 'active',
      [Op.or]: [{ callPurpose: 'primary' }, { callPurpose: null }],
    },
  });

  // ── Agents ────────────────────────────────────────────────────────────
  const agents = await models.Agent.findAll({
    include: [{ model: models.User, as: 'user', attributes: ['id', 'displayName', 'username'] }],
    order: [['priority', 'ASC']],
  });

  const agentsTotal = agents.length;
  const agentsAvailable = agents.filter((a) => a.status === 'online').length;
  const agentsBusy = agents.filter((a) => a.status === 'busy').length;

  // ── Agent → today's call count ────────────────────────────────────────
  const agentCallCounts = await models.CallRecord.findAll({
    attributes: ['agentId', [fn('COUNT', col('id')), 'count']],
    where: { ...whereToday, agentId: { [Op.ne]: null } },
    group: ['agentId'],
    raw: true,
  });
  const handledByAgent = new Map<string, number>(
    agentCallCounts.map((r) => [r.agentId, parseInt(r.count, 10)]),
  );

  // ── Per-agent active call (so we can show "on call with X for Ys") ────
  const activeAgentCalls = await models.Call.findAll({
    where: {
      status: 'active',
      agentId: { [Op.ne]: null },
      [Op.or]: [{ callPurpose: 'primary' }, { callPurpose: null }],
    },
    attributes: ['id', 'agentId', 'startedAt', 'from', 'to'],
    raw: true,
  });
  const activeByAgent = new Map<string, any>(activeAgentCalls.map((c) => [c.agentId, c]));

  const now = Date.now();
  const agentCards = agents.map((a) => {
    const active = activeByAgent.get(a.id);
    return {
      id: a.id,
      name: a.user?.displayName || a.user?.username || 'Agent',
      status: a.status,
      queues: a.queues || [],
      callsHandled: handledByAgent.get(a.id) || 0,
      currentCallId: active?.id || null,
      currentCallDuration: active?.startedAt
        ? Math.max(0, Math.round((now - new Date(active.startedAt).getTime()) / 1000))
        : null,
      currentCallFrom: active?.from || null,
    };
  });

  // ── Today's calls (inbound/outbound split, total) ─────────────────────
  const byDirection = await models.CallRecord.findAll({
    attributes: ['direction', [fn('COUNT', col('id')), 'count']],
    where: whereToday,
    group: ['direction'],
    raw: true,
  });
  const callsByDir = byDirection.reduce(
    (acc, r) => {
      acc[r.direction] = parseInt(r.count, 10);
      return acc;
    },
    { inbound: 0, outbound: 0 },
  );
  const callsToday = {
    total: (callsByDir.inbound || 0) + (callsByDir.outbound || 0),
    inbound: callsByDir.inbound || 0,
    outbound: callsByDir.outbound || 0,
  };

  // ── Avg handle time (today) ───────────────────────────────────────────
  const ahtRow = await models.CallRecord.findOne({
    attributes: [[fn('AVG', col('duration')), 'avg']],
    where: { ...whereToday, duration: { [Op.gt]: 0 } },
    raw: true,
  });
  const avgHandleTime = Math.round(parseFloat(ahtRow?.avg || 0));

  // ── Avg wait time (today) — only calls that had a queue entry ─────────
  const awtRow = await models.CallRecord.findOne({
    attributes: [[fn('AVG', col('timeToAnswer')), 'avg']],
    where: { ...whereToday, timeToAnswer: { [Op.ne]: null } },
    raw: true,
  });
  const avgWaitTime = Math.round(parseFloat(awtRow?.avg || 0));

  // ── SLA % (today) — of calls that were answered after queueing, the
  //    fraction that were answered within SLA_TARGET_SECONDS.
  const slaTotalRow = await models.CallRecord.count({
    where: { ...whereToday, answeredWithinSla: { [Op.ne]: null } },
  });
  const slaHitRow = await models.CallRecord.count({
    where: { ...whereToday, answeredWithinSla: true },
  });
  const slaPercentage = slaTotalRow > 0
    ? Math.round((slaHitRow / slaTotalRow) * 1000) / 10  // one decimal
    : null;

  // ── Per-queue stats ───────────────────────────────────────────────────
  // Combine live depth/wait from ACD with today's per-queue SLA and agent
  // assignment counts.
  const queueAgentCounts = new Map<string, number>();
  for (const a of agents) {
    for (const qn of (a.queues || [])) {
      queueAgentCounts.set(qn, (queueAgentCounts.get(qn) || 0) + (a.status === 'online' ? 1 : 0));
    }
  }

  const queueSlaRows = await models.CallRecord.findAll({
    attributes: [
      'queueName',
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal("CASE WHEN \"answeredWithinSla\" = true THEN 1 ELSE 0 END")), 'hit'],
      [fn('AVG', col('timeToAnswer')), 'avgWait'],
    ],
    where: { ...whereToday, queueName: { [Op.ne]: null }, answeredWithinSla: { [Op.ne]: null } },
    group: ['queueName'],
    raw: true,
  });
  const queueSlaByName = new Map<string, any>(
    queueSlaRows.map((r) => {
      const total = parseInt(r.total, 10);
      const hit = parseInt(r.hit, 10);
      return [
        r.queueName,
        {
          total,
          sla: total > 0 ? Math.round((hit / total) * 1000) / 10 : null,
          avgWait: Math.round(parseFloat(r.avgWait || 0)),
        },
      ];
    }),
  );

  // Build queue list from the union of (live queues) + (queues seen today)
  // + (queues any agent is assigned to). Missing fields default to 0/null.
  const queueNames = new Set<string>();
  for (const q of queueSnap) queueNames.add(q.name);
  for (const name of queueSlaByName.keys()) queueNames.add(name);
  for (const name of queueAgentCounts.keys()) queueNames.add(name);

  const liveDepthByName = new Map<string, any>(queueSnap.map((q) => [q.name, q]));
  const queues = [...queueNames].map((name) => {
    const live = liveDepthByName.get(name);
    const sla = queueSlaByName.get(name);
    return {
      name,
      depth: live?.depth || 0,
      oldestWaitMs: live?.oldestWaitMs || 0,
      sla: sla?.sla ?? null,
      avgWait: sla?.avgWait ?? 0,
      agentsOnline: queueAgentCounts.get(name) || 0,
    };
  }).sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name));

  return {
    timestamp: new Date().toISOString(),
    slaTargetSeconds: SLA_TARGET_SECONDS,
    callsInQueue,
    longestWaitMs,
    activeCalls: activeCallsCount,
    agentsAvailable,
    agentsTotal,
    agentsBusy,
    slaPercentage,
    callsToday,
    avgHandleTime,
    avgWaitTime,
    agents: agentCards,
    queues,
  };
}
