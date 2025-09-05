import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    if (this.socket && this.socket.connected) {
      console.warn('Socket already connected');
      return this.socket;
    }

    // Use HTTP for development, HTTPS for production
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const socketUrl = `${protocol}://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`;
    
    this.socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      timeout: 10000,
    });

    this.setupEventListeners();
    return this.socket;
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to websocket server');
      this.reconnectAttempts = 0;
      this.notifyHandlers('connect', null);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from websocket server:', reason);
      this.notifyHandlers('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      this.notifyHandlers('connect_error', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to websocket server, attempt:', attemptNumber);
      this.notifyHandlers('reconnect', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      this.notifyHandlers('reconnect_error', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after max attempts');
      this.notifyHandlers('reconnect_failed', null);
    });

    // Application-specific events
    this.socket.on('NEW_CALL', (data) => {
      console.log('SocketService: NEW_CALL received:', data);
      console.log('SocketService: Notifying', this.eventHandlers.get('NEW_CALL')?.length || 0, 'handlers');
      this.notifyHandlers('NEW_CALL', data);
    });

    this.socket.on('OutboundCCID', (data) => {
      console.log('OutboundCCID received:', data);
      this.notifyHandlers('OutboundCCID', data);
    });

    this.socket.on('WebRTC_OutboundCCID', (data) => {
      console.log('WebRTC_OutboundCCID received:', data);
      this.notifyHandlers('WebRTC_OutboundCCID', data);
    });

    this.socket.on('WARM_TRANSFER_CONNECTED', (data) => {
      console.log('Warm transfer connected:', data);
      this.notifyHandlers('WARM_TRANSFER_CONNECTED', data);
    });

    this.socket.on('WARM_TRANSFER_ENDED', (data) => {
      console.log('Warm transfer ended:', data);
      this.notifyHandlers('WARM_TRANSFER_ENDED', data);
    });

    this.socket.on('WARM_TRANSFER_COMPLETED', (data) => {
      console.log('Warm transfer completed:', data);
      this.notifyHandlers('WARM_TRANSFER_COMPLETED', data);
    });

    this.socket.on('CALL_HANGUP', (data) => {
      console.log('SocketService: CALL_HANGUP received:', data);
      this.notifyHandlers('CALL_HANGUP', data);
    });

    // SMS/Message events
    this.socket.on('message_received', (data) => {
      console.log('Message received:', data);
      this.notifyHandlers('message_received', data);
    });

    this.socket.on('conversation_updated', (data) => {
      console.log('Conversation updated:', data);
      this.notifyHandlers('conversation_updated', data);
    });
  }

  notifyHandlers(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);

    // Return cleanup function
    return () => {
      this.off(event, handler);
    };
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventHandlers.clear();
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  getConnectionState() {
    if (!this.socket) return 'disconnected';
    return this.socket.connected ? 'connected' : 'disconnected';
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;