import { Router, Request, Response, NextFunction } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/auth.js';

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

// Contact-center-relevant products for the Usage Reports API
const CC_PRODUCTS = [
  'call-control',
  'sip-trunking',
  'messaging',
  'recording',
  'speech-to-text',
  'amd',
  'media-streaming',
  'text-to-speech',
];

export function createAnalyticsRouter(models: any) {
  const router = Router();

  // Analytics is admin/supervisor only
  router.use(requireRole('admin', 'supervisor'));

  // ── Helper: proxy a request to the Telnyx Usage Reports API ────────────
  async function telnyxUsageFetch(path, query, apiKey) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        // Support bracket-style keys like filter[direction]=outbound
        params.append(k, String(v));
      }
    }
    const url = `${TELNYX_API_BASE}${path}${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error({ status: res.status, body }, 'Telnyx Usage Reports API error');
      throw new Error(`Telnyx API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  function getApiKey(req) {
    // Try env first, then fall back to whatever was configured
    return process.env.TELNYX_API_KEY;
  }

  // ── GET /api/analytics/usage ───────────────────────────────────────────
  // Proxies directly to GET /v2/usage_reports with all query params passed through
  router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = getApiKey(req) as string;
      if (!apiKey) return res.status(500).json({ error: 'TELNYX_API_KEY not configured' });

      const data = await telnyxUsageFetch('/usage_reports', req.query as Record<string, string>, apiKey);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/analytics/options ─────────────────────────────────────────
  // Proxies to GET /v2/usage_reports/options with optional product filter
  router.get('/options', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = getApiKey(req);
      if (!apiKey) return res.status(500).json({ error: 'TELNYX_API_KEY not configured' });

      const query = {} as Record<string, string>;
      if ((req.query as any).product) query.product = (req.query as any).product;

      const data = await telnyxUsageFetch('/usage_reports/options', query, apiKey);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/analytics/multi-product ───────────────────────────────────
  // Fetches usage data for multiple products in parallel and combines results
  router.get('/multi-product', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = getApiKey(req);
      if (!apiKey) return res.status(500).json({ error: 'TELNYX_API_KEY not configured' });

      const { products, date_range, start_date, end_date, metrics, dimensions } = (req.query as any) as Record<string, string>;
      const productList = products
        ? products.split(',').map(p => p.trim())
        : CC_PRODUCTS;

      const baseQuery: Record<string, string> = {};
      if (date_range) baseQuery.date_range = date_range;
      if (start_date) baseQuery.start_date = start_date;
      if (end_date)   baseQuery.end_date = end_date;
      if (metrics)    baseQuery.metrics = metrics;
      if (dimensions) baseQuery.dimensions = dimensions;

      const results = await Promise.allSettled(
        productList.map(async (product) => {
          const data = await telnyxUsageFetch('/usage_reports', { ...baseQuery, product }, apiKey);
          return { product, data };
        })
      );

      const combined = results.map((r, i) => ({
        product: productList[i],
        status: r.status,
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason?.message : null,
      }));

      res.json({ results: combined });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/analytics/summary ─────────────────────────────────────────
  // Aggregates local DB data (CallRecord) for contact-center KPIs
  router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { period = 'today' } = (req.query as any);

      // Normalise period values sent by the analytics client
      const periodAliases: Record<string, string> = {
        last_1_weeks: 'week',
        last_30_days: 'last_30',
        last_1_months: 'month',
      };
      if (periodAliases[period]) period = periodAliases[period];

      // Compute date boundaries
      const now = new Date();
      let startDate;

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last_30':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      const where = { startedAt: { [Op.gte]: startDate } };

      // ── Previous period for trend calculation ──────────────────────────
      const prevDuration = Number(now) - Number(startDate);
      const prevStartDate = new Date(startDate.getTime() - prevDuration);
      const prevWhere = {
        startedAt: { [Op.gte]: prevStartDate, [Op.lt]: startDate },
      };

      // ── Total calls ────────────────────────────────────────────────────
      const totalCalls = await models.CallRecord.count({ where });
      const prevTotalCalls = await models.CallRecord.count({ where: prevWhere });

      // ── Average handle time ────────────────────────────────────────────
      const avgResult = await models.CallRecord.findOne({
        attributes: [[fn('AVG', col('duration')), 'avgDuration']],
        where: { ...where, duration: { [Op.gt]: 0 } },
        raw: true,
      });
      const avgHandleTime = Math.round(parseFloat((avgResult as any)?.avgDuration || 0));

      // ── Calls by direction ─────────────────────────────────────────────
      const byDirection = await models.CallRecord.findAll({
        attributes: ['direction', [fn('COUNT', col('id')), 'count']],
        where,
        group: ['direction'],
        raw: true,
      });

      // ── Calls by status ───────────────────────────────────────────────
      const byStatus = await models.CallRecord.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        where,
        group: ['status'],
        raw: true,
      });

      // ── Agent performance ─────────────────────────────────────────────
      const agentPerf = await models.CallRecord.findAll({
        attributes: [
          'agentId',
          [fn('COUNT', col('CallRecord.id')), 'totalCalls'],
          [fn('AVG', col('duration')), 'avgDuration'],
        ],
        where: { ...where, agentId: { [Op.ne]: null } },
        group: ['agentId'],
        raw: true,
      });

      // Enrich agent data with names
      const agentIds = agentPerf.map(a => a.agentId).filter(Boolean);
      const agents = agentIds.length
        ? await models.Agent.findAll({
            where: { id: { [Op.in]: agentIds } },
            include: [{ model: models.User, as: 'user', attributes: ['id', 'displayName', 'username'] }],
          })
        : [];

      const agentMap = new Map<string, any>(agents.map(a => [a.id, a]));

      const agentPerformance = agentPerf.map(ap => {
        const agent = agentMap.get(ap.agentId);
        return {
          agentId: ap.agentId,
          agentName: agent?.user?.displayName || agent?.user?.username || ap.agentId,
          totalCalls: parseInt(ap.totalCalls, 10),
          avgDuration: Math.round(parseFloat(ap.avgDuration || 0)),
        };
      });

      // ── Daily call volume (for chart) ─────────────────────────────────
      const dailyVolume = await models.CallRecord.findAll({
        attributes: [
          [fn('DATE', col('startedAt')), 'date'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where,
        group: [fn('DATE', col('startedAt'))],
        order: [[fn('DATE', col('startedAt')), 'ASC']],
        raw: true,
      });

      res.json({
        period,
        startDate: startDate.toISOString(),
        totalCalls,
        prevTotalCalls,
        trend: prevTotalCalls > 0
          ? Math.round(((totalCalls - prevTotalCalls) / prevTotalCalls) * 100)
          : (totalCalls > 0 ? 100 : 0),
        avgHandleTime,
        byDirection: byDirection.reduce((acc, r) => {
          acc[r.direction] = parseInt(r.count, 10);
          return acc;
        }, {}),
        byStatus: byStatus.reduce((acc, r) => {
          acc[r.status] = parseInt(r.count, 10);
          return acc;
        }, {}),
        agentPerformance,
        dailyVolume: dailyVolume.map(d => ({
          date: d.date,
          count: parseInt(d.count, 10),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
