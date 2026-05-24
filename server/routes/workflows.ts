import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/auth.js';
import bus from '../services/event-bus.js';
import { executeWorkflowActions } from '../services/workflow-executor.js';
import { getIO } from '../services/socket.js';

// Escape LIKE wildcard characters in user input to prevent unexpected pattern matching
function escapeLike(str: string) {
  return str.replace(/[%_\\]/g, '\\$&');
}

/* ── Zod schemas ─────────────────────────────────────────────────── */

const triggerSchema = z.object({
  type: z.enum([
    'call.started',
    'call.ended',
    'call.missed',
    'call.queued',
    'call.transfer',
    'queue.depth_exceeded',
    'agent.status_change',
    'disposition.set',
    'recording.saved',
    'chat.message_received',
    'form.submitted',
  ]),
  config: z.record(z.any()).default({}),
});

const actionSchema = z.object({
  type: z.enum([
    'send_sms',
    'send_email',
    'tag_call',
    'assign_agent',
    'set_disposition',
    'escalate',
    'trigger_webhook',
    'create_task',
    'notify_team',
    'update_contact',
    'submit_form',
  ]),
  config: z.record(z.any()).default({}),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(''),
  trigger: triggerSchema,
  actions: z.array(actionSchema).min(1, 'At least one action is required'),
  enabled: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  trigger: triggerSchema.optional(),
  actions: z.array(actionSchema).min(1).optional(),
  enabled: z.boolean().optional(),
});

/* ── Trigger-to-event-bus mapping ────────────────────────────────── */
// Workflow triggers use dot notation (e.g., 'call.ended')
// Event bus uses colon notation (e.g., 'call:ended')
function triggerToBusEvent(triggerType) {
  return triggerType.replace('.', ':');
}

/* ── Trigger condition matching ──────────────────────────────────── */
function matchesTriggerConditions(trigger, payload) {
  const { config } = trigger;
  if (!config || Object.keys(config).length === 0) return true; // no conditions = always match

  // queue.depth_exceeded: check queue name and threshold
  if (trigger.type === 'queue.depth_exceeded') {
    if (config.queue && config.queue !== '*' && payload.queueName !== config.queue) return false;
    if (config.threshold && payload.depth <= config.threshold) return false;
  }

  // agent.status_change: check specific status
  if (trigger.type === 'agent.status_change') {
    if (config.status && config.status !== 'any' && payload.status !== config.status) return false;
  }

  // disposition.set: check specific disposition
  if (trigger.type === 'disposition.set') {
    if (config.disposition && config.disposition !== 'any' && payload.dispositionId !== config.disposition) return false;
  }

  // form.submitted: check specific form
  if (trigger.type === 'form.submitted') {
    if (config.formId && payload.form?.id !== config.formId) return false;
    if (config.formName && payload.form?.name !== config.formName) return false;
  }

  return true;
}

/* ── Build execution context from event payload ──────────────────── */
function buildContext(payload, models): any {
  return {
    event: payload,
    call: payload.callId ? { id: payload.callId, from: payload.from, to: payload.to, direction: payload.direction, status: payload.status } : undefined,
    agent: payload.agentId ? { id: payload.agentId } : undefined,
    queue: payload.queueName ? { name: payload.queueName } : undefined,
    form: payload.form ? { id: payload.form.id, name: payload.form.name } : undefined,
    submission: payload.submission ? { id: payload.submission.id, data: payload.submission.data } : undefined,
  };
}

/* ── Active trigger listeners (for cleanup on re-register) ─────── */
const activeListeners = new Map(); // workflowId → { event, handler }

/**
 * Register all enabled workflow triggers on the event bus.
 * Called at startup and whenever workflows are created/updated/deleted/toggled.
 */
export async function registerWorkflowTriggers(models: any) {
  // Remove all existing listeners
  for (const [workflowId, { event, handler }] of activeListeners) {
    bus.off(event, handler);
  }
  activeListeners.clear();

  // Load all enabled workflows
  const workflows = await models.Workflow.findAll({ where: { enabled: true } });

  for (const wf of workflows) {
    const busEvent = triggerToBusEvent(wf.trigger.type);

    const handler = async (payload) => {
      try {
        if (!matchesTriggerConditions(wf.trigger, payload)) return;

        const context: any = buildContext(payload, models);
        context.workflowId = wf.id;
        context.workflowName = wf.name;

        logger.info({ workflowId: wf.id, name: wf.name, triggerEvent: busEvent }, 'Workflow triggered by event');

        const results = await executeWorkflowActions(wf.actions, context, models);

        // Determine overall status
        const errorCount = results.filter((r) => r.status === 'error').length;
        const status = errorCount === 0 ? 'success' : errorCount === results.length ? 'failed' : 'partial';

        // Update workflow stats
        await wf.update({ lastRunAt: new Date(), runCount: wf.runCount + 1 });

        // Create execution record
        await models.WorkflowExecution.create({
          workflowId: wf.id,
          triggerEvent: busEvent,
          context,
          results,
          status,
          executedAt: new Date(),
        });

        // Log execution
        logger.info({ workflowId: wf.id, triggerEvent: busEvent, status }, `Workflow "${wf.name}" executed (${status})`);

        // Emit socket event
        try {
          const io = getIO();
          io.to('agents').emit('workflow:executed', {
            workflowId: wf.id,
            name: wf.name,
            status,
            results,
            triggerEvent: busEvent,
          });
        } catch {
          /* socket not ready */
        }
      } catch (err) {
        logger.error({ err, workflowId: wf.id }, 'Workflow trigger handler error');
      }
    };

    bus.on(busEvent, handler);
    activeListeners.set(wf.id, { event: busEvent, handler });
  }

  logger.info({ count: activeListeners.size }, 'Workflow triggers registered');
}

/* ── Router factory ──────────────────────────────────────────────── */

export function createWorkflowsRouter(models: any) {
  const router = Router();

  // GET /api/workflows — list all workflows
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, enabled } = (req.query as any);
      const where: any = {};
      if (enabled === 'true') where.enabled = true;
      if (enabled === 'false') where.enabled = false;
      if (search) where.name = { [Op.like]: `%${escapeLike(search)}%` };

      const workflows = await models.Workflow.findAll({
        where,
        order: [['updatedAt', 'DESC']],
      });
      res.json(workflows);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/workflows — create workflow
  router.post('/', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      const workflow = await models.Workflow.create({
        ...data,
        createdBy: req.user?.userId || null,
      });
      logger.info({ workflowId: workflow.id, name: workflow.name }, 'Workflow created');
      // Re-register triggers so the new workflow is picked up
      registerWorkflowTriggers(models).catch((err) =>
        logger.error({ err }, 'Failed to re-register workflow triggers after create'),
      );
      res.status(201).json(workflow);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // GET /api/workflows/:id — single workflow
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await models.Workflow.findByPk((req.params as any).id);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
      res.json(workflow);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/workflows/:id — update workflow
  router.patch('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateSchema.parse(req.body);
      const workflow = await models.Workflow.findByPk((req.params as any).id);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
      await workflow.update(data);
      logger.info({ workflowId: workflow.id }, 'Workflow updated');
      // Re-register triggers (trigger type may have changed)
      registerWorkflowTriggers(models).catch((err) =>
        logger.error({ err }, 'Failed to re-register workflow triggers after update'),
      );
      res.json(workflow);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // DELETE /api/workflows/:id — delete workflow
  router.delete('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await models.Workflow.findByPk((req.params as any).id);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
      await workflow.destroy();
      logger.info({ workflowId: workflow.id, name: workflow.name }, 'Workflow deleted');
      // Re-register triggers to remove the deleted workflow's listener
      registerWorkflowTriggers(models).catch((err) =>
        logger.error({ err }, 'Failed to re-register workflow triggers after delete'),
      );
      res.json({ id: workflow.id, deleted: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/workflows/:id/toggle — enable/disable workflow
  router.post('/:id/toggle', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await models.Workflow.findByPk((req.params as any).id);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
      await workflow.update({ enabled: !workflow.enabled });
      logger.info({ workflowId: workflow.id, enabled: workflow.enabled }, 'Workflow toggled');
      // Re-register triggers (disabled workflows should not have listeners)
      registerWorkflowTriggers(models).catch((err) =>
        logger.error({ err }, 'Failed to re-register workflow triggers after toggle'),
      );
      res.json(workflow);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/workflows/:id/run — manually trigger a workflow run (REAL execution)
  router.post('/:id/run', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await models.Workflow.findByPk((req.params as any).id);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

      logger.info({ workflowId: workflow.id, name: workflow.name }, 'Workflow manually triggered');

      // Build minimal context for manual trigger (no specific event payload)
      const context = { workflowId: workflow.id, workflowName: workflow.name, manual: true };

      // Execute actions
      const results = await executeWorkflowActions(workflow.actions, context, models);

      // Determine overall status
      const errorCount = results.filter((r) => r.status === 'error').length;
      const status = errorCount === 0 ? 'success' : errorCount === results.length ? 'failed' : 'partial';

      // Update workflow stats
      await workflow.update({ lastRunAt: new Date(), runCount: workflow.runCount + 1 });

      // Create execution record
      const execution = await models.WorkflowExecution.create({
        workflowId: workflow.id,
        triggerEvent: 'manual',
        context,
        results,
        status,
        executedAt: new Date(),
      });

      // Log execution
      logger.info({ workflowId: workflow.id, executionId: execution.id, status }, `Workflow "${workflow.name}" manually executed (${status})`);

      // Emit socket event
      try {
        const io = getIO();
        io.to('agents').emit('workflow:executed', {
          workflowId: workflow.id,
          name: workflow.name,
          status,
          results,
          triggerEvent: 'manual',
        });
      } catch {
        /* socket not ready */
      }

      res.json({
        id: workflow.id,
        name: workflow.name,
        lastRunAt: workflow.lastRunAt,
        runCount: workflow.runCount,
        status,
        executionId: execution.id,
        results,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/workflows/:id/executions — list execution history for a workflow
  router.get('/:id/executions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await models.Workflow.findByPk((req.params as any).id);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

      const limit = Math.min(parseInt((req.query as any).limit, 10) || 20, 100);
      const offset = parseInt((req.query as any).offset, 10) || 0;

      const { rows, count } = await models.WorkflowExecution.findAndCountAll({
        where: { workflowId: workflow.id },
        order: [['executedAt', 'DESC']],
        limit,
        offset,
      });

      res.json({ executions: rows, total: count, limit, offset });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
