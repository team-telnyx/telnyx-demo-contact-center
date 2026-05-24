import { Router, Request, Response, NextFunction } from 'express';
import { Op, literal } from 'sequelize';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';

// Escape LIKE wildcard characters in user input to prevent unexpected pattern matching
function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}
import { requireRole } from '../middleware/auth.js';

const createSchema = z.object({
  phoneNumber: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  company: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'unknown']).optional(),
});

const updateSchema = createSchema.partial();

const autoCreateSchema = z.object({
  phoneNumber: z.string().min(1),
  callId: z.string().uuid().optional(),
  name: z.string().optional(),
});

export function createContactsRouter(models: any) {
  const router = Router();

  // ── List contacts (search, pagination) ────────────────────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q: _q, search: _search, tag, page = 1, limit = 25 } = (req.query as any);
      const q = _q || _search; // accept both ?q= and ?search=
      const where: any = {};

      if (q) {
        const escaped = escapeLike(q);
        const like = `%${escaped}%`;
        where[Op.or] = [
          { phoneNumber: { [Op.like]: like } },
          { name: { [Op.like]: like } },
          { email: { [Op.like]: like } },
          { company: { [Op.like]: like } },
        ];
      }
      if (tag) {
        // SQLite stores tags as JSON text — use LIKE to match the tag within the array
        const safeTag = String(tag).replace(/"/g, '');
        where[Op.and] = [...(where[Op.and] || []),
          literal(`(tags LIKE '%"${safeTag}"%')`)]
;
      }

      const { rows, count } = await models.Contact.findAndCountAll({
        where,
        order: [['lastCallAt', 'DESC'], ['createdAt', 'DESC']],
        limit: Math.min(Number(limit), 100),
        offset: (Number(page) - 1) * Number(limit),
      });

      res.json({
        contacts: rows,
        total: count,
        page: Number(page),
        pages: Math.ceil(count / Number(limit)),
      });
    } catch (err) { next(err); }
  });

  // ── Lookup by phone number (place BEFORE /:id) ────────────────────────────
  router.get('/lookup/:phoneNumber', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contact = await models.Contact.findOne({
        where: { phoneNumber: (req.params as any).phoneNumber },
      });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      res.json(contact);
    } catch (err) { next(err); }
  });

  // ── Get contact detail with call history ──────────────────────────────────
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contact = await models.Contact.findByPk((req.params as any).id, {
        include: [
          {
            model: models.CallRecord,
            as: 'callRecords',
            include: [{ model: models.Disposition, as: 'disposition' }],
            order: [['startedAt', 'DESC']],
            limit: 50,
          },
        ],
      });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      res.json(contact);
    } catch (err) { next(err); }
  });

  // ── Create contact ────────────────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      if (data.email === '') delete data.email;
      const existing = await models.Contact.findOne({ where: { phoneNumber: data.phoneNumber } });
      if (existing) return res.status(409).json({ error: 'Contact already exists', contact: existing });
      const contact = await models.Contact.create(data);
      logger.info({ contactId: contact.id }, 'Contact created');
      res.status(201).json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Update contact ────────────────────────────────────────────────────────
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateSchema.parse(req.body);
      if (data.email === '') delete data.email;
      const contact = await models.Contact.findByPk((req.params as any).id);
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      await contact.update(data);
      res.json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Delete contact ────────────────────────────────────────────────────────
  // DELETE /api/contacts/:id — admin/supervisor only
  router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contact = await models.Contact.findByPk((req.params as any).id);
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      await contact.destroy();
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ── Auto-create from call (idempotent) ────────────────────────────────────
  // Used by webhook on new caller. Increments totalCalls + updates lastCallAt.
  router.post('/auto-create', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = autoCreateSchema.parse(req.body);
      const now = new Date();
      let contact = await models.Contact.findOne({ where: { phoneNumber: data.phoneNumber } });

      if (!contact) {
        contact = await models.Contact.create({
          phoneNumber: data.phoneNumber,
          name: data.name,
          totalCalls: 1,
          lastCallAt: now,
        });
        logger.info({ contactId: contact.id, phoneNumber: contact.phoneNumber }, 'Contact auto-created from call');
      } else {
        await contact.update({
          totalCalls: (contact.totalCalls || 0) + 1,
          lastCallAt: now,
          // Only fill name if missing
          name: contact.name || data.name || null,
        });
      }

      // Link the call/record to this contact if callId provided
      if (data.callId) {
        const call = await models.Call.findByPk(data.callId);
        if (call) await call.update({ contactId: contact.id });
        const callRecord = await models.CallRecord.findOne({ where: { callId: data.callId } });
        if (callRecord) await callRecord.update({ contactId: contact.id });
      }

      res.status(201).json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  return router;
}
