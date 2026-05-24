import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import { emitAgentStatusUpdate } from '../services/socket.js';
import { onAgentOnline, completeWrapUp } from '../services/acd.js';
import { requireRole } from '../middleware/auth.js';

export function createAgentsRouter(models: any) {
  const router = Router();

  // List all agents with their status
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agents = await models.Agent.findAll({
        include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName', 'role'] }],
        order: [['priority', 'ASC']],
      });
      res.json(agents);
    } catch (err) {
      next(err);
    }
  });

  // ── Create agent (admin/supervisor only) ─────────────────────────────
  router.post('/', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createSchema = z.object({
        userId: z.string().uuid(),
        priority: z.number().int().min(1).max(999).optional(),
        queues: z.array(z.string()).optional(),
        extension: z.string().max(10).optional(),
        sipUsername: z.string().optional(),
        skills: z.array(z.object({ name: z.string(), level: z.number().int().min(1).max(5) })).optional(),
      });
      const data = createSchema.parse(req.body);
      const agent = await models.Agent.create(data);
      logger.info({ agentId: agent.id }, 'Agent created');
      const fresh = await models.Agent.findByPk(agent.id, {
        include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName', 'role'] }],
      });
      res.status(201).json(fresh);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // Update agent status
  const updateSchema = z.object({
    status: z.enum(['online', 'away', 'busy', 'break', 'dnd', 'offline']).optional(),
    priority: z.number().int().min(1).max(999).optional(),
    queues: z.array(z.string()).optional(),
    extension: z.string().max(10).optional(),
    presence: z.enum(['online', 'available', 'busy', 'away', 'offline']).optional(),
    active: z.boolean().optional(),
  });

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateSchema.parse(req.body);
      const agent = await models.Agent.findByPk((req.params as any).id, {
        include: [{ model: models.User, as: 'user' }],
      });
      if (!agent) return res.status(404).json({ error: 'Agent not found' });

      // Authorization: agents can only update their own profile; only
      // supervisors/admins can edit other agents or change `priority` / `queues`.
      const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';
      const isSelf = agent.userId === req.user.id;
      if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: 'You can only update your own agent profile' });
      }
      if (!isAdmin && (data.priority !== undefined || data.queues !== undefined || data.active !== undefined)) {
        return res.status(403).json({ error: 'Only supervisors/admins can change priority, queues, or active status' });
      }

      const oldStatus = agent.status;
      await agent.update(data);
      logger.info({ agentId: agent.id, updates: data }, 'Agent updated');

      // Broadcast status change via Socket.IO
      if (data.status && data.status !== oldStatus) {
        emitAgentStatusUpdate(agent.id, data.status, agent.userId);

        // If coming online, check queues for waiting calls
        if (data.status === 'online') {
          await onAgentOnline(agent.id, models);
        }
      }

      res.json(agent);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // Get a single agent
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await models.Agent.findByPk((req.params as any).id, {
        include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName', 'role'] }],
      });
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      res.json(agent);
    } catch (err) {
      next(err);
    }
  });

  // Get current agent's profile (for the logged-in user)
  router.get('/me/profile', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName', 'role'] }],
      });
      if (!agent) return res.status(404).json({ error: 'Agent profile not found' });
      res.json(agent);
    } catch (err) {
      next(err);
    }
  });

  // Get queue status
  router.get('/queues/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { getQueueStatus } = await import('../services/acd.js');
      const queueStatus = await getQueueStatus();
      res.json(queueStatus);
    } catch (err) {
      next(err);
    }
  });


  // Complete wrap-up (ACW) — agent finishes disposition/notes and re-enters routing
  router.post('/:id/wrap-up/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await models.Agent.findByPk((req.params as any).id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });

      // Authorization: agents can only complete their own wrap-up; admins/supervisors anyone's
      const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';
      const isSelf = agent.userId === req.user.id;
      if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: 'You can only complete your own wrap-up' });
      }

      await completeWrapUp(agent.id, models);
      const fresh = await models.Agent.findByPk(agent.id, {
        include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'displayName', 'role'] }],
      });
      res.json(fresh);
    } catch (err) {
      next(err);
    }
  });

  // Delete agent (admin/supervisor only)
  router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await models.Agent.findByPk((req.params as any).id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      await agent.destroy();
      logger.info({ agentId: agent.id }, 'Agent deleted');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
