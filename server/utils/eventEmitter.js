const EventEmitter = require('events');

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
  emitQueueUpdate() {
    this.emit('QUEUE_UPDATE');
  }
}

// Singleton instance
const callEventEmitter = new CallEventEmitter();

module.exports = callEventEmitter;
