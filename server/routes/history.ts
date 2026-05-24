import { Router, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import { fetchCallDetailRecords } from '../services/telnyx.js';

// Escape LIKE wildcard characters in user input to prevent unexpected pattern matching
function escapeLike(str: string) {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Convert a Telnyx call-control CDR object to a CallRecord-shaped patch.
 * Telnyx field names vary slightly across record types; we map defensively so a
 * missing/renamed field never blows up the whole sync.
 */
function cdrToRecord(cdr: any) {
  if (!cdr) return null;

  // Telnyx CDR id candidates
  const telnyxRecordId =
    cdr.id ||
    cdr.uuid ||
    cdr.call_session_id ||
    cdr.call_leg_id ||
    null;
  if (!telnyxRecordId) return null;

  // Endpoints — fall back across the various Telnyx name variants
  const from = cdr.from || cdr.cli || cdr.source || cdr.caller_id_number || null;
  const to   = cdr.to   || cdr.cld || cdr.destination || cdr.dialed_number || null;

  const direction: 'inbound' | 'outbound' =
    (cdr.direction === 'inbound' || cdr.direction === 'outbound')
      ? cdr.direction
      : (cdr.direction || '').toLowerCase() === 'incoming' ? 'inbound' : 'outbound';

  // Times
  const startedAt =
    cdr.start_time || cdr.started_at || cdr.created_at || cdr.answered_at || null;
  const endedAt   =
    cdr.end_time || cdr.ended_at || cdr.hangup_time || cdr.completed_at || null;

  // Duration in seconds
  let duration: number | null = null;
  if (typeof cdr.duration_sec === 'number')          duration = cdr.duration_sec;
  else if (typeof cdr.billed_duration_secs === 'number') duration = cdr.billed_duration_secs;
  else if (typeof cdr.duration === 'number')         duration = cdr.duration;
  else if (startedAt && endedAt) {
    const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    if (Number.isFinite(ms) && ms >= 0) duration = Math.round(ms / 1000);
  }

  // Status — derive from hangup cause / answered flag if not provided
  let status: string | null = null;
  if (cdr.status) {
    status = String(cdr.status).toLowerCase();
  } else if (cdr.hangup_cause) {
    const hc = String(cdr.hangup_cause).toLowerCase();
    if (hc.includes('normal') || hc.includes('answered')) status = 'answered';
    else if (hc.includes('no_answer') || hc.includes('timeout')) status = 'missed';
    else if (hc.includes('busy')) status = 'missed';
    else if (hc.includes('voicemail')) status = 'voicemail';
    else status = 'missed';
  } else if (duration && duration > 0) {
    status = 'answered';
  }

  // Recording — Telnyx CDRs may include recording_urls (array) or recording_url
  let recordingUrl: string | null = null;
  if (Array.isArray(cdr.recording_urls) && cdr.recording_urls.length) {
    recordingUrl = cdr.recording_urls[0];
  } else if (typeof cdr.recording_url === 'string') {
    recordingUrl = cdr.recording_url;
  }

  return {
    telnyxRecordId: String(telnyxRecordId),
    direction,
    from,
    to,
    status,
    duration,
    startedAt: startedAt ? new Date(startedAt) : null,
    endedAt:   endedAt   ? new Date(endedAt)   : null,
    recordingUrl,
    source: 'telnyx_cdr',
    lastSyncedAt: new Date(),
  };
}

export function createHistoryRouter(models: any) {
  const router = Router();

  // ── List call records ─────────────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, status, direction, queueName, from, to, dateFrom, dateTo, dispositionId, search, page = 1, limit = 25 } = (req.query as any);
      const where: any = {};

      if (agentId) where.agentId = agentId;
      if (status)  where.status  = status;
      if (direction) where.direction = direction;
      if (queueName) where.queueName = queueName;
      if (dispositionId) where.dispositionId = dispositionId;

      // Text search across from, to, and contact name
      if (search) {
        const escaped = escapeLike(search);
        where[Op.or] = [
          { from: { [Op.like]: `%${escaped}%` } },
          { to:   { [Op.like]: `%${escaped}%` } },
        ];
        // Also match contact name via include
      }
      if (!search && from) where.from = { [Op.like]: `%${escapeLike(from)}%` };
      if (!search && to)   where.to   = { [Op.like]: `%${escapeLike(to)}%` };
      if (dateFrom || dateTo) {
        where.startedAt = {};
        if (dateFrom) where.startedAt[Op.gte] = new Date(dateFrom);
        if (dateTo)   where.startedAt[Op.lte]  = new Date(dateTo);
      }

      const include: any[] = [
        { model: models.Disposition, as: 'disposition' },
        { model: models.Contact, as: 'contact' },
      ];
      if (models.Agent) {
        include.push({
          model: models.Agent,
          as: 'agent',
          required: false,
          include: models.User ? [{ model: models.User, as: 'user', attributes: ['id', 'displayName', 'username'] }] : [],
        });
      }

      const { rows, count } = await models.CallRecord.findAndCountAll({
        where,
        include,
        order: [['startedAt', 'DESC']],
        limit: Math.min(Number(limit), 100),
        offset: (Number(page) - 1) * Number(limit),
      });

      // Most-recent sync timestamp across all records (for UI display)
      const lastSyncedAtRow: any = await models.CallRecord.findOne({
        attributes: [[models.CallRecord.sequelize.fn('MAX', models.CallRecord.sequelize.col('lastSyncedAt')), 'lastSyncedAt']],
        raw: true,
      }).catch(() => null);

      res.json({
        records: rows,
        total: count,
        page: Number(page),
        pages: Math.ceil(count / Number(limit)),
        lastSyncedAt: lastSyncedAtRow?.lastSyncedAt ?? null,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Sync call records from Telnyx CDR API ────────────────────────────────
  // GET /api/history/sync?date_range=last_7_days&page_size=50
  router.get('/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date_range, created_at_gte, created_at_lt, direction, page_size } = req.query as Record<string, string | undefined>;

      // Default to last 7 days when nothing specified
      const dateRange = date_range || (created_at_gte ? undefined : 'last_7_days');

      const { data: cdrs, meta } = await fetchCallDetailRecords({
        dateRange,
        createdAtGte: created_at_gte,
        createdAtLt:  created_at_lt,
        direction:    (direction === 'inbound' || direction === 'outbound') ? direction : undefined,
        pageSize:     Math.min(Number(page_size) || 50, 50),
        sort:         '-created_at',
      });

      let upserted = 0;
      let skipped  = 0;
      const errors: any[] = [];
      const now = new Date();

      for (const cdr of cdrs) {
        try {
          const patch = cdrToRecord(cdr);
          if (!patch) { skipped++; continue; }

          // Find existing by telnyxRecordId
          const existing = await models.CallRecord.findOne({
            where: { telnyxRecordId: patch.telnyxRecordId },
          });

          if (existing) {
            // Don't clobber locally-set fields if Telnyx has them as null
            const updates: any = { lastSyncedAt: now };
            for (const [k, v] of Object.entries(patch)) {
              if (k === 'telnyxRecordId') continue;
              if (v === null || v === undefined) continue;
              // Keep webhook source-of-truth flag if previously webhook
              if (k === 'source' && existing.source === 'webhook') continue;
              updates[k] = v;
            }
            await existing.update(updates);
          } else {
            await models.CallRecord.create(patch);
          }
          upserted++;
        } catch (e: any) {
          errors.push({ id: cdr?.id, message: e?.message });
          logger.warn({ err: e, cdrId: cdr?.id }, 'Failed to upsert Telnyx CDR row');
        }
      }

      logger.info({ upserted, skipped, total: cdrs.length, errors: errors.length }, 'Telnyx CDR sync complete');

      res.json({
        ok: true,
        upserted,
        skipped,
        fetched: cdrs.length,
        errors,
        meta,
        syncedAt: now.toISOString(),
      });
    } catch (err: any) {
      logger.error({ err: err?.message, body: err?.body, status: err?.status }, 'Telnyx CDR sync failed');
      // Return JSON error so the UI can show a nice toast
      res.status(err?.status || 500).json({
        ok: false,
        error: err?.message || 'Telnyx sync failed',
        details: err?.body,
      });
    }
  });

  // ── Single call record with transcript + case notes ───────────────────────
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await models.CallRecord.findByPk((req.params as any).id, {
        include: [
          { model: models.Disposition, as: 'disposition' },
          { model: models.Contact, as: 'contact' },
          ...(models.Agent ? [{
            model: models.Agent,
            as: 'agent',
            required: false,
            include: models.User ? [{ model: models.User, as: 'user', attributes: ['id', 'displayName', 'username'] }] : [],
          }] : []),
          {
            model: models.Call,
            as: 'call',
            include: [
              { model: models.Transcript, as: 'transcript' },
              {
                model: models.CaseNote,
                as: 'caseNote',
                include: [{ model: models.Task, as: 'tasks' }],
              },
              { model: models.Disposition, as: 'disposition' },
              { model: models.Contact, as: 'contact' },
            ],
          },
        ],
      });

      if (!record) return res.status(404).json({ error: 'Call record not found' });

      // Flatten for easy consumption by the UI: hoist transcript + caseNote up
      const plain = record.toJSON();
      const call  = plain.call || {};
      const result = {
        ...plain,
        transcript: call.transcript ?? null,
        caseNote:   call.caseNote   ?? null,
        // Keep disposition/contact at top level (from CallRecord), fall back to Call's
        disposition: plain.disposition ?? call.disposition ?? null,
        contact:     plain.contact     ?? call.contact     ?? null,
        // Pass through the call's id so DispositionPicker can target it
        callId: plain.callId,
        // caseNotesStatus is on CallRecord itself — keep as-is
      };
      delete result.call; // avoid duplication

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
