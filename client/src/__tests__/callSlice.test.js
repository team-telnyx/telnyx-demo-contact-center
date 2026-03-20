import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import callReducer, {
  dialDigit,
  backspace,
  clearDial,
  setCallState,
  resetCall,
} from '../features/call/callSlice';

const createStore = (preloadedState) =>
  configureStore({
    reducer: { call: callReducer },
    preloadedState: preloadedState ? { call: preloadedState } : undefined,
  });

describe('callSlice', () => {
  describe('dialDigit', () => {
    it('should add a digit to dialNumber', () => {
      const store = createStore();
      store.dispatch(dialDigit('5'));
      expect(store.getState().call.dialNumber).toBe('5');
    });

    it('should append multiple digits', () => {
      const store = createStore();
      store.dispatch(dialDigit('1'));
      store.dispatch(dialDigit('2'));
      store.dispatch(dialDigit('3'));
      expect(store.getState().call.dialNumber).toBe('123');
    });

    it('should handle special characters like + and #', () => {
      const store = createStore();
      store.dispatch(dialDigit('+'));
      store.dispatch(dialDigit('1'));
      store.dispatch(dialDigit('#'));
      expect(store.getState().call.dialNumber).toBe('+1#');
    });
  });

  describe('backspace', () => {
    it('should remove the last digit', () => {
      const store = createStore({ dialNumber: '123', callState: 'idle', clientStatus: 'NOT READY', direction: null, callerInfo: null, callControlId: null, outboundCCID: null, webrtcOutboundCCID: null, isConferenceActive: false, conferenceId: null, isMuted: false, isHeld: false, callDuration: 0, startTime: null, toNumber: null, fromNumber: null, callerNumber: '' });
      store.dispatch(backspace());
      expect(store.getState().call.dialNumber).toBe('12');
    });

    it('should handle empty string gracefully', () => {
      const store = createStore();
      store.dispatch(backspace());
      expect(store.getState().call.dialNumber).toBe('');
    });

    it('should remove the only remaining digit', () => {
      const store = createStore({ dialNumber: '5', callState: 'idle', clientStatus: 'NOT READY', direction: null, callerInfo: null, callControlId: null, outboundCCID: null, webrtcOutboundCCID: null, isConferenceActive: false, conferenceId: null, isMuted: false, isHeld: false, callDuration: 0, startTime: null, toNumber: null, fromNumber: null, callerNumber: '' });
      store.dispatch(backspace());
      expect(store.getState().call.dialNumber).toBe('');
    });
  });

  describe('clearDial', () => {
    it('should clear the dial number', () => {
      const store = createStore({ dialNumber: '12345', callState: 'idle', clientStatus: 'NOT READY', direction: null, callerInfo: null, callControlId: null, outboundCCID: null, webrtcOutboundCCID: null, isConferenceActive: false, conferenceId: null, isMuted: false, isHeld: false, callDuration: 0, startTime: null, toNumber: null, fromNumber: null, callerNumber: '' });
      store.dispatch(clearDial());
      expect(store.getState().call.dialNumber).toBe('');
    });

    it('should handle already empty dial number', () => {
      const store = createStore();
      store.dispatch(clearDial());
      expect(store.getState().call.dialNumber).toBe('');
    });
  });

  describe('setCallState', () => {
    it('should update the call state', () => {
      const store = createStore();
      store.dispatch(setCallState('ringing'));
      expect(store.getState().call.callState).toBe('ringing');
    });

    it('should update call state to active', () => {
      const store = createStore();
      store.dispatch(setCallState('active'));
      expect(store.getState().call.callState).toBe('active');
    });

    it('should update call state to held', () => {
      const store = createStore();
      store.dispatch(setCallState('held'));
      expect(store.getState().call.callState).toBe('held');
    });
  });

  describe('resetCall', () => {
    it('should reset to initial state but preserve dialNumber', () => {
      const store = createStore({
        dialNumber: '5551234',
        callState: 'active',
        direction: 'outbound',
        callerInfo: { name: 'Test' },
        callControlId: 'ctrl-123',
        outboundCCID: 'ccid-456',
        webrtcOutboundCCID: 'webrtc-789',
        isConferenceActive: true,
        conferenceId: 'conf-abc',
        isMuted: true,
        isHeld: true,
        callDuration: 120,
        startTime: 1000,
        toNumber: '+15551234',
        fromNumber: '+15559876',
        callerNumber: '+15550000',
      });

      store.dispatch(resetCall());

      const state = store.getState().call;
      expect(state.dialNumber).toBe('5551234');
      expect(state.callState).toBe('idle');
      expect(state.direction).toBeNull();
      expect(state.callerInfo).toBeNull();
      expect(state.callControlId).toBeNull();
      expect(state.outboundCCID).toBeNull();
      expect(state.webrtcOutboundCCID).toBeNull();
      expect(state.isConferenceActive).toBe(false);
      expect(state.conferenceId).toBeNull();
      expect(state.isMuted).toBe(false);
      expect(state.isHeld).toBe(false);
      expect(state.callerNumber).toBe('+15550000');
    });

    it('should work when already in initial state', () => {
      const store = createStore();
      store.dispatch(resetCall());
      const state = store.getState().call;
      expect(state.callState).toBe('idle');
      expect(state.dialNumber).toBe('');
    });
  });
});
