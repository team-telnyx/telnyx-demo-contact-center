/**
 * ContactCenterRoom Durable Object
 *
 * Manages WebSocket connections for real-time updates in the contact center.
 * Each instance handles a "room" of connected clients (agents).
 */

export class ContactCenterRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set(); // Set of WebSocket connections
  }

  async fetch(request) {
    console.log('🔷 Durable Object fetch called');
    console.log('🔷 Request URL:', request.url);
    console.log('🔷 Request method:', request.method);
    console.log('🔷 Upgrade header:', request.headers.get('Upgrade'));

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      console.log('✅ Handling WebSocket upgrade in Durable Object');
      return this.handleWebSocket(request);
    }

    // Handle HTTP requests for broadcasting events
    if (request.method === 'POST') {
      console.log('✅ Handling POST broadcast in Durable Object');
      return this.handleBroadcast(request);
    }

    console.log('ℹ️ Returning default response from Durable Object');
    return new Response('ContactCenterRoom Durable Object', { status: 200 });
  }

  async handleWebSocket(request) {
    console.log('🔷 handleWebSocket called');
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    console.log('🔷 Username from URL:', username);

    if (!username) {
      console.log('❌ No username in Durable Object');
      return new Response('Username required', { status: 400 });
    }

    console.log('🔷 Creating WebSocket pair...');
    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    console.log('🔷 Accepting WebSocket connection...');
    // Accept the WebSocket connection
    server.accept();

    const sessionId = globalThis.crypto?.randomUUID?.()
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Create session object
    const session = {
      webSocket: server,
      username: username,
      sessionId,
      connectedAt: new Date().toISOString(),
      lastActivity: Date.now()
    };

    // Add to sessions set
    this.sessions.add(session);
    console.log(`✅ Session added for ${username}. Total sessions: ${this.sessions.size}`);

    // Send welcome message
    console.log('🔷 Sending welcome message...');
    server.send(JSON.stringify({
      type: 'connected',
      username: username,
      sessionId,
      timestamp: new Date().toISOString(),
      message: 'Connected to Contact Center'
    }));
    console.log('✅ Welcome message sent');

    // Broadcast user joined to all other clients
    this.broadcast({
      type: 'USER_JOINED',
      username: username,
      timestamp: new Date().toISOString()
    }, session);

    // Handle incoming messages
    server.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        session.lastActivity = Date.now();

        // Handle different message types
        switch (data.type) {
          case 'ping':
            server.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;
          case 'status_update':
            // Broadcast status update to all clients
            this.broadcast({
              type: 'AGENT_STATUS_UPDATE',
              username: username,
              status: data.status,
              timestamp: new Date().toISOString()
            });
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Handle close
    server.addEventListener('close', () => {
      this.sessions.delete(session);
      console.log(`User ${username} disconnected. Active sessions: ${this.sessions.size}`);

      // Broadcast user left to remaining clients
      this.broadcast({
        type: 'USER_LEFT',
        username: username,
        timestamp: new Date().toISOString()
      });
    });

    // Handle errors
    server.addEventListener('error', (error) => {
      console.error('WebSocket error for user', username, ':', error);
      this.sessions.delete(session);
    });

    // Return the client side of the WebSocket pair
    console.log('🔷 Returning WebSocket response with status 101');
    const response = new Response(null, {
      status: 101,
      webSocket: client
    });
    console.log('✅ WebSocket response created and being returned');
    return response;
  }

  async handleBroadcast(request) {
    try {
      const event = await request.json();

      // Broadcast the event to all connected clients
      this.broadcast(event);

      return new Response(JSON.stringify({
        success: true,
        activeConnections: this.sessions.size
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to broadcast',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param {Object} message - The message to broadcast
   * @param {Object} excludeSession - Optional session to exclude from broadcast
   */
  broadcast(message, excludeSession = null) {
    const targetUsername = message.targetUsername || null;
    const targetUsernames = message.targetUsernames || null;
    const excludeUsername = message.excludeUsername || null;

    const messageToSend = { ...message };
    delete messageToSend.targetUsername;
    delete messageToSend.targetUsernames;
    delete messageToSend.excludeUsername;

    const messageStr = JSON.stringify(messageToSend);
    let sentCount = 0;

    for (const session of this.sessions) {
      if (session === excludeSession) continue;
      if (excludeUsername && session.username === excludeUsername) continue;
      if (targetUsername && session.username !== targetUsername) continue;
      if (targetUsernames && !targetUsernames.includes(session.username)) continue;

      try {
        session.webSocket.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error('Error sending to session:', error);
        // Remove dead connections
        this.sessions.delete(session);
      }
    }

    console.log(`Broadcasted ${message.type} to ${sentCount} clients`);
    return sentCount;
  }

  /**
   * Get statistics about this room
   */
  getStats() {
    return {
      activeConnections: this.sessions.size,
      users: Array.from(this.sessions).map(s => ({
        username: s.username,
        connectedAt: s.connectedAt,
        lastActivity: s.lastActivity
      }))
    };
  }
}
