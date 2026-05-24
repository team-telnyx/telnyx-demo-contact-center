import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/auth.js';

/**
 * Simulate an IVR flow execution path.
 *
 * Walks through the flow graph step-by-step, consuming DTMF digits from the
 * request body when a "gather" node is encountered, and returns the full
 * execution trace.
 *
 * @param {object} flow - { nodes, edges }
 * @param {string[]} digits - array of DTMF digits to feed into gather nodes
 * @returns {object[]} execution path
 */
function simulateFlow(flow, digits) {
  const adj = {};
  for (const node of flow.nodes) {
    adj[node.id] = [];
  }
  for (const edge of flow.edges) {
    if (!adj[edge.source]) adj[edge.source] = [];
    adj[edge.source].push(edge);
  }

  // Find entry node (answer or first)
  let current = flow.nodes.find((n) => n.type === 'answer') || flow.nodes[0];
  if (!current) return [];

  const path = [];
  let digitIndex = 0;
  const visited = new Set();

  while (current) {
    if (visited.has(current.id)) {
      // Prevent infinite loops — max 50 steps
      path.push({
        nodeId: current.id,
        nodeType: current.type,
        action: 'loop-detected',
        spokenText: '',
        nextNodeId: null,
      });
      break;
    }
    visited.add(current.id);

    const step: any = {
      nodeId: current.id,
      nodeType: current.type,
      action: '',
      spokenText: '',
      nextNodeId: null,
    };

    let nextNodeId = null;

    switch (current.type) {
      case 'answer':
        step.action = 'answer';
        step.spokenText = 'Call answered';
        // Advance to next via default edge
        {
          const edges = adj[current.id] || [];
          const defaultEdge = edges.find((e) => !e.sourceHandle) || edges[0];
          if (defaultEdge) nextNodeId = defaultEdge.target;
        }
        break;

      case 'speak':
        step.action = 'speak';
        step.spokenText = current.data.text || '';
        // Advance to next via default edge
        {
          const edges = adj[current.id] || [];
          const defaultEdge = edges.find((e) => !e.sourceHandle) || edges[0];
          if (defaultEdge) nextNodeId = defaultEdge.target;
        }
        break;

      case 'gather': {
        step.action = 'gather';
        step.spokenText = current.data.prompt || current.data.text || `Waiting for input (${current.data.validDigits || 'any digit'})`;
        // Consume next DTMF digit
        const digit = digits[digitIndex++] || null;
        if (digit !== null) {
          step.gatherResult = digit;
          const edges = adj[current.id] || [];
          const match = edges.find((e) => e.sourceHandle === digit);
          if (match) {
            nextNodeId = match.target;
          } else {
            // No matching edge — try default
            const defaultEdge = edges.find((e) => !e.sourceHandle) || edges[0];
            if (defaultEdge) nextNodeId = defaultEdge.target;
          }
        } else {
          step.gatherResult = null;
          step.action = 'gather-timeout';
        }
        break;
      }

      case 'enqueue':
        step.action = 'enqueue';
        step.spokenText = `Enqueued to: ${current.data.queueName || current.data.queue || 'default'}`;
        // Terminal node
        break;

      case 'transfer':
        step.action = 'transfer';
        step.spokenText = `Transfer to: ${current.data.target || current.data.number || 'unknown'}`;
        // Terminal node
        break;

      case 'record':
        step.action = 'record';
        step.spokenText = 'Recording started';
        // Advance to next
        {
          const edges = adj[current.id] || [];
          const defaultEdge = edges.find((e) => !e.sourceHandle) || edges[0];
          if (defaultEdge) nextNodeId = defaultEdge.target;
        }
        break;

      case 'hangup':
        step.action = 'hangup';
        step.spokenText = 'Call ended';
        // Terminal node
        break;

      default:
        step.action = 'unknown';
        step.spokenText = `Unknown node type: ${current.type}`;
    }

    step.nextNodeId = nextNodeId;
    path.push(step);

    // Move to next node
    if (nextNodeId) {
      current = flow.nodes.find((n) => n.id === nextNodeId) || null;
    } else {
      break;
    }

    // Safety: cap at 50 steps
    if (path.length >= 50) {
      path.push({ nodeId: null, nodeType: 'limit', action: 'max-steps-reached', spokenText: 'Simulation stopped: max steps reached', nextNodeId: null });
      break;
    }
  }

  return path;
}

export function createIvrRouter(models: any) {
  const router = Router();

  // List IVR flows
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flows = await models.IvrFlow.findAll({ order: [['updatedAt', 'DESC']] });
      res.json(flows);
    } catch (err) {
      next(err);
    }
  });

  // Get single IVR flow
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flow = await models.IvrFlow.findByPk((req.params as any).id, {
        include: [{ model: models.NumberAssignment, as: 'numbers' }],
      });
      if (!flow) return res.status(404).json({ error: 'IVR flow not found' });
      res.json(flow);
    } catch (err) {
      next(err);
    }
  });

  // Create IVR flow — admin/supervisor only
  const flowSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    nodes: z.array(z.object({
      id: z.string(),
      type: z.enum(['answer', 'speak', 'gather', 'enqueue', 'transfer', 'record', 'hangup']),
      data: z.record(z.any()),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
    })),
    edges: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().optional(),
      label: z.string().optional(),
    })),
  });

  router.post('/', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = flowSchema.parse(req.body);
      const flow = await models.IvrFlow.create(data);
      logger.info({ flowId: flow.id, name: flow.name }, 'IVR flow created');
      res.status(201).json(flow);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // Update IVR flow — admin/supervisor only
  router.put('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = flowSchema.parse(req.body);
      const flow = await models.IvrFlow.findByPk((req.params as any).id);
      if (!flow) return res.status(404).json({ error: 'IVR flow not found' });

      await flow.update({ ...data, version: flow.version + 1 });
      logger.info({ flowId: flow.id, version: flow.version }, 'IVR flow updated');
      res.json(flow);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // Publish / unpublish — admin/supervisor only
  router.patch('/:id/publish', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { published } = z.object({ published: z.boolean() }).parse(req.body);
      const flow = await models.IvrFlow.findByPk((req.params as any).id);
      if (!flow) return res.status(404).json({ error: 'IVR flow not found' });

      await flow.update({ published });
      logger.info({ flowId: flow.id, published }, published ? 'IVR flow published' : 'IVR flow unpublished');
      res.json(flow);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // Delete IVR flow — admin/supervisor only
  router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flow = await models.IvrFlow.findByPk((req.params as any).id);
      if (!flow) return res.status(404).json({ error: 'IVR flow not found' });
      if (flow.published) return res.status(409).json({ error: 'Cannot delete a published flow — unpublish first' });

      await flow.destroy();
      logger.info({ flowId: (req.params as any).id }, 'IVR flow deleted');
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  });

  // Simulate / test an IVR flow
  router.post('/:id/simulate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { digits } = z.object({
        digits: z.array(z.string()).optional().default([]),
      }).parse(req.body || {});

      const flow = await models.IvrFlow.findByPk((req.params as any).id);
      if (!flow) return res.status(404).json({ error: 'IVR flow not found' });

      const executionPath = simulateFlow(flow, digits);
      res.json({ flowId: flow.id, flowName: flow.name, path: executionPath });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  return router;
}
