import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/auth.js';
import { emitScorecardCreated, emitScorecardUpdated, getIO } from '../services/socket.js';

const CATEGORIES = ['greeting', 'productKnowledge', 'resolution', 'communication', 'compliance'];

const scorecardCreateSchema = z.object({
  agentId: z.string().uuid(),
  reviewerId: z.string().uuid().optional(), // defaults to logged-in user
  callId: z.string().uuid().optional(),
  categoryScores: z.object({
    greeting: z.number().int().min(1).max(5).optional(),
    productKnowledge: z.number().int().min(1).max(5).optional(),
    resolution: z.number().int().min(1).max(5).optional(),
    communication: z.number().int().min(1).max(5).optional(),
    compliance: z.number().int().min(1).max(5).optional(),
  }),
  categoryNotes: z.object({
    greeting: z.string().optional(),
    productKnowledge: z.string().optional(),
    resolution: z.string().optional(),
    communication: z.string().optional(),
    compliance: z.string().optional(),
  }).optional(),
  overallScore: z.number().min(0).max(100).optional(), // auto-calculated if omitted
  notes: z.string().optional(),
});

const scorecardUpdateSchema = z.object({
  categoryScores: z.object({
    greeting: z.number().int().min(1).max(5).optional(),
    productKnowledge: z.number().int().min(1).max(5).optional(),
    resolution: z.number().int().min(1).max(5).optional(),
    communication: z.number().int().min(1).max(5).optional(),
    compliance: z.number().int().min(1).max(5).optional(),
  }).optional(),
  categoryNotes: z.object({
    greeting: z.string().optional(),
    productKnowledge: z.string().optional(),
    resolution: z.string().optional(),
    communication: z.string().optional(),
    compliance: z.string().optional(),
  }).optional(),
  overallScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const talkTrackCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(['Opening', 'Objection Handling', 'Closing', 'Compliance', 'Escalation']).optional(),
  script: z.string().optional(),
  tips: z.string().optional(),
  steps: z.array(z.any()).optional(),
  isActive: z.boolean().optional(),
});

const talkTrackUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.enum(['Opening', 'Objection Handling', 'Closing', 'Compliance', 'Escalation']).optional(),
  script: z.string().optional(),
  tips: z.string().optional(),
  steps: z.array(z.any()).optional(),
  isActive: z.boolean().optional(),
});

function calcOverallScore(categoryScores) {
  const vals = CATEGORIES.map(c => categoryScores[c]).filter(v => v != null);
  if (vals.length === 0) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round((avg / 5) * 100); // 1-5 → 0-100
}

export function createCoachingRouter(models: any) {
  const router = Router();

  // ── Scorecards ────────────────────────────────────────────────────────

  // GET /api/coaching/scorecards — list with filters & pagination
  router.get('/scorecards', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, reviewerId, fromDate, toDate, page = 1, limit = 20 } = (req.query as any);
      const where: any = {};
      if (agentId) where.agentId = agentId;
      if (reviewerId) where.reviewerId = reviewerId;
      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt[Op.gte] = new Date(fromDate);
        if (toDate) where.createdAt[Op.lte] = new Date(toDate);
      }

      const offset = (Math.max(1, +page) - 1) * Math.min(100, +limit);
      const { rows, count } = await models.CoachingScorecard.findAndCountAll({
        where,
        include: [
          { model: models.Agent, as: 'agent', include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName'] }] },
          { model: models.User, as: 'reviewer', attributes: ['id', 'username', 'displayName'] },
        ],
        order: [['createdAt', 'DESC']],
        limit: Math.min(100, +limit),
        offset,
      });

      res.json({ rows, total: count, page: +page, totalPages: Math.ceil(count / Math.min(100, +limit)) });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/coaching/scorecards — create scorecard
  router.post('/scorecards', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = scorecardCreateSchema.parse(req.body);
      // Default reviewer to logged-in user
      if (!data.reviewerId) data.reviewerId = req.user.id;
      // Auto-calculate overallScore if not provided
      if (data.overallScore == null) {
        data.overallScore = calcOverallScore(data.categoryScores);
      }
      const scorecard = await models.CoachingScorecard.create(data);
      const fresh = await models.CoachingScorecard.findByPk(scorecard.id, {
        include: [
          { model: models.Agent, as: 'agent', include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName'] }] },
          { model: models.User, as: 'reviewer', attributes: ['id', 'username', 'displayName'] },
        ],
      });
      logger.info({ scorecardId: scorecard.id, agentId: data.agentId }, 'Coaching scorecard created');
      try { emitScorecardCreated(getIO(), fresh.toJSON()); } catch { /* Socket not initialized */ }
      res.status(201).json(fresh);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // GET /api/coaching/scorecards/:id — get full scorecard
  router.get('/scorecards/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scorecard = await models.CoachingScorecard.findByPk((req.params as any).id, {
        include: [
          { model: models.Agent, as: 'agent', include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName'] }] },
          { model: models.User, as: 'reviewer', attributes: ['id', 'username', 'displayName'] },
          { model: models.Call, as: 'call' },
        ],
      });
      if (!scorecard) return res.status(404).json({ error: 'Scorecard not found' });
      res.json(scorecard);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/coaching/scorecards/:id — update scorecard
  router.patch('/scorecards/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = scorecardUpdateSchema.parse(req.body);
      const scorecard = await models.CoachingScorecard.findByPk((req.params as any).id);
      if (!scorecard) return res.status(404).json({ error: 'Scorecard not found' });

      // Recalculate overall if category scores changed
      if (data.categoryScores) {
        const merged = { ...scorecard.categoryScores, ...data.categoryScores };
        if (data.overallScore == null) data.overallScore = calcOverallScore(merged);
      }

      await scorecard.update(data);
      const fresh = await models.CoachingScorecard.findByPk(scorecard.id, {
        include: [
          { model: models.Agent, as: 'agent', include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName'] }] },
          { model: models.User, as: 'reviewer', attributes: ['id', 'username', 'displayName'] },
        ],
      });
      try { emitScorecardUpdated(getIO(), fresh.toJSON()); } catch { /* Socket not initialized */ }
      res.json(fresh);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Talk Tracks ───────────────────────────────────────────────────────

  // GET /api/coaching/talk-tracks — list talk tracks
  router.get('/talk-tracks', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, isActive } = (req.query as any);
      const where: any = {};
      if (category) where.category = category;
      if (isActive != null) where.isActive = isActive === 'true';

      const tracks = await models.TalkTrack.findAll({
        where,
        order: [['createdAt', 'DESC']],
      });
      res.json(tracks);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/coaching/talk-tracks — create talk track
  router.post('/talk-tracks', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = talkTrackCreateSchema.parse(req.body);
      const track = await models.TalkTrack.create(data);
      logger.info({ talkTrackId: track.id }, 'Talk track created');
      res.status(201).json(track);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // PATCH /api/coaching/talk-tracks/:id — update talk track
  router.patch('/talk-tracks/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = talkTrackUpdateSchema.parse(req.body);
      const track = await models.TalkTrack.findByPk((req.params as any).id);
      if (!track) return res.status(404).json({ error: 'Talk track not found' });
      await track.update(data);
      res.json(track);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // DELETE /api/coaching/talk-tracks/:id — delete talk track
  router.delete('/talk-tracks/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const track = await models.TalkTrack.findByPk((req.params as any).id);
      if (!track) return res.status(404).json({ error: 'Talk track not found' });
      await track.destroy();
      logger.info({ talkTrackId: (req.params as any).id }, 'Talk track deleted');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // ── Agent Coaching Summary ────────────────────────────────────────────

  // GET /api/coaching/agent/:agentId/summary
  router.get('/agent/:agentId/summary', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = (req.params as any);
      const { days = 30 } = (req.query as any);

      const since = new Date();
      since.setDate(since.getDate() - +days);

      const scorecards = await models.CoachingScorecard.findAll({
        where: { agentId, createdAt: { [Op.gte]: since } },
        order: [['createdAt', 'ASC']],
      });

      if (scorecards.length === 0) {
        return res.json({
          agentId,
          avgScore: null,
          trend: 'stable',
          totalScorecards: 0,
          categoryAverages: {},
          recentScorecards: [],
          recommendations: [],
        });
      }

      // Average overall score
      const avgScore = Math.round(
        scorecards.reduce((sum, s) => sum + s.overallScore, 0) / scorecards.length
      );

      // Category averages
      const categoryAverages = {};
      for (const cat of CATEGORIES) {
        const vals = scorecards.map(s => s.categoryScores?.[cat]).filter(v => v != null);
        categoryAverages[cat] = vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 20) // 1-5 → 0-100
          : null;
      }

      // Trend: compare first half vs second half avg
      const mid = Math.floor(scorecards.length / 2);
      const firstHalf = scorecards.slice(0, mid);
      const secondHalf = scorecards.slice(mid);
      const firstAvg = firstHalf.reduce((s, c) => s + c.overallScore, 0) / (firstHalf.length || 1);
      const secondAvg = secondHalf.reduce((s, c) => s + c.overallScore, 0) / (secondHalf.length || 1);
      const trend = secondAvg > firstAvg + 3 ? 'improving' : secondAvg < firstAvg - 3 ? 'declining' : 'stable';

      // Recent 5 scorecards
      const recentScorecards = scorecards.slice(-5).reverse();

      // Coaching recommendations based on lowest categories
      const sortedCats = Object.entries(categoryAverages)
        .filter(([, v]) => v != null)
        .sort((a, b) => Number(a[1]) - Number(b[1]));

      const recommendations = [];
      const catLabels = {
        greeting: 'Greeting & Opening',
        productKnowledge: 'Product Knowledge',
        resolution: 'Issue Resolution',
        communication: 'Communication Skills',
        compliance: 'Compliance & Procedure',
      };
      const catTips = {
        greeting: 'Focus on warm, professional greetings. Practice standard opening scripts and ensure caller feels welcomed.',
        productKnowledge: 'Review product documentation regularly. Shadow product experts and use knowledge base resources.',
        resolution: 'Work on first-call resolution techniques. Practice active listening and confirming customer understanding.',
        communication: 'Improve clarity and pacing. Avoid jargon, use positive language, and confirm customer understanding.',
        compliance: 'Review compliance procedures and required disclosures. Practice mandatory scripts until they become natural.',
      };
      for (const [cat, score] of sortedCats.slice(0, 2)) {
        if (Number(score) < 80) {
          recommendations.push({
            category: cat,
            label: catLabels[cat] || cat,
            score,
            tip: catTips[cat] || 'Focus improvement efforts in this area.',
          });
        }
      }

      res.json({
        agentId,
        avgScore,
        trend,
        totalScorecards: scorecards.length,
        categoryAverages,
        recentScorecards,
        recommendations,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
