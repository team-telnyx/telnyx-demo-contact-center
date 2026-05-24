import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import { sendSms } from '../services/telnyx.js';

const createSchema = z.object({
  fromNumber: z.string().min(1),
  toNumber: z.string().min(1),
  text: z.string().min(1).max(1600),
  scheduledAt: z.string().datetime(),
  conversationId: z.string().uuid().optional().nullable(),
});

export function createScheduledSmsRouter(models: any) {
  const router = Router();

  // GET /api/scheduled-sms
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await models.ScheduledSms.findAll({
        order: [['scheduledAt', 'DESC']],
        limit: 500,
      });
      res.json(rows);
    } catch (err) { next(err); }
  });

  // POST /api/scheduled-sms
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      const agentId = (req as any).user?.id ?? null;
      const row = await models.ScheduledSms.create({ ...data, agentId });
      res.status(201).json(row);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // POST /api/scheduled-sms/:id/send-now
  router.post('/:id/send-now', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await models.ScheduledSms.findByPk((req.params as any).id);
      if (!row) return res.status(404).json({ error: 'Scheduled SMS not found' });
      if (row.status !== 'pending') return res.status(400).json({ error: 'Can only send pending messages' });

      const contact = await models.Contact.findOne({ where: { phoneNumber: row.toNumber } });
      if (contact?.metadata?.optOut) {
        await row.update({ status: 'failed', error: 'Recipient has opted out', sentAt: new Date() });
        return res.status(403).json({ error: 'Recipient has opted out' });
      }

      try {
        await sendSms(row.fromNumber, row.toNumber, row.text);
        await row.update({ status: 'sent', sentAt: new Date() });
        res.json({ status: 'sent' });
      } catch (sendErr: any) {
        const msg = sendErr?.message || 'Send failed';
        await row.update({ status: 'failed', error: msg, sentAt: new Date() });
        return res.status(502).json({ error: msg });
      }
    } catch (err) { next(err); }
  });

  // DELETE /api/scheduled-sms/:id
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await models.ScheduledSms.findByPk((req.params as any).id);
      if (!row) return res.status(404).json({ error: 'Scheduled SMS not found' });
      if (row.status !== 'pending') return res.status(400).json({ error: 'Can only cancel pending messages' });
      await row.update({ status: 'cancelled' });
      res.json({ status: 'cancelled' });
    } catch (err) { next(err); }
  });

  return router;
}

/* ── Background reaper: fires every 30s ────────────────────────── */
let reaperTimer: ReturnType<typeof setInterval> | null = null;

export function initScheduledSmsReaper(models: any) {
  if (reaperTimer) return;
  reaperTimer = setInterval(() => runReaper(models), 30_000);
  logger.info('Scheduled SMS reaper started (30s interval)');
}

export function stopScheduledSmsReaper() {
  if (reaperTimer) {
    clearInterval(reaperTimer);
    reaperTimer = null;
    logger.info('Scheduled SMS reaper stopped');
  }
}

async function runReaper(models: any) {
  try {
    const due = await models.ScheduledSms.findAll({
      where: { status: 'pending', scheduledAt: { [Op.lte]: new Date() } },
      limit: 50,
    });
    for (const row of due) {
      const contact = await models.Contact.findOne({ where: { phoneNumber: row.toNumber } });
      if (contact?.metadata?.optOut) {
        await row.update({ status: 'failed', error: 'Recipient opted out', sentAt: new Date() });
        continue;
      }
      try {
        await sendSms(row.fromNumber, row.toNumber, row.text);
        await row.update({ status: 'sent', sentAt: new Date() });
        logger.info({ id: row.id, to: row.toNumber }, 'Scheduled SMS sent');
      } catch (err: any) {
        const msg = err?.message || 'Send failed';
        await row.update({ status: 'failed', error: msg, sentAt: new Date() });
        logger.warn({ id: row.id, err: msg }, 'Scheduled SMS failed');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Scheduled SMS reaper error');
  }
}
