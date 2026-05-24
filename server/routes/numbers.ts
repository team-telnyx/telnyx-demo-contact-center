import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';

const messagingFields = {
  messagingProfileId: z.string().optional().nullable(),
  countryCode: z.string().length(2).toUpperCase().optional().nullable(),
  numberType: z.enum(['local', 'toll_free', 'short_code', 'alphanumeric']).optional().nullable(),
  smsEnabled: z.boolean().optional(),
  label: z.string().optional().nullable(),
};

const createSchema = z.object({
  phoneNumber: z.string().min(1, 'phoneNumber is required'),
  ivrFlowId: z.string().uuid().optional().nullable(),
  connectionId: z.string().optional().nullable(),
  ...messagingFields,
});

const updateSchema = z.object({
  ivrFlowId: z.string().uuid().optional().nullable(),
  connectionId: z.string().optional().nullable(),
  phoneNumber: z.string().min(1).optional(),
  ...messagingFields,
});

export function createNumbersRouter(models: any) {
  const router = Router();

  // GET /api/numbers — list all number assignments
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const numbers = await models.NumberAssignment.findAll({
        include: [{ model: models.IvrFlow, as: 'ivrFlow' }],
      });
      res.json(numbers);
    } catch (err) { next(err); }
  });

  // POST /api/numbers — create number assignment (admin/supervisor only)
  router.post('/', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      const assignment = await models.NumberAssignment.create(data);
      res.status(201).json(assignment);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // PATCH /api/numbers/:id — update number assignment (admin/supervisor only)
  router.patch('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateSchema.parse(req.body);
      const assignment = await models.NumberAssignment.findByPk((req.params as any).id);
      if (!assignment) return res.status(404).json({ error: 'Number assignment not found' });
      await assignment.update(data);
      res.json(assignment);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  return router;
}
