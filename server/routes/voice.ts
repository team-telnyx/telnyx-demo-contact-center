import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import * as telnyxService from '../services/telnyx.js';
import * as acdService from '../services/acd.js';
import {
  emitCallRinging,
  emitCallEnded,
  emitAgentStatusUpdate,
  emitMonitorStarted,
  emitBargeStarted,
} from '../services/socket.js';
import { requireRole } from '../middleware/auth.js';

export function createVoiceRouter(models: any) {
  const router = Router();

  // ── Outbound call ──────────────────────────────────────────────────────
  router.post('/outbound', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        to: z.string().min(1),
        from: z.string().optional(),
        agentId: z.string().uuid().optional(),
      });
      const { to, from, agentId } = schema.parse(req.body);

      const env = (await import('../config/env.js')).loadEnv();
      const callerId = from || env.TELNYX_SIP_USERNAME;

      logger.info({ to, from: callerId, agentId }, 'Outbound call requested');

      const callResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_APP_CONNECTION_ID,
        to,
        from: callerId,
      });

      const callControlId = callResource.call_control_id;

      // Create DB record
      const call = await models.Call.create({
        callControlId,
        callSessionId: callResource.call_session_id,
        direction: 'outbound',
        from: callerId,
        to,
        status: 'ringing',
        startedAt: new Date(),
        agentId: agentId || null,
      });

      emitCallRinging({ callId: call.id, callControlId, from: callerId, to, direction: 'outbound', agentId: call.agentId });

      res.status(201).json({
        callId: call.id,
        callControlId,
        status: 'ringing',
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Cold transfer (blind) ──────────────────────────────────────────────
  router.post('/transfer/cold', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        target: z.string().min(1),  // phone number or SIP URI
      });
      const { callControlId, target } = schema.parse(req.body);

      logger.info({ callControlId, target }, 'Cold transfer requested');

      // Update call status
      const call = await models.Call.findOne({ where: { callControlId } });
      if (!call) return res.status(404).json({ error: 'Call not found' });

      await call.update({ status: 'transferring' });

      await telnyxService.transferCall(callControlId, target);

      await call.update({ status: 'ended', endedAt: new Date() });

      // Release agent
      if (call.agentId) {
        await acdService.releaseAgent(call.agentId, models);
      }

      res.json({ success: true, callControlId, target });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Warm transfer (3-way) ─────────────────────────────────────────────
  router.post('/transfer/warm', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        target: z.string().min(1),  // phone number or SIP URI
        agentId: z.string().uuid().optional(),  // target agent (if internal)
      });
      const { callControlId, target, agentId } = schema.parse(req.body);

      logger.info({ callControlId, target, agentId }, 'Warm transfer requested');

      const originalCall = await models.Call.findOne({ where: { callControlId } });
      if (!originalCall) return res.status(404).json({ error: 'Original call not found' });

      const env = (await import('../config/env.js')).loadEnv();

      // Step 1: Dial the target agent
      const newCallResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_APP_CONNECTION_ID,
        to: target,
        from: originalCall.from || env.TELNYX_SIP_USERNAME,
      });

      const newCallControlId = newCallResource.call_control_id;

      // Create DB record for the transfer leg
      const transferCall = await models.Call.create({
        callControlId: newCallControlId,
        callSessionId: newCallResource.call_session_id,
        direction: 'outbound',
        from: originalCall.from,
        to: target,
        status: 'ringing',
        startedAt: new Date(),
        parentCallId: originalCall.id,
        callPurpose: 'transfer',
        agentId: agentId || null,
      });

      await originalCall.update({ status: 'transferring' });

      res.json({
        success: true,
        originalCallControlId: callControlId,
        transferCallControlId: newCallControlId,
        transferCallId: transferCall.id,
        status: 'ringing_target',
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Complete warm transfer (bridge then drop original agent) ───────────
  router.post('/transfer/warm/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        targetCallControlId: z.string().min(1),
      });
      const { callControlId, targetCallControlId } = schema.parse(req.body);

      logger.info({ callControlId, targetCallControlId }, 'Completing warm transfer (bridge)');

      await telnyxService.bridgeCall(callControlId, targetCallControlId);

      const call = await models.Call.findOne({ where: { callControlId } });
      if (call) await call.update({ status: 'active' });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Supervisor whisper — admin/supervisor only ────────────────────────
  router.post('/whisper', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        supervisorSipUsername: z.string().min(1),
        message: z.string().optional(),  // TTS message to whisper
      });
      const { callControlId, supervisorSipUsername, message } = schema.parse(req.body);

      logger.info({ callControlId, supervisorSipUsername }, 'Supervisor whisper requested');

      const originalCall = await models.Call.findOne({ where: { callControlId } });
      if (!originalCall) return res.status(404).json({ error: 'Call not found' });

      const env = (await import('../config/env.js')).loadEnv();

      // Find the supervisor agent
      const supervisorAgent = await models.Agent.findOne({
        where: { sipUsername: supervisorSipUsername },
        include: [{ model: models.User, as: 'user' }],
      });

      if (!supervisorAgent) return res.status(404).json({ error: 'Supervisor agent not found' });

      // Dial the supervisor
      const whisperCallResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_SIP_CONNECTION_ID,
        to: `sip:${supervisorSipUsername}@sip.telnyx.com`,
        from: originalCall.to || env.TELNYX_SIP_USERNAME,
      });

      const whisperCallControlId = whisperCallResource.call_control_id;

      // Create DB record for the whisper leg
      await models.Call.create({
        callControlId: whisperCallControlId,
        callSessionId: whisperCallResource.call_session_id,
        direction: 'outbound',
        from: originalCall.to,
        to: supervisorSipUsername,
        status: 'ringing',
        startedAt: new Date(),
        parentCallId: originalCall.id,
        callPurpose: 'whisper',
        agentId: supervisorAgent.id,
      });

      // If a message is provided, speak it on the whisper call once answered
      // (handled in webhook handler for call.answered when callPurpose === 'whisper')

      res.json({
        success: true,
        whisperCallControlId,
        supervisorAgentId: supervisorAgent.id,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Silent monitor (supervisor listens, no audio out) — admin/supervisor only
  //
  // Supervisor's SIP endpoint is dialled and bridged to the live call. The
  // monitor leg record carries callPurpose='monitor' so the wallboard/UI can
  // show a "being monitored" indicator and so we can filter it out of
  // standard call history. Actual one-way audio is enforced by the
  // supervisor's SIP profile being configured send-only on Telnyx.
  router.post('/monitor', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        supervisorSipUsername: z.string().min(1),
      });
      const { callControlId, supervisorSipUsername } = schema.parse(req.body);

      // Inline authz removed — handled by requireRole middleware above

      const originalCall = await models.Call.findOne({ where: { callControlId } });
      if (!originalCall) return res.status(404).json({ error: 'Call not found' });

      const env = (await import('../config/env.js')).loadEnv();

      const supervisorAgent = await models.Agent.findOne({
        where: { sipUsername: supervisorSipUsername },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!supervisorAgent) return res.status(404).json({ error: 'Supervisor agent not found' });

      logger.info({ callControlId, supervisorSipUsername }, 'Silent monitor requested');

      // Dial the supervisor
      const monitorCallResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_SIP_CONNECTION_ID,
        to: `sip:${supervisorSipUsername}@sip.telnyx.com`,
        from: originalCall.to || env.TELNYX_SIP_USERNAME,
      });
      const monitorCallControlId = monitorCallResource.call_control_id;

      const monitorLeg = await models.Call.create({
        callControlId: monitorCallControlId,
        callSessionId: monitorCallResource.call_session_id,
        direction: 'outbound',
        from: originalCall.to,
        to: supervisorSipUsername,
        status: 'ringing',
        startedAt: new Date(),
        parentCallId: originalCall.id,
        callPurpose: 'monitor',
        agentId: supervisorAgent.id,
      });

      emitMonitorStarted(callControlId, supervisorAgent.id);

      res.json({
        success: true,
        monitorCallControlId,
        monitorCallId: monitorLeg.id,
        supervisorAgentId: supervisorAgent.id,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Barge (supervisor joins with full duplex audio) — admin/supervisor only
  //
  // Mechanically near-identical to monitor on the Call Control side — the
  // distinction is callPurpose + the SIP profile audio direction (this leg
  // is full-duplex). We tag the leg 'barge' so the agent and the wallboard
  // can show that the supervisor is now audible to both parties.
  router.post('/barge', requireRole('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        supervisorSipUsername: z.string().min(1),
      });
      const { callControlId, supervisorSipUsername } = schema.parse(req.body);

      // Inline authz removed — handled by requireRole middleware above

      const originalCall = await models.Call.findOne({ where: { callControlId } });
      if (!originalCall) return res.status(404).json({ error: 'Call not found' });

      const env = (await import('../config/env.js')).loadEnv();

      const supervisorAgent = await models.Agent.findOne({
        where: { sipUsername: supervisorSipUsername },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!supervisorAgent) return res.status(404).json({ error: 'Supervisor agent not found' });

      logger.info({ callControlId, supervisorSipUsername }, 'Barge requested');

      const bargeCallResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_SIP_CONNECTION_ID,
        to: `sip:${supervisorSipUsername}@sip.telnyx.com`,
        from: originalCall.to || env.TELNYX_SIP_USERNAME,
      });
      const bargeCallControlId = bargeCallResource.call_control_id;

      const bargeLeg = await models.Call.create({
        callControlId: bargeCallControlId,
        callSessionId: bargeCallResource.call_session_id,
        direction: 'outbound',
        from: originalCall.to,
        to: supervisorSipUsername,
        status: 'ringing',
        startedAt: new Date(),
        parentCallId: originalCall.id,
        callPurpose: 'barge',
        agentId: supervisorAgent.id,
      });

      emitBargeStarted(callControlId, supervisorAgent.id);

      res.json({
        success: true,
        bargeCallControlId,
        bargeCallId: bargeLeg.id,
        supervisorAgentId: supervisorAgent.id,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Hold / Unhold (using music-on-hold playback) ──────────────────────
  // Telnyx Call Control has no native hold() — we use startMusicOnHold
  // (looping playback_start) on the caller leg to simulate hold.
  router.post('/hold', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        musicUrl: z.string().url().optional(),
      });
      const { callControlId, musicUrl } = schema.parse(req.body);

      await telnyxService.startMusicOnHold(callControlId, musicUrl);

      const call = await models.Call.findOne({ where: { callControlId } });
      if (call) await call.update({ status: 'on_hold' });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  router.post('/unhold', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({ callControlId: z.string().min(1) });
      const { callControlId } = schema.parse(req.body);

      await telnyxService.stopMusicOnHold(callControlId);

      const call = await models.Call.findOne({ where: { callControlId } });
      if (call) await call.update({ status: 'active' });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Log a WebRTC-originated call ──────────────────────────────────────
  router.post('/log-call', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        direction: z.enum(['inbound', 'outbound']),
        from: z.string().optional(),
        to: z.string().optional(),
        duration: z.number().optional(),
        startedAt: z.string().optional(),
        endedAt: z.string().optional(),
        status: z.string().optional(),
        queueName: z.string().optional(),
        agentId: z.string().uuid().optional(),
      });
      const { direction, from, to, duration, startedAt, endedAt, status, queueName, agentId } = schema.parse(req.body);

      // Generate a synthetic callControlId for WebRTC calls so they don't collide
      // with Telnyx Call Control IDs
      const callControlId = `webrtc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const call = await models.Call.create({
        callControlId,
        direction,
        from: from || 'Unknown',
        to: to || 'Unknown',
        status: status || 'ended',
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: endedAt ? new Date(endedAt) : (status === 'ended' ? new Date() : null),
        agentId: agentId || null,
        queueName: queueName || null,
      });

      const callRecord = await models.CallRecord.create({
        callId: call.id,
        agentId: call.agentId,
        direction: call.direction,
        from: call.from,
        to: call.to,
        status: status || 'ended',
        queueName: call.queueName,
        duration: duration || 0,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        caseNotesStatus: 'pending',
      });

      logger.info({ callId: call.id, direction, from, to, duration }, 'WebRTC call logged');

      res.status(201).json({
        callId: call.id,
        callRecordId: callRecord.id,
        callControlId,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── SIP config (for WebRTC client) ────────────────────────────────────
  // For the demo we return the shared Telnyx SIP credential connection so
  // every agent's softphone can register and receive routed calls.
  // SECURITY: never return the master Telnyx API key here. The softphone
  // only needs SIP register creds; backend operations use the API key.
  router.get('/sip-config', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const env = (await import('../config/env.js')).loadEnv();
      const role = req.user?.role;
      const isPriv = role === 'admin' || role === 'supervisor';

      // Agents need the SIP password to register the softphone, so we still
      // return it — but ONLY to authenticated users on this same backend.
      // Non-priv users get a metadata-only response (used by the Profile page
      // to render the SIP block with a masked password).
      // SECURITY: never return the master Telnyx API key here.
      if (isPriv) {
        return res.json({
          sipUsername: env.TELNYX_SIP_USERNAME,
          sipPassword: env.TELNYX_SIP_PASSWORD,
          sipConnectionId: env.TELNYX_SIP_CONNECTION_ID,
          appConnectionId: env.TELNYX_APP_CONNECTION_ID,
        });
      }

      // Agents: return creds needed for softphone register, omit the
      // appConnectionId (used for backend ops) for principle of least privilege.
      res.json({
        sipUsername: env.TELNYX_SIP_USERNAME,
        sipPassword: env.TELNYX_SIP_PASSWORD,
        sipConnectionId: env.TELNYX_SIP_CONNECTION_ID,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Recording controls ─────────────────────────────────────────────────
  router.post('/record/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        format: z.enum(['mp3', 'wav']).optional(),
        channels: z.enum(['single', 'dual']).optional(),
      });
      const { callControlId, format, channels } = schema.parse(req.body);
      await telnyxService.startRecording(callControlId, { format: format || 'mp3', channels: channels || 'dual' });
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  router.post('/record/stop', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callControlId } = z.object({ callControlId: z.string().min(1) }).parse(req.body);
      await telnyxService.stopRecording(callControlId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  router.post('/record/pause', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callControlId } = z.object({ callControlId: z.string().min(1) }).parse(req.body);
      await telnyxService.pauseRecording(callControlId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  router.post('/record/resume', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callControlId } = z.object({ callControlId: z.string().min(1) }).parse(req.body);
      await telnyxService.resumeRecording(callControlId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── AMD (Answering Machine Detection) ──────────────────────────────────
  router.post('/amd/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),
        type: z.enum(['detect', 'detect_words', 'greeting_end']).optional(),
      });
      const { callControlId, type } = schema.parse(req.body);
      await telnyxService.enableAmd(callControlId, { type });
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Noise Suppression ──────────────────────────────────────────────────
  router.post('/noise-suppression/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callControlId } = z.object({ callControlId: z.string().min(1) }).parse(req.body);
      await telnyxService.enableNoiseSuppression(callControlId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  router.post('/noise-suppression/stop', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callControlId } = z.object({ callControlId: z.string().min(1) }).parse(req.body);
      await telnyxService.disableNoiseSuppression(callControlId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Callbacks ──────────────────────────────────────────────────────────
  router.get('/callbacks', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { Op } = await import('sequelize');
      const { status } = (req.query as any);
      const where = status ? { status } : { status: { [Op.ne]: 'cancelled' } };
      const callbacks = await models.Callback.findAll({
        where,
        order: [['requestedAt', 'ASC']],
        include: [{ model: models.Agent, as: 'agent', attributes: ['id', 'sipUsername'], required: false }],
      });
      res.json(callbacks);
    } catch (err) { next(err); }
  });

  router.post('/callbacks/:id/dial', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cb = await models.Callback.findByPk((req.params as any).id);
      if (!cb) return res.status(404).json({ error: 'Callback not found' });
      if (cb.status !== 'pending') return res.status(400).json({ error: `Callback is ${cb.status}, not pending` });
      if (cb.attempts >= cb.maxAttempts) return res.status(400).json({ error: 'Max attempts reached' });

      const env = (await import('../config/env.js')).loadEnv();
      await cb.update({ status: 'calling', attempts: cb.attempts + 1, lastAttemptAt: new Date() });

      const callResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_APP_CONNECTION_ID,
        to: cb.phoneNumber,
        from: env.TELNYX_FROM_NUMBER || env.TELNYX_SIP_USERNAME,
      });

      const call = await models.Call.create({
        callControlId: callResource.call_control_id,
        callSessionId: callResource.call_session_id,
        direction: 'outbound',
        from: env.TELNYX_FROM_NUMBER || env.TELNYX_SIP_USERNAME,
        to: cb.phoneNumber,
        status: 'ringing',
        startedAt: new Date(),
        agentId: req.body.agentId || null,
      });

      res.json({ success: true, callId: call.id, callbackId: cb.id, callControlId: callResource.call_control_id });
    } catch (err) { next(err); }
  });

  router.patch('/callbacks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cb = await models.Callback.findByPk((req.params as any).id);
      if (!cb) return res.status(404).json({ error: 'Callback not found' });
      const allowed = ['status', 'notes', 'scheduledFor', 'agentId'];
      const updates: any = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (updates.status === 'completed') updates.completedAt = new Date();
      await cb.update(updates);
      res.json(cb);
    } catch (err) { next(err); }
  });

  return router;
}
