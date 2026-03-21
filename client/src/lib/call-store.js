import { useSyncExternalStore } from 'react';

let _call = null;
let _client = null;
const _listeners = new Set();

function notify() {
  _listeners.forEach((fn) => fn());
}

export const callStore = {
  setCall(call) {
    _call = call;
    notify();
  },
  setClient(client) {
    _client = client;
    notify();
  },
  getCall() {
    return _call;
  },
  getClient() {
    return _client;
  },
  clear() {
    _call = null;
    _client = null;
    notify();
  },
  subscribe(listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};

function getSnapshot() {
  return { call: _call, client: _client };
}

let _lastSnapshot = getSnapshot();
function getStableSnapshot() {
  const next = getSnapshot();
  if (next.call !== _lastSnapshot.call || next.client !== _lastSnapshot.client) {
    _lastSnapshot = next;
  }
  return _lastSnapshot;
}

export function useCallStore() {
  return useSyncExternalStore(callStore.subscribe, getStableSnapshot, getStableSnapshot);
}
