import { Router, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';

export function createSmsTemplatesRouter(models: any) {
  const router = Router();

  // GET / — list templates (with optional category filter)
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category } = req.query as any;
      const where: any = {};
      if (category) where.category = category;

      const templates = await models.SmsTemplate.findAll({
        where,
        order: [['name', 'ASC']],
      });
      res.json(templates);
    } catch (err) {
      next(err);
    }
  });

  // POST / — create template
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(200),
        body: z.string().min(1).max(1600),
        category: z.string().max(100).optional(),
        isDefault: z.boolean().optional(),
      });
      const data = schema.parse(req.body);

      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });

      const template = await models.SmsTemplate.create({
        name: data.name,
        body: data.body,
        category: data.category || null,
        isDefault: data.isDefault || false,
        createdBy: myAgent?.id || null,
      });

      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // PUT /:id — update template
  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(200).optional(),
        body: z.string().min(1).max(1600).optional(),
        category: z.string().max(100).nullable().optional(),
        isDefault: z.boolean().optional(),
      });
      const data = schema.parse(req.body);

      const template = await models.SmsTemplate.findByPk(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template not found' });

      await template.update(data);
      res.json(template);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // DELETE /:id — delete template
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await models.SmsTemplate.findByPk(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template not found' });

      await template.destroy();
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /:id/use — use a template (render variables, increment usage count)
  router.post('/:id/use', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        variables: z.record(z.string()).optional().default({}),
      });
      const { variables } = schema.parse(req.body || {});

      const template = await models.SmsTemplate.findByPk(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template not found' });

      // Replace {{variable}} placeholders with provided values
      let rendered = template.body;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(regex, value);
      }

      // Increment usage count and update lastUsedAt
      await template.update({
        usageCount: (template.usageCount || 0) + 1,
        lastUsedAt: new Date(),
      });

      res.json({ rendered, templateId: template.id, name: template.name });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  return router;
}
