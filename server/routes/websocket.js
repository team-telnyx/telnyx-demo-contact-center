let io = null;
let connectedAgents = new Map(); // Map of username -> Set of socket.ids
let socketToAgent = new Map(); // Map of socket.id -> username
let pendingCallAcceptances = new Map(); // Map of callControlId -> {username, socketId}

const initWebSocket = (server) => {
  io = require('socket.io')(server, {
    cors: {
      origin: "*",  // This will allow all origins
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle agent authentication/identification
    socket.on('identify', (data) => {
      const { username } = data;
      if (username) {
        // Add socket to agent's set of connections
        if (!connectedAgents.has(username)) {
          connectedAgents.set(username, new Set());
        }
        connectedAgents.get(username).add(socket.id);
        socketToAgent.set(socket.id, username);
        
        console.log(`Agent identified: ${username} -> ${socket.id}`);
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
            console.log(`Agent fully disconnected: ${username}`);
          } else {
            console.log(`Agent ${username} still has ${agentSockets.size} connection(s)`);
          }
        }
        
        socketToAgent.delete(socket.id);
      }
      
      console.log('Client disconnected:', socket.id);
    });
  });

  io.on('error', (err) => {
    console.error('Socket.IO server error:', err);
  });
};

const broadcast = (type, data) => {
  if (!io) {
    console.error('WebSocket: Cannot broadcast, io is not initialized');
    return;
  }
  
  const connectedClients = io.sockets.sockets.size;
  console.log(`WebSocket: Broadcasting ${type} to ${connectedClients} connected clients`);
  console.log('WebSocket: Broadcast data:', JSON.stringify(data, null, 2));
  
  io.emit(type, data);
  
  console.log(`WebSocket: Broadcast of ${type} completed`);
};

// Broadcast to all connections of a specific agent
const broadcastToAgent = (username, type, data) => {
  if (!io) {
    console.error('WebSocket: Cannot broadcast, io is not initialized');
    return;
  }
  
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
};

// Broadcast to specific socket that accepted a call
const broadcastToAcceptingSocket = (callControlId, type, data) => {
  console.log(`*** BROADCAST TO ACCEPTING SOCKET CALLED ***`);
  console.log('Call Control ID:', callControlId);
  console.log('Event type:', type);
  console.log('Current pending acceptances:', Array.from(pendingCallAcceptances.entries()));
  
  if (!io) {
    console.error('WebSocket: Cannot broadcast, io is not initialized');
    return false;
  }
  
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

module.exports = { 
  initWebSocket, 
  broadcast, 
  broadcastToAgent, 
  broadcastToAcceptingSocket,
  getConnectedAgents, 
  getAgentConnectionCount 
};
