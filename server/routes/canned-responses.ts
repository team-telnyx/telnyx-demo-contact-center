import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import logger from '../middleware/errorHandler.js';

/**
 * Canned Responses API
 *
 * Library of pre-written agent replies (greetings, hold messages, escalations, etc.)
 * keyed by a `/shortcut`. Agents type the shortcut in chat/notes to auto-complete.
 *
 * - GET    /api/canned-responses           list active (filter by ?search=, ?category=)
 * - POST   /api/canned-responses           create (admin/supervisor)
 * - PATCH  /api/canned-responses/:id       update (admin/supervisor)
 * - DELETE /api/canned-responses/:id       soft delete (admin/supervisor) — sets active=false
 * - POST   /api/canned-responses/:id/use   increment usage count (any authed user)
 */
export function createCannedResponsesRouter(models: any) {
  const router = Router();

  const isPriv = (req) => req.user?.role === 'admin' || req.user?.role === 'supervisor';

  // List — supports ?search=foo&category=greetings
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, category } = (req.query as any);
      const where: any = { active: true };
      if (category) where.category = String(category);
      if (search) {
        const s = `%${String(search).trim()}%`;
        where[Op.or] = [
          { shortcut: { [Op.like]: s } },
          { title:    { [Op.like]: s } },
          { content:  { [Op.like]: s } },
        ];
      }
      const rows = await models.CannedResponse.findAll({
        where,
        order: [['usageCount', 'DESC'], ['shortcut', 'ASC']],
      });
      res.json(rows);
    } catch (err) { next(err); }
  });

  // Create
  const createSchema = z.object({
    shortcut: z.string().min(1).regex(/^\//, 'shortcut must start with /'),
    title:    z.string().min(1),
    content:  z.string().min(1),
    category: z.string().optional(),
    tags:     z.array(z.string()).optional(),
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isPriv(req)) return res.status(403).json({ error: 'Admin/supervisor only' });
      const data = createSchema.parse(req.body);
      const existing = await models.CannedResponse.findOne({ where: { shortcut: data.shortcut } });
      if (existing) return res.status(409).json({ error: 'Shortcut already exists' });
      const row = await models.CannedResponse.create(data);
      logger.info({ id: row.id, shortcut: row.shortcut }, 'Canned response created');
      res.status(201).json(row);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // Update
  const updateSchema = z.object({
    shortcut: z.string().min(1).regex(/^\//).optional(),
    title:    z.string().min(1).optional(),
    content:  z.string().min(1).optional(),
    category: z.string().nullable().optional(),
    tags:     z.array(z.string()).optional(),
    active:   z.boolean().optional(),
  });

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isPriv(req)) return res.status(403).json({ error: 'Admin/supervisor only' });
      const data = updateSchema.parse(req.body);
      const row = await models.CannedResponse.findByPk((req.params as any).id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      await row.update(data);
      res.json(row);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // Soft delete — set active=false instead of destroying so usage stats persist
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isPriv(req)) return res.status(403).json({ error: 'Admin/supervisor only' });
      const row = await models.CannedResponse.findByPk((req.params as any).id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      await row.update({ active: false });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // Increment usage counter (call this when the agent actually uses the snippet)
  router.post('/:id/use', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await models.CannedResponse.findByPk((req.params as any).id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      await row.increment('usageCount', { by: 1 });
      await row.reload();
      res.json({ id: row.id, usageCount: row.usageCount });
    } catch (err) { next(err); }
  });

  return router;
}
