'use client';

import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';
import { useAppDispatch } from '../../src/store/hooks';
import {
  setCallState,
  setClientStatus,
  setDirection,
  setCallerInfo,
  setCallControlId,
  setStartTime,
  setToNumber,
  setFromNumber,
  setIsMuted,
  setIsHeld,
  setClientError,
  resetCall,
} from '../../src/features/call/callSlice';
import { callStore } from '../../src/lib/call-store';

export const TelnyxRTCContext = createContext(null);

export function useTelnyxRTC() {
  return useContext(TelnyxRTCContext);
}

// Global ringtone singleton — persists across component mounts
let _ringtone = null;
let _ringtoneUnlocked = false;

function getRingtone() {
  if (!_ringtone && typeof window !== 'undefined') {
    _ringtone = new Audio('/sounds/ringtone.mp3');
    _ringtone.loop = true;
    _ringtone.volume = 0.8;
  }
  return _ringtone;
}

function unlockRingtone() {
  if (_ringtoneUnlocked) return;
  const audio = getRingtone();
  if (!audio) return;
  audio.play().then(() => {
    audio.pause();
    audio.currentTime = 0;
    _ringtoneUnlocked = true;
  }).catch(() => {});
}

// Unlock on any user interaction
if (typeof document !== 'undefined') {
  const handler = () => {
    unlockRingtone();
    if (_ringtoneUnlocked) {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', handler);
    }
  };
  document.addEventListener('click', handler);
  document.addEventListener('touchstart', handler);
  document.addEventListener('keydown', handler);
}

export function playRingtone() {
  try {
    const audio = getRingtone();
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  } catch { /* noop */ }
}

export function stopRingtone() {
  try {
    const audio = getRingtone();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  } catch { /* noop */ }
}

export default function TelnyxRTCWrapper({ children }) {
  const dispatch = useAppDispatch();
  const clientRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    let client = null;
    let destroyed = false;

    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/users/sip-credentials`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch SIP credentials');
        const data = await response.json();

        if (destroyed) return;

        client = new TelnyxRTC({
          login: data.sipUsername,
          password: data.sipPassword,
        });

        clientRef.current = client;
        callStore.setClient(client);

        // Connection events
        client.on('telnyx.ready', () => {
          if (destroyed) return;
          dispatch(setClientStatus('READY'));
          setReady(true);
          console.log('WebRTC client ready');
        });

        client.on('telnyx.error', (err) => {
          if (destroyed) return;
          let msg = err?.error?.message || err?.message || err?.toString() || 'Unknown error';
          if (/login incorrect|authentication|unauthorized|403|401/i.test(msg)) {
            msg += '. Check that the Telnyx API Key and Connection ID are configured correctly in Admin > Organization Settings.';
          }
          dispatch(setClientStatus('ERROR'));
          dispatch(setClientError(msg));
          console.error('WebRTC error:', err);
        });

        client.on('telnyx.socket.error', (err) => {
          if (destroyed) return;
          dispatch(setClientStatus('ERROR'));
          dispatch(setClientError('WebSocket connection failed'));
          console.error('WebRTC socket error:', err);
        });

        client.on('telnyx.socket.close', () => {
          if (destroyed) return;
          dispatch(setClientStatus('DISCONNECTED'));
          dispatch(setClientError('WebSocket connection closed'));
          console.log('WebRTC socket closed');
          // Attempt reconnect after delay
          setTimeout(() => {
            if (!destroyed && client) {
              try { client.connect(); } catch { /* noop */ }
            }
          }, 3000);
        });

        // Call notifications
        client.on('telnyx.notification', (notification) => {
          if (destroyed) return;
          if (notification.type === 'callUpdate') {
            const call = notification.call;
            const state = call.state.toUpperCase();
            console.log('Call state:', state);

            dispatch(setDirection(call.direction));

            if (state === 'RINGING') {
              dispatch(setCallState('INCOMING'));
              dispatch(setCallerInfo({
                name: call.options.remoteCallerName,
                number: call.options.remoteCallerNumber,
              }));
              dispatch(setFromNumber(call.options.remoteCallerNumber));
              callStore.setCall(call);
              playRingtone();
            } else if (state === 'ACTIVE') {
              stopRingtone();
              dispatch(setCallState('ACTIVE'));
              dispatch(setStartTime(Date.now()));
              dispatch(setCallerInfo({ number: call.options.remoteCallerNumber }));
              dispatch(setCallControlId(call.options.telnyxCallControlId));
              dispatch(setToNumber(call.options.destinationNumber));
              dispatch(setFromNumber(call.options.remoteCallerNumber));
              callStore.setCall(call);

              // Attach remote audio
              if (audioRef.current && call.remoteStream) {
                audioRef.current.srcObject = call.remoteStream;
              }
            } else if (state === 'HANGUP' || state === 'DESTROY') {
              stopRingtone();
              dispatch(resetCall());
              dispatch(setIsMuted(false));
              dispatch(setIsHeld(false));
              callStore.setCall(null);

              if (audioRef.current) {
                audioRef.current.srcObject = null;
              }
            }
          }
        });

        client.connect();
      } catch (err) {
        if (!destroyed) {
          console.error('Error initializing WebRTC:', err);
          setError(err.message);
          dispatch(setClientStatus('ERROR'));
          dispatch(setClientError(err.message));
        }
      } finally {
        if (!destroyed) setLoading(false);
      }
    };

    init();

    return () => {
      destroyed = true;
      if (client) {
        try { client.disconnect(); } catch { /* noop */ }
      }
      callStore.clear();
      clientRef.current = null;
    };
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-telnyx-green border-t-transparent mx-auto"></div>
          <p className="text-sm text-gray-400">Loading WebRTC credentials...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-400">Failed to load WebRTC: {error}</p>
      </div>
    );
  }

  return (
    <TelnyxRTCContext.Provider value={clientRef.current}>
      {children}
      {/* Global audio element for call audio on any page */}
      <audio ref={audioRef} autoPlay />
    </TelnyxRTCContext.Provider>
  );
}
