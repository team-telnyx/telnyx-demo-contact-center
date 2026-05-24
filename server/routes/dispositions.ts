import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/auth.js';
import bus from '../services/event-bus.js';

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  requireNotes: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial().extend({
  active: z.boolean().optional(),
});

const setDispositionSchema = z.object({
  dispositionId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Role gating handled by requireRole from middleware/auth.js

export function createDispositionsRouter(models: any) {
  const router = Router();

  // ── List active dispositions ──────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = (req.query as any).includeInactive === 'true';
      const where = includeInactive ? {} : { active: true };
      const dispositions = await models.Disposition.findAll({
        where,
        order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      });
      res.json(dispositions);
    } catch (err) { next(err); }
  });

  // ── Create disposition (admin) ────────────────────────────────────────────
  router.post('/', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      const disposition = await models.Disposition.create(data);
      logger.info({ dispositionId: disposition.id }, 'Disposition created');
      res.status(201).json(disposition);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Update disposition ────────────────────────────────────────────────────
  router.patch('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateSchema.parse(req.body);
      const disposition = await models.Disposition.findByPk((req.params as any).id);
      if (!disposition) return res.status(404).json({ error: 'Disposition not found' });
      await disposition.update(data);
      res.json(disposition);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Soft delete (active=false) ────────────────────────────────────────────
  router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const disposition = await models.Disposition.findByPk((req.params as any).id);
      if (!disposition) return res.status(404).json({ error: 'Disposition not found' });
      await disposition.update({ active: false });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
}

/**
 * Mounted under /api/calls/:callId/disposition (not /api/dispositions)
 * — sets disposition on a call and propagates to its CallRecord.
 */
export function createCallDispositionRouter(models: any) {
  const router = Router({ mergeParams: true });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = setDispositionSchema.parse(req.body);
      const call = await models.Call.findByPk((req.params as any).callId);
      if (!call) return res.status(404).json({ error: 'Call not found' });

      // If dispositionId provided, validate it exists & is active
      if (data.dispositionId) {
        const disposition = await models.Disposition.findByPk(data.dispositionId);
        if (!disposition) return res.status(404).json({ error: 'Disposition not found' });
        if (disposition.requireNotes && !data.notes?.trim()) {
          return res.status(400).json({ error: 'Notes are required for this disposition' });
        }
      }

      const updates: any = {};
      if (data.dispositionId !== undefined) updates.dispositionId = data.dispositionId;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.tags !== undefined) updates.tags = data.tags;

      await call.update(updates);

      // Propagate to CallRecord
      const callRecord = await models.CallRecord.findOne({ where: { callId: call.id } });
      if (callRecord) {
        await callRecord.update(updates);
      }

      logger.info({ callId: call.id, dispositionId: data.dispositionId }, 'Call disposition set');

      // Emit event bus: disposition set
      bus.emit('disposition:set', {
        callId: call.id,
        dispositionId: data.dispositionId,
        agentId: call.agentId,
        queueName: call.queueName,
        notes: data.notes,
        tags: data.tags,
      });

      const refreshed = await models.Call.findByPk(call.id, {
        include: [{ model: models.Disposition, as: 'disposition' }],
      });
      res.json(refreshed);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  return router;
}
