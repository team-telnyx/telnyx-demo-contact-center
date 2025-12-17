import { Server } from 'socket.io';
let io = null;
let connectedAgents = new Map(); // Map of username -> Set of socket.ids
let socketToAgent = new Map(); // Map of socket.id -> username
let pendingCallAcceptances = new Map(); // Map of callControlId -> {username, socketId}
let agentLastActivity = new Map(); // Map of username -> {socketId, lastActivity}
let socketInfo = new Map(); // Map of socket.id -> {username, userAgent, timestamp}

const DEFAULT_ROOM_NAME = 'contact-center-global';

const getWorkerEnv = (explicitEnv) => explicitEnv || globalThis.__WORKER_ENV__ || globalThis.__WORKER_BROADCAST_ENV__ || null;

const formatPayload = (type, data, options = {}) => {
  const payload = {
    type,
    timestamp: new Date().toISOString()
  };

  if (options.targetUsername) payload.targetUsername = options.targetUsername;
  if (options.targetUsernames) payload.targetUsernames = options.targetUsernames;
  if (options.excludeUsername) payload.excludeUsername = options.excludeUsername;

  switch (type) {
    case 'NEW_MESSAGE': {
      const conversationId = data?.conversation_id || data?.conversationId || null;
      payload.conversationId = conversationId;
      payload.message = data;
      break;
    }
    case 'ASSIGNED_CONVERSATIONS_UPDATE':
    case 'UNASSIGNED_CONVERSATIONS_UPDATE':
    case 'QUEUE_UPDATE': {
      payload.data = data;
      break;
    }
    case 'NEW_CALL': {
      const callPayload = data?.call || data?.payload || data;
      payload.call = {
        call_control_id: callPayload?.call_control_id ?? callPayload?.callControlId ?? data?.call_control_id,
        callControlId: callPayload?.call_control_id ?? callPayload?.callControlId ?? data?.callControlId,
        from: callPayload?.from ?? data?.from,
        to: callPayload?.to ?? data?.to,
        direction: callPayload?.direction ?? data?.direction,
        queue: callPayload?.queue ?? data?.queue,
        status: callPayload?.status ?? data?.status ?? 'queued',
        created_at: callPayload?.created_at ?? data?.created_at ?? new Date().toISOString(),
        raw: data
      };
      break;
    }
    case 'CALL_ENDED':
    case 'CALL_HANGUP': {
      payload.callControlId = data?.callControlId || data?.payload?.call_control_id || data?.call_control_id;
      payload.hangupCause = data?.hangupCause || data?.payload?.hangup_cause;
      payload.hangupSource = data?.hangupSource || data?.payload?.hangup_source;
      payload.data = data;
      break;
    }
    case 'CALL_BRIDGED':
    case 'CALL_ACCEPTED':
    case 'CALL_UPDATED': {
      payload.callControlId = data?.callControlId || data?.payload?.call_control_id || data?.call_control_id;
      payload.status = data?.status || data?.payload?.status;
      payload.data = data;
      break;
    }
    case 'TRANSFER_INITIATED':
    case 'TRANSFER_COMPLETED':
    case 'TRANSFER_FAILED':
    case 'OutboundCCID':
    case 'WebRTC_OutboundCCID': {
      payload.data = data;
      break;
    }
    default: {
      payload.data = data;
    }
  }

  return payload;
};

const sendViaDurableObject = (type, data, options = {}) => {
  try {
    const env = getWorkerEnv(options.env);
    if (!env || !env.CONTACT_CENTER_ROOM) {
      console.warn('WebSocket: Durable Object binding not available for broadcast');
      return;
    }

    const roomName = options.roomName || DEFAULT_ROOM_NAME;
    const id = env.CONTACT_CENTER_ROOM.idFromName(roomName);
    const stub = env.CONTACT_CENTER_ROOM.get(id);
    const payload = formatPayload(type, data, options);

    stub.fetch('https://contact-center/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch((err) => {
      console.error('WebSocket: Durable Object broadcast error:', err);
    });
  } catch (error) {
    console.error('WebSocket: Failed to send via Durable Object:', error);
  }
};

const initWebSocket = (server) => {
  io = new Server(server, {
    path: '/api/socket.io', // Important for routing through Cloudflare/Nginx properly
    cors: {
      origin: "*",  // This will allow all origins
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle agent authentication/identification
    socket.on('identify', (data) => {
      const { username, userAgent } = data;
      if (username) {
        // Add socket to agent's set of connections
        if (!connectedAgents.has(username)) {
          connectedAgents.set(username, new Set());
        }
        connectedAgents.get(username).add(socket.id);
        socketToAgent.set(socket.id, username);

        // Track socket info and update last activity
        socketInfo.set(socket.id, {
          username,
          userAgent: userAgent || 'Unknown',
          timestamp: new Date()
        });

        // Update last activity for this agent
        agentLastActivity.set(username, {
          socketId: socket.id,
          lastActivity: new Date()
        });

        console.log(`Agent identified: ${username} -> ${socket.id} (${userAgent || 'Unknown device'})`);
        console.log(`Agent ${username} now has ${connectedAgents.get(username).size} connection(s)`);
        console.log('Connected agents:', Array.from(connectedAgents.keys()));
      }
    });

    // Handle call acceptance from specific browser window
    socket.on('accept_call', (data) => {
      console.log('*** ACCEPT_CALL EVENT RECEIVED ***');
      console.log('Socket ID:', socket.id);
      console.log('Data received:', data);

      const { callControlId } = data;
      const username = socketToAgent.get(socket.id);

      console.log('Username for socket:', username);
      console.log('Call control ID:', callControlId);

      if (username && callControlId) {
        // Update last activity for this agent
        agentLastActivity.set(username, {
          socketId: socket.id,
          lastActivity: new Date()
        });

        // Track which specific socket/browser accepted this call
        pendingCallAcceptances.set(callControlId, {
          username: username,
          socketId: socket.id
        });

        console.log(`*** CALL ACCEPTANCE TRACKED: ${callControlId} accepted by ${username} on socket ${socket.id} ***`);
        console.log('Current pending acceptances:', Array.from(pendingCallAcceptances.entries()));
      } else {
        console.error('*** FAILED TO TRACK CALL ACCEPTANCE ***');
        console.error('Missing username:', !username);
        console.error('Missing callControlId:', !callControlId);
      }
    });

    socket.on('message', (message) => {
      console.log('Received message:', message);
    });

    socket.on('disconnect', () => {
      const username = socketToAgent.get(socket.id);

      if (username) {
        // Remove this socket from agent's connections
        const agentSockets = connectedAgents.get(username);
        if (agentSockets) {
          agentSockets.delete(socket.id);

          // If no more connections for this agent, remove from map
          if (agentSockets.size === 0) {
            connectedAgents.delete(username);
            agentLastActivity.delete(username);
            console.log(`Agent fully disconnected: ${username}`);
          } else {
            // If this was the last active socket, update to another socket
            const lastActivity = agentLastActivity.get(username);
            if (lastActivity && lastActivity.socketId === socket.id) {
              // Pick another active socket for this agent
              const remainingSockets = Array.from(agentSockets);
              if (remainingSockets.length > 0) {
                agentLastActivity.set(username, {
                  socketId: remainingSockets[0],
                  lastActivity: new Date()
                });
              }
            }
            console.log(`Agent ${username} still has ${agentSockets.size} connection(s)`);
          }
        }

        socketToAgent.delete(socket.id);
        socketInfo.delete(socket.id);
      }

      console.log('Client disconnected:', socket.id);
    });
  });

  io.on('error', (err) => {
    console.error('Socket.IO server error:', err);
  });
};

const broadcast = (type, data, env) => {
  if (io) {
    const connectedClients = io.sockets.sockets.size;
    console.log(`WebSocket: Broadcasting ${type} to ${connectedClients} connected clients`);
    console.log('WebSocket: Broadcast data:', JSON.stringify(data, null, 2));
    io.emit(type, data);
    console.log(`WebSocket: Broadcast of ${type} completed`);
    return;
  }

  console.log(`WebSocket: Using Durable Object broadcast for ${type}`);
  sendViaDurableObject(type, data, { env });
};

// Broadcast to all connections of a specific agent
const broadcastToAgent = (username, type, data, env) => {
  if (io) {
    const agentSockets = connectedAgents.get(username);
    if (agentSockets && agentSockets.size > 0) {
      let successCount = 0;
      agentSockets.forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(type, data);
          successCount++;
        }
      });

      console.log(`WebSocket: Broadcasting ${type} to agent ${username} (${successCount}/${agentSockets.size} connections)`);
      console.log('WebSocket: Broadcast data:', JSON.stringify(data, null, 2));
      return successCount > 0;
    }

    console.log(`WebSocket: Agent ${username} not found or not connected`);
    return false;
  }

  sendViaDurableObject(type, data, { env, targetUsernames: [username] });
  return true;
};

// Broadcast to specific socket that accepted a call
const broadcastToAcceptingSocket = (callControlId, type, data, env) => {
  console.log(`*** BROADCAST TO ACCEPTING SOCKET CALLED ***`);
  console.log('Call Control ID:', callControlId);
  console.log('Event type:', type);
  console.log('Current pending acceptances:', Array.from(pendingCallAcceptances.entries()));

  if (io) {
    const acceptance = pendingCallAcceptances.get(callControlId);
    console.log('Found acceptance for call:', acceptance);

    if (acceptance) {
      const { username, socketId } = acceptance;
      const socket = io.sockets.sockets.get(socketId);

      console.log('Socket found:', !!socket);

      if (socket) {
        console.log(`*** SUCCESS: Broadcasting ${type} to accepting socket ${socketId} for agent ${username} ***`);
        console.log('WebSocket: Broadcast data:', JSON.stringify(data, null, 2));
        socket.emit(type, data);

        // Clean up the pending acceptance
        pendingCallAcceptances.delete(callControlId);
        return true;
      } else {
        console.error(`*** ERROR: Socket ${socketId} not found for agent ${username} ***`);
      }
    } else {
      console.log(`*** NO ACCEPTANCE FOUND: No accepting socket found for call ${callControlId} ***`);
    }

    return false;
  }

  const acceptance = pendingCallAcceptances.get(callControlId);
  const targetUsername = acceptance?.username || data?.agentUsername || data?.username || null;
  sendViaDurableObject(type, data, { env, targetUsername });
  pendingCallAcceptances.delete(callControlId);
  return true;
};

// Broadcast to the most recently active device of a specific agent
const broadcastToAgentPrimary = (username, type, data, env) => {
  if (io) {
    const lastActivity = agentLastActivity.get(username);
    if (lastActivity) {
      const { socketId } = lastActivity;
      const socket = io.sockets.sockets.get(socketId);
      const socketDetail = socketInfo.get(socketId);

      if (socket) {
        console.log(`WebSocket: Broadcasting ${type} to PRIMARY device for agent ${username}`);
        console.log(`WebSocket: Target device: ${socketDetail?.userAgent || 'Unknown'} (${socketId})`);
        console.log('WebSocket: Broadcast data:', JSON.stringify(data, null, 2));

        socket.emit(type, data);
        return true;
      } else {
        console.error(`WebSocket: Primary socket ${socketId} not found for agent ${username}`);
      }
    }

    console.log(`WebSocket: No primary device found for agent ${username}, falling back to broadcastToAgent`);
    return broadcastToAgent(username, type, data);
  }

  sendViaDurableObject(type, data, { env, targetUsernames: [username] });
  return true;
};

// Get connected agents
const getConnectedAgents = () => {
  return Array.from(connectedAgents.keys());
};

// Get connection count for agent
const getAgentConnectionCount = (username) => {
  const agentSockets = connectedAgents.get(username);
  return agentSockets ? agentSockets.size : 0;
};

export {
  initWebSocket,
  broadcast,
  broadcastToAgent,
  broadcastToAgentPrimary,
  broadcastToAcceptingSocket,
  getConnectedAgents,
  getAgentConnectionCount
};
