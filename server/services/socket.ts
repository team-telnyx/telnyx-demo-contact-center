import logger from '../middleware/errorHandler.js';
import jwt from 'jsonwebtoken';
import bus from './event-bus.js';

let io: any;
let _models: any = null;

export async function initSocketIO(httpServer: any) {
  const { Server } = await import('socket.io');
  const corsAllowed = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const corsOrigin: any = corsAllowed.includes('*')
    ? true
    : corsAllowed.length > 0
      ? corsAllowed
      : process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : false;

  io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use((socket: any, next: any) => {
    const token = socket.handshake.auth?.token;
    const isVisitor = !!socket.handshake.auth?.visitor;
    if (!token && isVisitor) { socket.visitor = true; return next(); }
    if (!token) return next(new Error('Authentication required'));
    try { const decoded = jwt.verify(token, process.env.JWT_SECRET!); socket.user = decoded; next(); }
    catch { next(new Error('Invalid token')); }
  });

  io.on('connection', (socket: any) => {
    const userId = socket.user?.id;
    const role = socket.user?.role;
    logger.info({ socketId: socket.id, userId, role }, 'Client connected');

    if (userId) socket.join(`user:${userId}`);

    (async () => {
      try {
        if (!_models) return;
        const myAgent = await _models.Agent.findOne({ where: { userId } });
        if (myAgent) { socket.agentId = myAgent.id; socket.join(`agent:${myAgent.id}`); }
      } catch (err) { logger.error({ err }, 'Failed to join agent room'); }
    })();

    if (role === 'agent' || role === 'supervisor') socket.join('agents');
    if (role === 'supervisor' || role === 'admin') socket.join('supervisors');

    socket.on('agent:status:update', async (data: any) => {
      try {
        if (!_models) return;
        const { status, agentId } = data;
        const agent = await _models.Agent.findByPk(agentId || socket.user?.id);
        if (!agent) return;
        await agent.update({ status });
        io.emit('agent:status', { agentId: agent.id, status, userId: agent.userId });
        logger.info({ agentId: agent.id, status }, 'Agent status updated via Socket.IO');
        bus.emit('agent:status_change', { agentId: agent.id, status, userId: agent.userId });
        const { handleAgentStatusChange } = await import('./acd.js');
        await handleAgentStatusChange(agent.id, status, _models);
      } catch (err) { logger.error({ err }, 'Error handling agent:status:update'); }
    });

    socket.on('call:answer', async (data: any) => {
      try {
        const { callControlId } = data || {};
        if (!_models || !callControlId) return;
        const myAgent = await _models.Agent.findOne({ where: { userId: socket.user?.id } });
        if (!myAgent) { logger.warn({ userId: socket.user?.id }, 'call:answer rejected — no agent profile'); return; }
        const call = await _models.Call.findOne({ where: { callControlId } });
        if (!call) { logger.warn({ callControlId }, 'call:answer rejected — unknown callControlId'); return; }
        const isAdmin = socket.user?.role === 'admin' || socket.user?.role === 'supervisor';
        if (call.agentId && call.agentId !== myAgent.id && !isAdmin) { logger.warn({ callControlId }, 'call:answer rejected — not the routed agent'); return; }
        const { answerCall } = await import('./telnyx.js');
        await answerCall(callControlId);
        await call.update({ status: 'active', agentId: myAgent.id });
        await myAgent.update({ status: 'busy', activeCallId: call.id });
        io.to(`agent:${myAgent.id}`).emit('call:answered', { callControlId, agentId: myAgent.id, callId: call.id });
        io.to('supervisors').emit('call:answered', { callControlId, agentId: myAgent.id, callId: call.id });
        logger.info({ callControlId, agentId: myAgent.id }, 'Call answered by agent via Socket.IO');
      } catch (err) { logger.error({ err }, 'Error handling call:answer'); }
    });

    socket.on('call:hangup', async (data: any) => {
      try {
        const { callControlId } = data || {};
        if (!_models || !callControlId) return;
        const myAgent = await _models.Agent.findOne({ where: { userId: socket.user?.id } });
        const call = await _models.Call.findOne({ where: { callControlId } });
        if (!call) { logger.warn({ callControlId }, 'call:hangup rejected — unknown callControlId'); return; }
        const isAdmin = socket.user?.role === 'admin' || socket.user?.role === 'supervisor';
        if (!isAdmin && (!myAgent || call.agentId !== myAgent.id)) { logger.warn({ callControlId }, 'call:hangup rejected — not the assigned agent'); return; }
        const { hangupCall } = await import('./telnyx.js');
        await hangupCall(callControlId);
        logger.info({ callControlId }, 'Call hung up by agent via Socket.IO');
      } catch (err) { logger.error({ err }, 'Error handling call:hangup'); }
    });

    socket.on('chat:join', async (conversationId: string) => {
      if (!conversationId) return;
      try {
        if (!_models) { socket.join(`conversation:${conversationId}`); return; }
        if (socket.visitor) {
          const conv = await _models.Conversation.findByPk(conversationId);
          if (!conv || conv.visitorSocketId !== socket.id) return logger.warn({ socketId: socket.id, conversationId }, 'Visitor tried to join unauthorized conversation');
        }
        socket.join(`conversation:${conversationId}`);
      } catch (err) { logger.error({ err }, 'Error in chat:join'); }
    });

    socket.on('chat:leave', ({ conversationId }: any) => { if (!conversationId) return; socket.leave(`conversation:${conversationId}`); });
    socket.on('chat:typing', ({ conversationId, sender, name, isTyping }: any) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('chat:typing', { conversationId, sender: sender || (socket.agentId ? 'agent' : 'visitor'), name: name || socket.user?.displayName || socket.user?.username, isTyping: !!isTyping });
    });
    socket.on('disconnect', () => { logger.info({ socketId: socket.id, userId }, 'Client disconnected'); });

    socket.on('form:join', (formId: string) => { if (!formId) return; socket.join(`form:${formId}`); });
    socket.on('form:leave', (formId: string) => { if (!formId) return; socket.leave(`form:${formId}`); });

    socket.on('internal:chat:join', ({ conversationId }: any) => { if (!conversationId) return; socket.join(`internal:conversation:${conversationId}`); });
    socket.on('internal:chat:leave', ({ conversationId }: any) => { if (!conversationId) return; socket.leave(`internal:conversation:${conversationId}`); });
    socket.on('internal:chat:typing', ({ conversationId, isTyping }: any) => {
      if (!conversationId) return;
      socket.to(`internal:conversation:${conversationId}`).emit('internal:chat:typing', { conversationId, agentId: socket.agentId, name: socket.user?.displayName || socket.user?.username, isTyping: !!isTyping });
    });

    socket.on('internal:presence:update', async (data: any) => {
      try {
        if (!_models) return;
        const { presence } = data || {};
        const myAgent = await _models.Agent.findOne({ where: { userId: socket.user?.id } });
        if (!myAgent) return;
        await myAgent.update({ presence });
        io.emit('internal:presence', { agentId: myAgent.id, presence });
      } catch (err) { logger.error({ err }, 'Error handling internal:presence:update'); }
    });
  });

  return io;
}

export function setModels(models: any) { _models = models; }
export function getIO() { if (!io) throw new Error('Socket.IO not initialized'); return io; }

// ── Event emitters ──
export function emitCallRinging(callData: any) { if (callData.agentId) io?.to(`agent:${callData.agentId}`).emit('call:ringing', callData); io?.to('supervisors').emit('call:ringing', callData); }
export function emitCallAnswered(callData: any) { if (callData.agentId) io?.to(`agent:${callData.agentId}`).emit('call:answered', callData); io?.to('supervisors').emit('call:answered', callData); }
export function emitCallEnded(callData: any) { if (callData.agentId) io?.to(`agent:${callData.agentId}`).emit('call:ended', callData); io?.to('supervisors').emit('call:ended', callData); }
export function emitTranscriptPartial(callControlId: string, transcript: any, agentId?: string) { const data = { callControlId, ...transcript }; if (agentId) io?.to(`agent:${agentId}`).emit('transcript:partial', data); io?.to('supervisors').emit('transcript:partial', data); }
export function emitTranscriptFinal(callControlId: string, transcript: any, agentId?: string) { const data = { callControlId, ...transcript }; if (agentId) io?.to(`agent:${agentId}`).emit('transcript:final', data); io?.to('supervisors').emit('transcript:final', data); }
export function emitAgentStatusUpdate(agentId: string, status: string, userId?: string) { io?.emit('agent:status', { agentId, status, userId }); }
export function emitCaseNotesReady(callId: string, caseNote: any, agentId?: string) { if (agentId) io?.to(`agent:${agentId}`).emit('caseNotes:ready', { callId, caseNote }); io?.to('supervisors').emit('caseNotes:ready', { callId, caseNote }); }
export function emitCallRoutedToAgent(agentId: string, callData: any) { io?.emit('call:routed', { agentId, ...callData }); }
export function emitQueueUpdate(queueStatus: any) { io?.to('supervisors').emit('queue:update', queueStatus); }
export function emitWhisperStarted(callControlId: string, supervisorAgentId: string) { io?.emit('whisper:started', { callControlId, supervisorAgentId }); }
export function emitMonitorStarted(callControlId: string, supervisorAgentId: string) { io?.to('supervisors').emit('monitor:started', { callControlId, supervisorAgentId }); }
export function emitBargeStarted(callControlId: string, supervisorAgentId: string) { io?.emit('barge:started', { callControlId, supervisorAgentId }); }
export function emitAgentAssistSuggestion(callControlId: string, payload: any) { io?.emit('agent_assist:suggestion', { callControlId, ...payload }); }
export function emitTransferStarted(callControlId: string, targetCallControlId: string) { io?.emit('transfer:started', { callControlId, targetCallControlId }); }
export function emitChatNew(conversation: any) { io?.to('agents').emit('chat:new', conversation); }
export function emitChatMessage(conversationId: string, message: any) { io?.to(`conversation:${conversationId}`).emit('chat:message', message); io?.to('agents').emit('chat:message', { conversationId, ...message }); }
export function emitMessageStatus(conversationId: string, payload: any) { io?.to(`conversation:${conversationId}`).emit('chat:message:status', payload); io?.to('agents').emit('chat:message:status', payload); }
export function emitChatAccepted(conversationId: string, agentId: string) { io?.to(`conversation:${conversationId}`).emit('chat:accepted', { conversationId, agentId }); io?.to('agents').emit('chat:accepted', { conversationId, agentId }); }
export function emitChatClosed(conversationId: string) { io?.to(`conversation:${conversationId}`).emit('chat:closed', { conversationId }); io?.to('agents').emit('chat:closed', { conversationId }); }
export function emitWallboardUpdate(data: any) { io?.to('supervisors').emit('wallboard:update', data); }
export function emitAgentWrapUpStart(agentId: string, wrapUpUntil: Date) { io?.to(`agent:${agentId}`).emit('agent:wrapup:start', { agentId, wrapUpUntil }); io?.to('supervisors').emit('agent:wrapup:start', { agentId, wrapUpUntil }); }
export function emitAgentWrapUpEnd(agentId: string) { io?.to(`agent:${agentId}`).emit('agent:wrapup:end', { agentId }); io?.to('supervisors').emit('agent:wrapup:end', { agentId }); }
export function emitQueueCreated(queue: any) { io?.emit('queue:created', queue); }
export function emitQueueUpdated(queue: any) { io?.emit('queue:updated', queue); }
export function emitQueueDeleted(queueId: string) { io?.emit('queue:deleted', { id: queueId }); }
export function emitInternalChatNew(agentId: string, conversation: any) { io?.to(`agent:${agentId}`).emit('internal:chat:new', conversation); }
export function emitInternalChatMessage(conversationId: string, message: any) { io?.to(`internal:conversation:${conversationId}`).emit('internal:chat:message', { conversationId, ...message }); }
export function emitInternalPresence(agentId: string, presence: any) { io?.emit('internal:presence', { agentId, presence }); }
export function emitInternalCallRinging(agentId: string, callData: any) { io?.to(`agent:${agentId}`).emit('internal:call:ringing', callData); }
export function emitWarmTransferUpdate(agentId: string, data: any) { io?.to(`agent:${agentId}`).emit('warm-transfer:update', data); }
export function emitQueueCallEnqueued(queueName: string, data: any) { io?.to('supervisors').emit('queue:call_enqueued', { queueName, ...data }); }
export function emitQueueCallRouted(queueName: string, data: any) { io?.to('supervisors').emit('queue:call_routed', { queueName, ...data }); }
export function emitQueueCallAbandoned(queueName: string, data: any) { io?.to('supervisors').emit('queue:call_abandoned', { queueName, ...data }); }
export function emitRecordingSaved(socketIo: any, recording: any) { socketIo?.to('supervisors').emit('recording:saved', recording); socketIo?.to('agents').emit('recording:saved', recording); }
export function emitScorecardCreated(socketIo: any, scorecard: any) { socketIo?.to('agents').emit('coaching:scorecard_created', scorecard); socketIo?.to('supervisors').emit('coaching:scorecard_created', scorecard); }
export function emitScorecardUpdated(socketIo: any, scorecard: any) { socketIo?.to('agents').emit('coaching:scorecard_updated', scorecard); socketIo?.to('supervisors').emit('coaching:scorecard_updated', scorecard); }
export function emitWorkflowExecuted(socketIo: any, result: any) { socketIo?.to('agents').emit('workflow:executed', result); socketIo?.to('supervisors').emit('workflow:executed', result); }
export function emitWorkflowToggled(socketIo: any, workflow: any) { socketIo?.to('supervisors').emit('workflow:toggled', workflow); }
export function emitDebugWebhook(socketIo: any, webhookEntry: any) { socketIo?.to('supervisors').emit('debug:webhook', webhookEntry); }
export function emitFormSubmitted(socketIo: any, formData: any) { socketIo?.to('supervisors').emit('form:submitted', formData); }
export function emitFormUpdated(socketIo: any, formId: string, updateData: any) { socketIo?.to(`form:${formId}`).emit('form:updated', updateData); }
