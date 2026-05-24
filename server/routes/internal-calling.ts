import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import * as telnyxService from '../services/telnyx.js';
import {
  getIO,
  emitAgentStatusUpdate,
} from '../services/socket.js';

// ── Warm transfer timeout tracking ───────────────────────────────────
const warmTransferTimeouts = new Map(); // callId → NodeJS.Timeout
const WARM_TRANSFER_TIMEOUT_MS = 60_000; // 60 seconds

/**
 * Clear a warm-transfer timeout if one exists for the given call ID.
 * Returns true if a timeout was cleared, false otherwise.
 */
function clearWarmTransferTimeout(callId) {
  const timeout = warmTransferTimeouts.get(callId);
  if (timeout) {
    clearTimeout(timeout);
    warmTransferTimeouts.delete(callId);
    return true;
  }
  return false;
}

/**
 * Internal calling + warm transfer routes.
 *
 * Features:
 *  - Agent-to-agent SIP calls (extension dialing)
 *  - Internal directory (who's available + click-to-call)
 *  - Warm transfer: hold customer → consult target → bridge/complete or cancel
 */
export function createInternalCallingRouter(models: any) {
  const router = Router();

  // ── Helpers ──────────────────────────────────────────────────────────

  function emitToAgent(agentId, event, payload) {
    try { getIO().to(`agent:${agentId}`).emit(event, payload); } catch { /* */ }
  }

  // ── Dial by extension ────────────────────────────────────────────────
  router.post('/dial-extension', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        extension: z.string().min(1),
      });
      const { extension } = schema.parse(req.body || {});

      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const targetAgent = await models.Agent.findOne({
        where: { extension },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!targetAgent) return res.status(404).json({ error: `No agent with extension ${extension}` });
      if (targetAgent.id === myAgent.id) return res.status(400).json({ error: 'Cannot call yourself' });
      if (targetAgent.presence === 'offline' || targetAgent.status === 'offline') {
        return res.status(400).json({ error: 'Target agent is offline' });
      }

      const env = (await import('../config/env.js')).loadEnv();

      // Dial the target agent via SIP
      const sipTarget = targetAgent.sipUsername
        ? `sip:${targetAgent.sipUsername}@sip.telnyx.com`
        : extension;

      const callResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_SIP_CONNECTION_ID || env.TELNYX_APP_CONNECTION_ID,
        to: sipTarget,
        from: myAgent.sipUsername || env.TELNYX_SIP_USERNAME,
      });

      const callControlId = callResource.call_control_id;

      // Create internal call record
      const call = await models.Call.create({
        callControlId,
        callSessionId: callResource.call_session_id,
        direction: 'outbound',
        from: myAgent.sipUsername || myAgent.user?.displayName || 'Agent',
        to: targetAgent.sipUsername || extension,
        status: 'ringing',
        startedAt: new Date(),
        agentId: myAgent.id,
        callPurpose: 'primary',
        isInternal: true,
        callerName: myAgent.user?.displayName || myAgent.user?.username,
      });

      // Notify target agent
      emitToAgent(targetAgent.id, 'internal:call:ringing', {
        callId: call.id,
        callControlId,
        fromAgentId: myAgent.id,
        fromAgentName: myAgent.user?.displayName || myAgent.user?.username,
        extension: myAgent.extension,
        isInternal: true,
      });

      res.status(201).json({
        callId: call.id,
        callControlId,
        targetAgentId: targetAgent.id,
        targetAgentName: targetAgent.user?.displayName || targetAgent.user?.username,
        status: 'ringing',
        isInternal: true,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Dial agent by ID ────────────────────────────────────────────────
  router.post('/dial-agent', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        targetAgentId: z.string().uuid(),
      });
      const { targetAgentId } = schema.parse(req.body || {});

      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const targetAgent = await models.Agent.findByPk(targetAgentId, {
        include: [{ model: models.User, as: 'user' }],
      });
      if (!targetAgent) return res.status(404).json({ error: 'Target agent not found' });
      if (targetAgent.id === myAgent.id) return res.status(400).json({ error: 'Cannot call yourself' });

      const env = (await import('../config/env.js')).loadEnv();

      const sipTarget = targetAgent.sipUsername
        ? `sip:${targetAgent.sipUsername}@sip.telnyx.com`
        : targetAgent.extension || targetAgent.user?.username;

      const callResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_SIP_CONNECTION_ID || env.TELNYX_APP_CONNECTION_ID,
        to: sipTarget,
        from: myAgent.sipUsername || env.TELNYX_SIP_USERNAME,
      });

      const callControlId = callResource.call_control_id;

      const call = await models.Call.create({
        callControlId,
        callSessionId: callResource.call_session_id,
        direction: 'outbound',
        from: myAgent.sipUsername || myAgent.user?.displayName || 'Agent',
        to: targetAgent.sipUsername || targetAgent.extension || 'Agent',
        status: 'ringing',
        startedAt: new Date(),
        agentId: myAgent.id,
        callPurpose: 'primary',
        isInternal: true,
        callerName: myAgent.user?.displayName || myAgent.user?.username,
      });

      emitToAgent(targetAgent.id, 'internal:call:ringing', {
        callId: call.id,
        callControlId,
        fromAgentId: myAgent.id,
        fromAgentName: myAgent.user?.displayName || myAgent.user?.username,
        extension: myAgent.extension,
        isInternal: true,
      });

      res.status(201).json({
        callId: call.id,
        callControlId,
        targetAgentId: targetAgent.id,
        targetAgentName: targetAgent.user?.displayName || targetAgent.user?.username,
        status: 'ringing',
        isInternal: true,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Warm Transfer: Initiate ──────────────────────────────────────────
  // Agent puts customer on hold, then calls target agent for consultation.
  router.post('/warm-transfer/initiate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        callControlId: z.string().min(1),  // customer's call leg
        targetAgentId: z.string().uuid(),  // agent to transfer to
        note: z.string().max(500).optional(),  // brief for target agent
      });
      const { callControlId, targetAgentId, note } = schema.parse(req.body || {});

      const myAgent = await models.Agent.findOne({
        where: { userId: req.user.id },
        include: [{ model: models.User, as: 'user' }],
      });
      if (!myAgent) return res.status(403).json({ error: 'No agent profile' });

      const customerCall = await models.Call.findOne({ where: { callControlId } });
      if (!customerCall) return res.status(404).json({ error: 'Customer call not found' });
      if (customerCall.agentId !== myAgent.id) {
        return res.status(403).json({ error: 'Not your call to transfer' });
      }

      const targetAgent = await models.Agent.findByPk(targetAgentId, {
        include: [{ model: models.User, as: 'user' }],
      });
      if (!targetAgent) return res.status(404).json({ error: 'Target agent not found' });

      // Step 1: Put customer on hold (music-on-hold)
      await telnyxService.startMusicOnHold(callControlId);
      await customerCall.update({ status: 'on_hold', transferType: 'warm', transferredToAgentId: targetAgentId });

      // Step 2: Dial the target agent (consultation call)
      const env = (await import('../config/env.js')).loadEnv();
      const sipTarget = targetAgent.sipUsername
        ? `sip:${targetAgent.sipUsername}@sip.telnyx.com`
        : targetAgent.extension || 'agent';

      const consultationResource = await telnyxService.dialCall({
        connectionId: env.TELNYX_SIP_CONNECTION_ID || env.TELNYX_APP_CONNECTION_ID,
        to: sipTarget,
        from: myAgent.sipUsername || env.TELNYX_SIP_USERNAME,
      });

      const consultationCallControlId = consultationResource.call_control_id;

      // Create consultation call record
      const consultationCall = await models.Call.create({
        callControlId: consultationCallControlId,
        callSessionId: consultationResource.call_session_id,
        direction: 'outbound',
        from: myAgent.sipUsername || myAgent.user?.displayName,
        to: targetAgent.sipUsername || targetAgent.extension,
        status: 'ringing',
        startedAt: new Date(),
        parentCallId: customerCall.id,
        callPurpose: 'transfer',
        agentId: myAgent.id,
        isInternal: true,
        callerName: `Warm Transfer: ${myAgent.user?.displayName || 'Agent'}`,
        notes: note || null,
        transferType: 'warm',
        transferredToAgentId: targetAgentId,
      });

      // Notify target agent about incoming consultation
      emitToAgent(targetAgentId, 'internal:call:ringing', {
        callId: consultationCall.id,
        callControlId: consultationCallControlId,
        fromAgentId: myAgent.id,
        fromAgentName: myAgent.user?.displayName || myAgent.user?.username,
        isInternal: true,
        isConsultation: true,
        customerCallId: customerCall.id,
        note,
      });

      // Notify original agent that consultation is ringing
      emitToAgent(myAgent.id, 'warm-transfer:consultation-ringing', {
        customerCallControlId: callControlId,
        consultationCallControlId,
        targetAgentId,
        targetAgentName: targetAgent.user?.displayName || targetAgent.user?.username,
      });

      // ── Warm transfer timeout: auto-cancel if target doesn't answer ───
      const timeoutRef = setTimeout(async () => {
        logger.info({ customerCallId: customerCall.id }, 'Warm transfer timed out — auto-cancelling');
        try {
          // Hang up the consultation leg
          await telnyxService.hangupCall(consultationCallControlId);
          // Take customer off hold
          await telnyxService.stopMusicOnHold(callControlId);
          // Update customer call
          await customerCall.update({
            status: 'active',
            transferType: null,
            transferredToAgentId: null,
          });
          // Update consultation call
          await consultationCall.update({ status: 'ended', endedAt: new Date() });
          // Emit cancellation event
          emitToAgent(myAgent.id, 'warm-transfer:cancelled', {
            customerCallControlId: callControlId,
            consultationCallControlId,
            reason: 'timeout',
          });
          if (targetAgentId) {
            emitToAgent(targetAgentId, 'warm-transfer:cancelled', {
              consultationCallControlId,
              reason: 'timeout',
            });
          }
        } catch (err) {
          logger.error({ err, customerCallId: customerCall.id }, 'Error during warm transfer timeout cleanup');
        }
        warmTransferTimeouts.delete(customerCall.id);
      }, WARM_TRANSFER_TIMEOUT_MS);

      warmTransferTimeouts.set(customerCall.id, timeoutRef);

      res.json({
        success: true,
        customerCallControlId: callControlId,
        consultationCallControlId,
        consultationCallId: consultationCall.id,
        targetAgentId,
        status: 'consultation_ringing',
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Warm Transfer: Complete ──────────────────────────────────────────
  // Bridge customer and target, then drop original agent.
  router.post('/warm-transfer/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        customerCallControlId: z.string().min(1),
        consultationCallControlId: z.string().min(1),
      });
      const { customerCallControlId, consultationCallControlId } = schema.parse(req.body || {});

      logger.info({ customerCallControlId, consultationCallControlId }, 'Completing warm transfer');

      // Clear any pending timeout and fetch customer call
      const customerCall = await models.Call.findOne({ where: { callControlId: customerCallControlId } });
      if (customerCall) {
        clearWarmTransferTimeout(customerCall.id);
      }

      // Stop hold music on customer leg
      await telnyxService.stopMusicOnHold(customerCallControlId);

      // Bridge customer and consultation (target agent) legs
      await telnyxService.bridgeCall(customerCallControlId, consultationCallControlId);

      // Update customer call — reassign to target agent
      if (customerCall) {
        const targetAgentId = customerCall.transferredToAgentId;
        await customerCall.update({
          status: 'active',
          agentId: targetAgentId || customerCall.agentId,
        });

        // Update target agent's status
        if (targetAgentId) {
          await models.Agent.update(
            { status: 'busy', activeCallId: customerCall.id },
            { where: { id: targetAgentId } }
          );
        }
      }

      // Update consultation call
      const consultationCall = await models.Call.findOne({ where: { callControlId: consultationCallControlId } });
      if (consultationCall) {
        await consultationCall.update({ status: 'active' });
      }

      // Release original agent from call
      const myAgent = await models.Agent.findOne({ where: { userId: req.user.id } });
      if (myAgent) {
        await myAgent.update({ activeCallId: null });
        // Don't force status change — let wrap-up handle it if configured
      }

      // Notify both agents
      const targetAgentId = customerCall?.transferredToAgentId;
      if (targetAgentId) {
        emitToAgent(targetAgentId, 'warm-transfer:completed', {
          customerCallControlId,
          consultationCallControlId,
        });
      }
      emitToAgent(myAgent?.id, 'warm-transfer:completed', {
        customerCallControlId,
        consultationCallControlId,
      });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  // ── Warm Transfer: Cancel ────────────────────────────────────────────
  // Cancel the consultation, take customer off hold.
  router.post('/warm-transfer/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        customerCallControlId: z.string().min(1),
        consultationCallControlId: z.string().min(1),
      });
      const { customerCallControlId, consultationCallControlId } = schema.parse(req.body || {});

      logger.info({ customerCallControlId, consultationCallControlId }, 'Cancelling warm transfer');

      // Clear any pending timeout
      const customerCall = await models.Call.findOne({ where: { callControlId: customerCallControlId } });
      if (customerCall) {
        clearWarmTransferTimeout(customerCall.id);
      }

      // Hang up the consultation call
      await telnyxService.hangupCall(consultationCallControlId);

      // Take customer off hold
      await telnyxService.stopMusicOnHold(customerCallControlId);

      // Update customer call
      if (customerCall) {
        await customerCall.update({
          status: 'active',
          transferType: null,
          transferredToAgentId: null,
        });
      }

      // Update consultation call
      const consultationCall = await models.Call.findOne({ where: { callControlId: consultationCallControlId } });
      if (consultationCall) {
        await consultationCall.update({ status: 'ended', endedAt: new Date() });
      }

      // Notify target agent
      if (consultationCall?.transferredToAgentId) {
        emitToAgent(consultationCall.transferredToAgentId, 'warm-transfer:cancelled', {
          consultationCallControlId,
        });
      }

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  return router;
}
