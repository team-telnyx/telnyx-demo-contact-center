import { Router, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import logger from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/auth.js';

export function createRecordingsRouter(models: any) {
  const router = Router();

  // ── List recordings with pagination + filters ────────────────────────────
  // GET /api/recordings
  // Query params: page, limit, dateFrom, dateTo, agentId, queueName, direction,
  //               search, durationMin, durationMax
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 25,
        dateFrom,
        dateTo,
        agentId,
        queueName,
        direction,
        search,
        durationMin,
        durationMax,
      } = (req.query as any);

      // We query CallRecord (completed calls) that have a recordingUrl.
      // We join with Call to get agentId from the Call model when CallRecord.agentId is null,
      // and to access transcript / case notes.
      const callRecordWhere: any = {
        recordingUrl: { [Op.ne]: null },
      };

      if (direction) callRecordWhere.direction = direction;
      if (queueName) callRecordWhere.queueName = queueName;

      // ── IDOR: Agents can only see their own recordings ──────────────────
      if (req.user.role === 'agent') {
        const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
        if (myAgent) {
          callRecordWhere.agentId = myAgent.id;
        } else {
          // Agent has no Agent record — return empty
          return res.json({ recordings: [], pagination: { total: 0, page: 1, pages: 0, limit: 25 } });
        }
      } else if (agentId) {
        // Admin/supervisor can filter by any agentId
        callRecordWhere.agentId = agentId;
      }

      // Date range
      if (dateFrom || dateTo) {
        callRecordWhere.startedAt = {};
        if (dateFrom) callRecordWhere.startedAt[Op.gte] = new Date(dateFrom);
        if (dateTo)   callRecordWhere.startedAt[Op.lte] = new Date(dateTo);
      }

      // Search across from, to
      if (search) {
        callRecordWhere[Op.or] = [
          { from: { [Op.like]: `%${search}%` } },
          { to:   { [Op.like]: `%${search}%` } },
        ];
      }

      // Duration filters (in seconds)
      if (durationMin) {
        callRecordWhere.duration = callRecordWhere.duration || {};
        callRecordWhere.duration[Op.gte] = Number(durationMin);
      }
      if (durationMax) {
        callRecordWhere.duration = callRecordWhere.duration || {};
        callRecordWhere.duration[Op.lte] = Number(durationMax);
      }

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(Math.max(1, Number(limit)), 100);

      const { rows, count } = await models.CallRecord.findAndCountAll({
        where: callRecordWhere,
        include: [
          {
            model: models.Call,
            as: 'call',
            attributes: ['id', 'callControlId', 'agentId', 'recordingUrl', 'dispositionId', 'contactId', 'notes'],
            include: [
              {
                model: models.Agent,
                as: 'agent',
                attributes: ['id', 'extension'],
                include: [{ model: models.User, as: 'user', attributes: ['displayName'] }],
              },
              { model: models.Disposition, as: 'disposition', attributes: ['id', 'name', 'color'] },
              { model: models.Contact, as: 'contact', attributes: ['id', 'name', 'phoneNumber'] },
            ],
          },
          { model: models.Disposition, as: 'disposition', attributes: ['id', 'name', 'color'] },
          { model: models.Contact, as: 'contact', attributes: ['id', 'name', 'phoneNumber'] },
        ],
        order: [['startedAt', 'DESC']],
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
      });

      // Flatten for UI consumption
      const recordings = rows.map((r) => {
        const plain = r.toJSON();
        const call = plain.call || {};
        const agent = call.agent || null;
        return {
          id: plain.id,
          callControlId: call.callControlId || null,
          from: plain.from,
          to: plain.to,
          direction: plain.direction,
          duration: plain.duration,
          agentName: agent?.user?.displayName || agent?.extension || null,
          agentId: call.agentId || plain.agentId || null,
          queueName: plain.queueName,
          recordingUrl: plain.recordingUrl || call.recordingUrl || null,
          startedAt: plain.startedAt,
          endedAt: plain.endedAt,
          disposition: plain.disposition || call.disposition || null,
          contact: plain.contact || call.contact || null,
          notes: plain.notes || call.notes || null,
          caseNotesStatus: plain.caseNotesStatus,
        };
      });

      res.json({
        recordings,
        pagination: {
          total: count,
          page: pageNum,
          pages: Math.ceil(count / limitNum),
          limit: limitNum,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Telnyx direct API proxy ─────────────────────────────────────────────
  // GET /api/recordings/telnyx
  // Fetches recordings directly from Telnyx's /v2/recordings, useful when the
  // local DB is empty (e.g. fresh demo environments) but Telnyx still has
  // historical recordings under the API key.
  // Query params mirror Telnyx's: page[number], page[size],
  // filter[created_at][gte], filter[created_at][lte].
  // MUST be registered before `/:id` so Express doesn't treat "telnyx" as an id.
  router.get('/telnyx', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = process.env.TELNYX_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'TELNYX_API_KEY not configured on server' });
      }

      // Pass through all query params verbatim — Telnyx uses bracket notation
      // like `page[number]`, which Node's URL preserves if we feed the raw
      // query string back in.
      const incomingQuery = (req.originalUrl.split('?')[1] || '').trim();
      const url = incomingQuery
        ? `https://api.telnyx.com/v2/recordings?${incomingQuery}`
        : 'https://api.telnyx.com/v2/recordings';

      const telnyxRes = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      });

      const bodyText = await telnyxRes.text();
      let body: any = null;
      try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = { raw: bodyText }; }

      if (!telnyxRes.ok) {
        logger.error(
          { status: telnyxRes.status, url, body },
          'Telnyx /v2/recordings request failed',
        );
        return res.status(telnyxRes.status).json({
          error: 'Telnyx API request failed',
          status: telnyxRes.status,
          details: body,
        });
      }

      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  // ── Single recording detail ─────────────────────────────────────────────
  // GET /api/recordings/:id
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await models.CallRecord.findByPk((req.params as any).id, {
        include: [
          {
            model: models.Call,
            as: 'call',
            include: [
              {
                model: models.Agent,
                as: 'agent',
                attributes: ['id', 'extension'],
                include: [{ model: models.User, as: 'user', attributes: ['displayName'] }],
              },
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
          { model: models.Disposition, as: 'disposition' },
          { model: models.Contact, as: 'contact' },
        ],
      });

      if (!record) return res.status(404).json({ error: 'Recording not found' });
      if (!record.recordingUrl && !(record.call && record.call.recordingUrl)) {
        return res.status(404).json({ error: 'No recording available for this call' });
      }

      // ── IDOR: Agents can only view their own recordings ──────────────────
      if (req.user.role === 'agent') {
        const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
        const recordAgentId = record.call?.agentId || record.agentId;
        if (recordAgentId && myAgent && recordAgentId !== myAgent.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const plain = record.toJSON();
      const call = plain.call || {};
      const agent = call.agent || null;

      const result = {
        id: plain.id,
        callControlId: call.callControlId || null,
        callId: plain.callId || call.id,
        from: plain.from,
        to: plain.to,
        direction: plain.direction,
        duration: plain.duration,
        agentName: agent?.user?.displayName || agent?.extension || null,
        agentId: call.agentId || plain.agentId || null,
        queueName: plain.queueName,
        recordingUrl: plain.recordingUrl || call.recordingUrl || null,
        startedAt: plain.startedAt,
        endedAt: plain.endedAt,
        status: plain.status,
        disposition: plain.disposition || call.disposition || null,
        contact: plain.contact || call.contact || null,
        notes: plain.notes || call.notes || null,
        caseNotesStatus: plain.caseNotesStatus,
        transcript: call.transcript ?? null,
        caseNote: call.caseNote ?? null,
      };

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── Soft-delete a recording (remove the URL) ────────────────────────────
  // DELETE /api/recordings/:id — admin/supervisor only
  router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await models.CallRecord.findByPk((req.params as any).id);
      if (!record) return res.status(404).json({ error: 'Recording not found' });

      // Soft-delete: clear the recordingUrl so it no longer appears in listings
      await record.update({ recordingUrl: null });

      // Also clear on the Call model if present
      if (record.callId) {
        const call = await models.Call.findByPk(record.callId);
        if (call && call.recordingUrl) {
          await call.update({ recordingUrl: null });
        }
      }

      logger.info({ callRecordId: record.id }, 'Recording soft-deleted (URL removed)');

      res.json({ success: true, id: record.id });
    } catch (err) {
      next(err);
    }
  });

  // ── Proxy download from Telnyx recording URL ─────────────────────────────
  // GET /api/recordings/:id/download
  // Streams the recording from Telnyx so we don't expose the Telnyx URL directly.
  router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await models.CallRecord.findByPk((req.params as any).id);
      if (!record) return res.status(404).json({ error: 'Recording not found' });

      let recordingUrl = record.recordingUrl;
      if (!recordingUrl && record.callId) {
        const call = await models.Call.findByPk(record.callId);
        recordingUrl = call?.recordingUrl || null;
      }

      if (!recordingUrl) {
        return res.status(404).json({ error: 'No recording URL available' });
      }

      // ── IDOR: Agents can only download their own recordings ──────────────
      if (req.user.role === 'agent') {
        const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
        const recordAgentId = record.call?.agentId || record.agentId;
        if (recordAgentId && myAgent && recordAgentId !== myAgent.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      // Fetch the recording from Telnyx and pipe it to the client
      const telnyxRes = await fetch(recordingUrl);

      if (!telnyxRes.ok) {
        logger.error({ status: telnyxRes.status, url: recordingUrl }, 'Failed to fetch recording from Telnyx');
        return res.status(502).json({ error: 'Failed to fetch recording from storage' });
      }

      // Forward content type and length
      const contentType = telnyxRes.headers.get('content-type') || 'audio/mpeg';
      const contentLength = telnyxRes.headers.get('content-length');

      res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      res.setHeader('Content-Disposition', `inline; filename="recording-${record.id}.mp3"`);

      // Node 18+ fetch returns a Web ReadableStream — convert to Node stream for piping
      const { Readable } = await import('node:stream');
      Readable.fromWeb(telnyxRes.body as any).pipe(res);
    } catch (err) {
      next(err);
    }
  });

  // ── Bulk delete recordings ──────────────────────────────────────────────
  // POST /api/recordings/bulk-delete — admin/supervisor only
  router.post('/bulk-delete', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }

      const records = await models.CallRecord.findAll({
        where: { id: { [Op.in]: ids } },
      });

      let deleted = 0;
      for (const record of records) {
        await record.update({ recordingUrl: null });
        if (record.callId) {
          const call = await models.Call.findByPk(record.callId);
          if (call?.recordingUrl) await call.update({ recordingUrl: null });
        }
        deleted++;
      }

      logger.info({ count: deleted, ids }, 'Bulk recording delete');

      res.json({ success: true, deleted });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
