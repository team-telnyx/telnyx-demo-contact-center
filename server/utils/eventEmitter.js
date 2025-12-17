import { EventEmitter } from 'events';
import { broadcast } from '../routes/websocket.js';

class CallEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); // Unlimited listeners (SSE connections can reconnect frequently)
  }

  // Emit new call event
  emitNewCall(callData) {
    this.emit('NEW_CALL', callData);
  }

  // Emit call accepted event
  emitCallAccepted(callData) {
    this.emit('CALL_ACCEPTED', callData);
  }

  // Emit call ended event
  emitCallEnded(callData) {
    this.emit('CALL_ENDED', callData);
  }

  // Emit queue update
  emitQueueUpdate(env, data = {}) {
    this.emit('QUEUE_UPDATE');
    try {
      broadcast('QUEUE_UPDATE', data, env);
    } catch (error) {
      console.error('❌ Error broadcasting QUEUE_UPDATE over WebSocket:', error);
    }
  }
}

// Singleton instance
const callEventEmitter = new CallEventEmitter();

export default callEventEmitter;
