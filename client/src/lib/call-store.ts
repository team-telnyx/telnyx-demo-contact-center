// Simple pub-sub store for call state management
// Used by SoftphoneMini and UniversalCallModal

type CallStatus = 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended' | 'holding' | 'active';

interface CallState {
  call: any | null;
  status: CallStatus;
  toNumber: string;
  fromNumber: string;
  isMuted: boolean;
  isHeld: boolean;
  direction?: 'inbound' | 'outbound';
  startTime?: number;
}

let state: CallState = {
  call: null,
  status: 'idle',
  toNumber: '',
  fromNumber: '',
  isMuted: false,
  isHeld: false,
};

type Listener = (state: CallState) => void;
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener({ ...state });
    } catch (err) {
      console.error('Error in call-store listener:', err);
    }
  });
}

export function getState(): CallState {
  return { ...state };
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setStatus(status: CallStatus) {
  if (state.status !== status) {
    state.status = status;
    if (status === 'connected' && !state.startTime) {
      state.startTime = Date.now();
    }
    notify();
  }
}

export function setToNumber(toNumber: string) {
  if (state.toNumber !== toNumber) {
    state.toNumber = toNumber;
    notify();
  }
}

export function setFromNumber(fromNumber: string) {
  if (state.fromNumber !== fromNumber) {
    state.fromNumber = fromNumber;
    notify();
  }
}

export function setCall(call: any, direction?: 'inbound' | 'outbound') {
  state.call = call;
  state.direction = direction;
  if (direction === 'inbound') {
    state.status = 'ringing';
  }
  notify();
}

export function setMuted(isMuted: boolean) {
  if (state.isMuted !== isMuted) {
    state.isMuted = isMuted;
    notify();
  }
}

export function setHeld(isHeld: boolean) {
  if (state.isHeld !== isHeld) {
    state.isHeld = isHeld;
    state.status = isHeld ? 'holding' : 'connected';
    notify();
  }
}

export function clear() {
  state = {
    call: null,
    status: 'idle',
    toNumber: state.toNumber, // Keep the number for next call
    fromNumber: state.fromNumber,
    isMuted: false,
    isHeld: false,
    startTime: undefined,
    direction: undefined,
  };
  notify();
}
