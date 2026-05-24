import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import {
  getQueueLiveStats,
  getQueueStatus,
} from '../services/acd.js';
import {
  emitQueueCreated,
  emitQueueUpdated,
  emitQueueDeleted,
} from '../services/socket.js';
import { requireRole } from '../middleware/auth.js';

const skillSchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1).max(5),
});

const createSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_-]+$/i, 'name must be alphanumeric/underscore/dash'),
  displayName: z.string().optional(),
  strategy: z.enum(['round-robin', 'least-recent', 'most-idle', 'skills-weighted', 'priority']).optional(),
  maxWaitSeconds: z.number().int().min(0).optional(),
  wrapUpSeconds: z.number().int().min(0).optional(),
  slaTargetSeconds: z.number().int().min(0).optional(),
  slaThresholdPct: z.number().int().min(0).max(100).optional(),
  priority: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
  musicOnHoldUrl: z.string().url().optional().or(z.literal('')),
  maxQueueSize: z.number().int().min(0).optional(),
  overflowAction: z.enum(['voicemail', 'callback', 'hangup', 'transfer']).optional(),
  overflowTarget: z.string().optional(),
  required_XqSkls: z.array(skillSchema).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateSchema = createSchema.partial();

// Role gating is now handled by requireRole from middleware/auth.js

export function createQueuesRouter(models: any) {
  const router = Router();

  // GET /api/queues — list all queues with live stats merged in
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = (req.query as any).includeInactive === 'true';
      const where = includeInactive ? {} : { active: true };
      const queues = await models.Queue.findAll({
        where,
        order: [['priority', 'ASC'], ['name', 'ASC']],
      });
      const liveDepth = await getQueueStatus();
      const rows = queues.map((q) => {
        const plain = q.get({ plain: true });
        const live = liveDepth[plain.name] || { depth: 0, oldestWaitMs: 0 };
        return { ...plain, depth: live.depth, oldestWaitMs: live.oldestWaitMs };
      });
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/queues/:id — single queue
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = await models.Queue.findByPk((req.params as any).id);
      if (!q) return res.status(404).json({ error: 'Queue not found' });
      res.json(q);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/queues/:id/stats — live stats (depth, wait, agents, SLA %)
  router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = await models.Queue.findByPk((req.params as any).id);
      if (!q) return res.status(404).json({ error: 'Queue not found' });
      const windowMinutes = Number((req.query as any).windowMinutes) || 60;
      const stats = await getQueueLiveStats(models, q.name, { windowMinutes });
      res.json({ id: q.id, ...stats });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/queues — create
  router.post('/', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      if (data.musicOnHoldUrl === '') delete data.musicOnHoldUrl;
      const queue = await models.Queue.create(data);
      logger.info({ queueId: queue.id, name: queue.name }, 'Queue created');
      emitQueueCreated(queue.get({ plain: true }));
      res.status(201).json(queue);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Queue name must be unique' });
      }
      next(err);
    }
  });

  // PATCH /api/queues/:id — update
  router.patch('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateSchema.parse(req.body);
      if (data.musicOnHoldUrl === '') delete data.musicOnHoldUrl;
      const queue = await models.Queue.findByPk((req.params as any).id);
      if (!queue) return res.status(404).json({ error: 'Queue not found' });
      await queue.update(data);
      logger.info({ queueId: queue.id, updates: Object.keys(data) }, 'Queue updated');
      emitQueueUpdated(queue.get({ plain: true }));
      res.json(queue);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // DELETE /api/queues/:id — soft delete (sets active=false)
  router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = await models.Queue.findByPk((req.params as any).id);
      if (!queue) return res.status(404).json({ error: 'Queue not found' });
      await queue.update({ active: false });
      logger.info({ queueId: queue.id, name: queue.name }, 'Queue soft-deleted');
      emitQueueDeleted(queue.id);
      res.json({ id: queue.id, active: false });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
