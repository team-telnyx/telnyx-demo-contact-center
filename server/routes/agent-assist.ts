import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import { generateAgentAssistSuggestions } from '../services/llm.js';

export function createAgentAssistRouter(models: any) {
  const router = Router();

  // POST /api/agent-assist/suggest — real-time AI suggestions for agents
  router.post('/suggest', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        transcript: z.string().min(1),
        context: z.record(z.any()).optional(),
      });
      const { transcript, context } = schema.parse(req.body);

      const result = await generateAgentAssistSuggestions({ transcript, context });

      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // GET /api/agent-assist/caller/:phoneNumber — lookup caller info for agent panel
  router.get('/caller/:phoneNumber', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = (req.params as any);
      if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

      // Find contact by phone number
      const contact = models.Contact
        ? await models.Contact.findOne({ where: { phoneNumber } })
        : null;

      if (!contact) {
        return res.json({ found: false, phoneNumber });
      }

      // Get recent call history for this contact
      const recentCalls = await models.Call.findAll({
        where: { from: phoneNumber },
        order: [['startedAt', 'DESC']],
        limit: 5,
        include: [
          { model: models.CaseNote, as: 'caseNote', required: false },
          ...(models.Disposition ? [{ model: models.Disposition, as: 'disposition', required: false }] : []),
        ],
      });

      res.json({
        found: true,
        contact,
        recentCalls,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
