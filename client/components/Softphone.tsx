'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Phone number formatting ──────────────────────────────────────────
function fmtPhone(raw: string | undefined | null): string {
  if (!raw) return 'Unknown';
  const d = raw.replace(/[^+\d]/g, '');
  // +61XXXXXXXXXX → +61 X XXXX XXXX
  const auMobile = /^\+61(4\d{8})$/;
  const auLocal = /^\+61([02-9]\d{1,3})(\d{3})(\d{3,4})$/;
  const usLocal = /^\+1(\d{3})(\d{3})(\d{4})$/;
  if (auMobile.test(d)) return d.replace(auMobile, '+61 $1');
  if (auLocal.test(d)) return d.replace(auLocal, '+61 $1 $2 $3');
  if (usLocal.test(d)) return d.replace(usLocal, '+1 ($1) $2-$3');
  // Fallback: add space every 4 digits after the prefix
  if (d.startsWith('+')) return d.slice(0, 3) + ' ' + d.slice(3).replace(/(\d{4})(?=\d)/g, '$1 ');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}
import { motion, AnimatePresence } from 'framer-motion';
import { TelnyxRTC } from '@telnyx/webrtc';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  Phone,
  Volume2,
  Delete,
  AlertTriangle,
  X,
  RefreshCw,
  MicOff as MicUnavailable,
} from 'lucide-react';

// ── Ringtone (singleton — survives re-renders) ─────────────────────────
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

// Unlock on first user interaction so the ringtone can play without a gesture
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

function playRingtone() {
  try {
    const audio = getRingtone();
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  } catch { /* noop */ }
}

function stopRingtone() {
  try {
    const audio = getRingtone();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  } catch { /* noop */ }
}

const DTMF_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const DTMF_SUB = {
  '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL',
  '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ',
  '0': '+', '*': '•', '#': '⌗',
};

/**
 * Check whether the browser has a microphone available.
 * Returns true if at least one audioinput device is found.
 */
async function checkMediaDevices() {
  try {
    // Try getting permission first — enumerateDevices may not label devices
    // without a prior getUserMedia grant in some browsers.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately release the stream — we just wanted the permission check.
    stream.getTracks().forEach((t) => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    console.log('[mic-check] getUserMedia OK, devices:', devices.map(d => ({ kind: d.kind, label: d.label, id: d.deviceId })));
    const hasAudio = devices.some((d) => d.kind === 'audioinput');
    console.log('[mic-check] hasAudioinput:', hasAudio);
    return hasAudio;
  } catch (err: any) {
    // getUserMedia threw — either no device or permission denied
    console.warn('[mic-check] getUserMedia failed:', err.name, err.message);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('[mic-check] fallback devices:', devices.map(d => ({ kind: d.kind, label: d.label, id: d.deviceId })));
      const hasAudio = devices.some((d) => d.kind === 'audioinput' && d.label);
      console.log('[mic-check] fallback hasAudioinput:', hasAudio);
      return hasAudio;
    } catch (err2) {
      console.warn('[mic-check] enumerateDevices also failed:', err2);
      return false;
    }
  }
}

/**
 * Derive a human-friendly error message from a Telnyx RTC error.
 * The SDK sometimes fires `{}` (empty object) which is useless.
 */
function getErrorMessage(err, context = 'connecting') {
  // Empty object — no message, no code
  if (err && typeof err === 'object' && !err.message && !err.code && Object.keys(err).length === 0) {
    switch (context) {
      case 'connecting': return 'Could not reach SIP server. Check your network connection and try again.';
      case 'call':       return 'Call connection lost';
      default:           return 'Connection error';
    }
  }

  // MEDIA_DEVICE_NOT_FOUND / NotFoundError
  if (err?.name === 'NotFoundError' || err?.code === 'MEDIA_DEVICE_NOT_FOUND') {
    return 'Microphone not available — calls will connect but may not have audio.';
  }

  // NotAllowedError — permission denied
  if (err?.name === 'NotAllowedError') {
    return 'Microphone access denied. Please allow microphone permissions in your browser settings.';
  }

  // Has a message
  if (err?.message) return err.message;

  // String
  if (typeof err === 'string') return err;

  // Fallback
  switch (context) {
    case 'connecting': return 'Failed to connect to SIP server';
    case 'call':       return 'Call connection lost';
    default:           return 'Connection error';
  }
}

function AudioWaveform({ isActive }: { isActive: boolean }) {
  const bars = 24;
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-tx-green/60"
          animate={isActive ? {
            height: [4, 12 + Math.random() * 16, 6, 16 + Math.random() * 12, 4],
          } : { height: 4 }}
          transition={isActive ? {
            duration: 1.2 + Math.random() * 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.04,
          } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

function DialPad({ onDigit, onBackspace, value, onChange, compact = false }: { onDigit: (d: string) => void; onBackspace: () => void; value: string; onChange: (v: string) => void; compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Display */}
      <div className="relative w-full">
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter number"
          className="w-full bg-transparent text-center text-2xl py-2 font-light text-tx-tp tracking-[0.15em] placeholder-tx-tt focus:outline-none"
        />
        {value && (
          <button
            onClick={onBackspace}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors"
          >
            <Delete className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Numpad — round buttons like a real phone */}
      <div className="grid grid-cols-3 gap-3">
        {DTMF_KEYS.flat().map((key) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.06 }}
            onClick={() => onDigit(key)}
            className="numpad-btn w-14 h-14 rounded-full bg-tx-s3 border border-tx-bdefault/40 hover:border-tx-bdefault hover:bg-tx-s3/80 transition-all duration-150 flex flex-col items-center justify-center"
          >
            <span className="text-lg font-medium text-tx-tp leading-none">{key}</span>
            {DTMF_SUB[key] && (
              <span className="text-[8px] tracking-[0.15em] text-tx-ts mt-0.5 leading-none">{DTMF_SUB[key]}</span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/**
 * Error panel — inline, dismissable, contextual.
 */
function ErrorPanel({ message, onDismiss, onRetry }: { message: string; onDismiss?: () => void; onRetry?: () => void }) {
  const isMicError = message?.toLowerCase().includes('microphone') || message?.toLowerCase().includes('no mic');
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-xl border px-4 py-3.5 ${
        isMicError
          ? 'bg-tx-citron/10 border-tx-citron/20'
          : 'bg-tx-red/10 border-tx-red/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isMicError ? 'text-tx-citron' : 'text-tx-red'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isMicError ? 'text-tx-citron' : 'text-red-300'}`}>
            {message}
          </p>
          {isMicError && (
            <p className="text-xs text-tx-citron/60 mt-1">
              You can still make calls but audio may not work. Allow mic access in browser settings.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onRetry && (
            <button
              onClick={onRetry}
              className="p-1 rounded-lg hover:bg-tx-s3 text-tx-ts hover:text-tx-tp transition-colors"
              title="Retry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-tx-s3 text-tx-ts hover:text-tx-tp transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Elite WebRTC Softphone
 */
export default function Softphone({ sipConfig, onCallStateChange, onIncomingCall, onCallStart, onCallEnd, compact = false, isInternal = false }: { sipConfig?: any; onCallStateChange?: (state: string) => void; onIncomingCall?: (call: any) => void; onCallStart?: (call: any) => void; onCallEnd?: (call: any) => void; compact?: boolean; isInternal?: boolean }) {
  const clientRef = useRef(null);
  const currentCallRef = useRef(null);
  const [callState, setCallState] = useState<string>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isOnHold, setIsOnHold] = useState<boolean>(false);
  const [callerInfo, setCallerInfo] = useState<any>(null);
  const [dialNumber, setDialNumber] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [showDialPad, setShowDialPad] = useState<boolean>(true);
  const [hasMic, setHasMic] = useState<boolean | null>(null); // null = not checked yet
  const [micCheckDone, setMicCheckDone] = useState<boolean>(false);
  const timerRef = useRef(null);
  const callDirectionRef = useRef('inbound');
  const callStartRef = useRef(null);
  const callDurationRef = useRef(0);

  // Ref mirrors — the `telnyx.notification` handler is registered once when
  // `sipConfig` changes, so its closure captures the original values of
  // `callerInfo` and `callState`. Mirror them into refs so the handler always
  // sees the latest values.
  const callerInfoRef = useRef(null);
  const callStateRef = useRef('idle');
  const connectingRef = useRef(false);
  useEffect(() => { callerInfoRef.current = callerInfo; }, [callerInfo]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { connectingRef.current = connecting; }, [connecting]);

  // ── Microphone check ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    checkMediaDevices().then((result) => {
      if (!cancelled) {
        setHasMic(result);
        setMicCheckDone(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Start call timer
  useEffect(() => {
    if (callState === 'active') {
      callStartRef.current = callStartRef.current || new Date().toISOString();
      timerRef.current = setInterval(() => {
        setCallDuration((d) => {
          const next = d + 1;
          callDurationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      if (callState === 'idle' || callState === 'ended') {
        setCallDuration(0);
        callDurationRef.current = 0;
        callStartRef.current = null;
      }
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  // Connect to Telnyx WebRTC
  useEffect(() => {
    if (!sipConfig?.sipUsername || !sipConfig?.sipPassword) return;
    if (clientRef.current) return;

    const client = new TelnyxRTC({
      login: sipConfig.sipUsername,
      password: sipConfig.sipPassword,
      debug: process.env.NODE_ENV === 'development',
    });

    // Debug: log SIP connection details (mask password)
    console.log('[softphone] Connecting TelnyxRTC:', {
      login: sipConfig.sipUsername,
      password: sipConfig.sipPassword ? '***' : '(empty)',
      sdkVersion: '@telnyx/webrtc@2.26.4',
    });

    client.on('telnyx.notification', (notification) => {
      const call = notification.call;
      if (notification.type === 'callUpdate' || call) {
        const state = call?.state;
        switch (state) {
          case 'ringing':
          case 'alerting': {
            currentCallRef.current = call;
            const info = {
              from: call.options?.callerName || call.options?.callerNumber || 'Unknown',
              to: call.options?.destinationNumber || '',
            };
            callerInfoRef.current = info;
            setCallState('ringing');
            setCallerInfo(info);
            onIncomingCall?.(call);
            // Play ringtone for incoming calls
            if (call?.direction !== 'outbound') playRingtone();
            break;
          }
          case 'active': {
            stopRingtone();
            setCallState('active');
            setIsMuted(false);
            setIsOnHold(false);
            setError(null); // clear any stale error once call is live
            onCallStateChange?.('active');
            const info = callerInfoRef.current;
            onCallStart?.({
              from: info?.from || call?.options?.callerName || call?.options?.callerNumber || 'Unknown',
              to: info?.to || call?.options?.destinationNumber || '',
              direction: callDirectionRef.current || 'inbound',
              startedAt: new Date().toISOString(),
            });
            break;
          }
          case 'held':
            setCallState('held');
            setIsOnHold(true);
            onCallStateChange?.('held');
            break;
          case 'hangup':
          case 'destroy': {
            stopRingtone();
            setCallState('ended');
            setIsMuted(false);
            setIsOnHold(false);
            const info = callerInfoRef.current;
            onCallEnd?.({
              from: info?.from || 'Unknown',
              to: info?.to || '',
              direction: callDirectionRef.current || 'inbound',
              duration: callDurationRef.current,
              startedAt: callStartRef.current,
              endedAt: new Date().toISOString(),
            });
            callerInfoRef.current = null;
            setCallerInfo(null);
            currentCallRef.current = null;
            onCallStateChange?.('ended');
            setTimeout(() => setCallState('idle'), 2000);
            break;
          }
        }
      }
    });

    client.on('telnyx.error', (err) => {
      console.error('[softphone] Telnyx RTC error:', err);
      console.error('[softphone] Error details:', JSON.stringify(err, null, 2));
      console.error('[softphone] Current state:', { callState: callStateRef.current, connecting: connectingRef.current });

      const currentState = callStateRef.current;
      let context = 'connecting';
      if (currentState === 'ringing' || currentState === 'active') context = 'call';

      const msg = getErrorMessage(err, context);
      setError(msg);
      setConnecting(false);
    });

    client.on('telnyx.socket.open', () => {
      console.log('[softphone] WebSocket connected to Telnyx signaling server');
      setConnecting(false);
      setError(null);
    });
    client.on('telnyx.socket.close', (event) => {
      console.warn('[softphone] WebSocket closed:', event);
    });

    setConnecting(true);
    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [sipConfig]);

  const answerCall = useCallback(() => {
    currentCallRef.current?.answer();
    setCallState('active');
    callDirectionRef.current = 'inbound';
    callStartRef.current = new Date().toISOString();
    onCallStateChange?.('active');
  }, [onCallStateChange]);

  const hangupCall = useCallback(() => {
    stopRingtone();
    currentCallRef.current?.hangup();
    setCallState('ended');
    onCallStateChange?.('ended');
  }, [onCallStateChange]);

  const makeCall = useCallback(() => {
    if (!dialNumber || !clientRef.current) return;

    // Pre-flight mic check (non-blocking — warn but allow the call attempt)
    if (hasMic === false) {
      console.warn('No microphone detected — call may not have audio. Attempting anyway.');
    }

    callDirectionRef.current = 'outbound';
    callStartRef.current = new Date().toISOString();

    const call = clientRef.current.newCall({
      destinationNumber: dialNumber,
      callerName: sipConfig?.sipUsername || 'Agent',
    });
    currentCallRef.current = call;
    setCallState('ringing');
    setCallerInfo({ from: sipConfig?.sipUsername, to: dialNumber });
    setError(null);
  }, [dialNumber, sipConfig, hasMic]);

  const toggleMute = useCallback(() => {
    const call = currentCallRef.current;
    if (!call) return;
    if (isMuted) { call.unmute(); setIsMuted(false); }
    else { call.mute(); setIsMuted(true); }
  }, [isMuted]);

  const toggleHold = useCallback(() => {
    const call = currentCallRef.current;
    if (!call) return;
    if (isOnHold) { call.unhold(); setIsOnHold(false); }
    else { call.hold(); setIsOnHold(true); }
  }, [isOnHold]);

  const handleDtmf = useCallback((digit) => {
    const call = currentCallRef.current;
    if (call && callState === 'active') {
      call.dtmf(digit);
    }
    setDialNumber(prev => prev + digit);
  }, [callState]);

  const handleBackspace = useCallback(() => {
    setDialNumber(prev => prev.slice(0, -1));
  }, []);

  const retryConnection = useCallback(() => {
    setError(null);
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    // The useEffect will re-connect on next render since clientRef is null
    setConnecting(true);
    // Force re-render to trigger the connection useEffect
    // by temporarily nulling sipConfig trigger — instead, we reconnect directly:
    if (sipConfig?.sipUsername && sipConfig?.sipPassword) {
      const client = new TelnyxRTC({
        login: sipConfig.sipUsername,
        password: sipConfig.sipPassword,
      });

      client.on('telnyx.notification', (notification) => {
        const call = notification.call;
        if (notification.type === 'callUpdate' || call) {
          const state = call?.state;
          switch (state) {
            case 'ringing':
            case 'alerting': {
              currentCallRef.current = call;
              const info = {
                from: call.options?.callerName || call.options?.callerNumber || 'Unknown',
                to: call.options?.destinationNumber || '',
              };
              callerInfoRef.current = info;
              setCallState('ringing');
              setCallerInfo(info);
              onIncomingCall?.(call);
              if (call?.direction !== 'outbound') playRingtone();
              break;
            }
            case 'active': {
              stopRingtone();
              setCallState('active');
              setIsMuted(false);
              setIsOnHold(false);
              setError(null);
              onCallStateChange?.('active');
              const info = callerInfoRef.current;
              onCallStart?.({
                from: info?.from || call?.options?.callerName || call?.options?.callerNumber || 'Unknown',
                to: info?.to || call?.options?.destinationNumber || '',
                direction: callDirectionRef.current || 'inbound',
                startedAt: new Date().toISOString(),
              });
              break;
            }
            case 'held':
              setCallState('held');
              setIsOnHold(true);
              onCallStateChange?.('held');
              break;
            case 'hangup':
            case 'destroy': {
              stopRingtone();
              setCallState('ended');
              setIsMuted(false);
              setIsOnHold(false);
              const info = callerInfoRef.current;
              onCallEnd?.({
                from: info?.from || 'Unknown',
                to: info?.to || '',
                direction: callDirectionRef.current || 'inbound',
                duration: callDurationRef.current,
                startedAt: callStartRef.current,
                endedAt: new Date().toISOString(),
              });
              callerInfoRef.current = null;
              setCallerInfo(null);
              currentCallRef.current = null;
              onCallStateChange?.('ended');
              setTimeout(() => setCallState('idle'), 2000);
              break;
            }
          }
        }
      });

      client.on('telnyx.error', (err) => {
        console.error('[softphone] Retry RTC error:', err);
        console.error('[softphone] Error details:', JSON.stringify(err, null, 2));
        const msg = getErrorMessage(err, 'connecting');
        setError(msg);
        setConnecting(false);
      });

      client.on('telnyx.socket.open', () => {
        setConnecting(false);
        setError(null);
      });
      client.on('telnyx.socket.close', () => {});

      setConnecting(true);
      client.connect();
      clientRef.current = client;
    }
  }, [sipConfig, onCallStateChange, onIncomingCall]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className={`relative flex flex-col ${compact ? "" : "h-full"}`}>
      <AnimatePresence mode="wait">
        {/* ── IDLE: Dial Pad ────────────────────────────────── */}
        {callState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            {/* SIP Status */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${sipConfig ? 'bg-tx-green shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-tx-s3'}`} />
              <span className="text-xs text-tx-ts font-medium">
                {connecting ? 'Connecting...' : sipConfig ? 'SIP Connected' : 'No SIP Config'}
              </span>
            </div>

            {/* Mic warning — non-blocking, shown in idle state when no mic detected */}
            {micCheckDone && hasMic === false && (
              <div className="px-4 mb-3">
                <div className="bg-tx-citron/10 border border-tx-citron/15 rounded-xl px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-tx-citron font-medium">
                    <Mic className="w-4 h-4" />
                    No microphone detected
                  </div>
                  <p className="text-tx-citron/60 text-xs mt-1">
                    Calls will work but you won't have audio. Allow mic access in browser settings or connect a mic.
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col justify-center px-6 pb-2">
              <DialPad
                onDigit={handleDtmf}
                onBackspace={handleBackspace}
                value={dialNumber}
                onChange={setDialNumber}
                compact={compact}
              />
            </div>

            {/* Call button */}
            <div className="px-6 pb-4 pt-2 flex justify-center">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={makeCall}
                disabled={!dialNumber || connecting}
                className="w-14 h-14 rounded-full gradient-success text-tx-tp shadow-lg shadow-tx-green/20 hover:shadow-tx-green/40 transition-shadow disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <PhoneOutgoing className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── RINGING: Incoming Call ────────────────────────── */}
        {callState === 'ringing' && (
          <motion.div
            key="ringing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center px-6"
          >
            {/* Pulsing ring */}
            <div className="relative mb-8">
              <div className="absolute inset-0 w-28 h-28 rounded-full bg-tx-green/20 incoming-ring" />
              <div className="absolute inset-2 w-24 h-24 rounded-full bg-tx-green/10" />
              <motion.div
                animate={{ rotate: [0, 15, -15, 10, -10, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.5 }}
                className="relative w-20 h-20 rounded-2xl gradient-success flex items-center justify-center shadow-xl shadow-tx-green/30"
              >
                <PhoneIncoming className="w-8 h-8 text-tx-tp" />
              </motion.div>
            </div>

            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-tx-green text-sm font-medium mb-2"
            >
              {isInternal ? '📞 Internal Call' : 'Incoming Call'}
            </motion.p>

            <p className="text-xl font-semibold text-tx-tp mb-1">
              {fmtPhone(callerInfo?.from)}
            </p>
            {callerInfo?.to && (
              <p className="text-sm text-tx-ts mb-8">to {fmtPhone(callerInfo.to)}</p>
            )}

            {/* Answer / Decline */}
            <div className="flex items-center gap-6">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={answerCall}
                className="w-16 h-16 rounded-full gradient-success flex items-center justify-center shadow-xl shadow-tx-green/30 glow-green"
              >
                <Phone className="w-6 h-6 text-tx-tp" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={hangupCall}
                className="w-16 h-16 rounded-full gradient-danger flex items-center justify-center shadow-xl shadow-tx-red/30 glow-red"
              >
                <PhoneOff className="w-6 h-6 text-tx-tp" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── ACTIVE: On Call ────────────────────────────────── */}
        {callState === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            {/* Caller info + duration — hidden in compact mode (CallHero shows it) */}
            {!compact && (
              <div className="text-center px-6 pt-6 pb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-lg shadow-tx-green/25 mb-4">
                  <Phone className="w-7 h-7 text-tx-tp" />
                </div>

                <AudioWaveform isActive={true} />

                <p className="text-lg font-semibold text-tx-tp mt-4 mb-0.5">
                  {fmtPhone(callerInfo?.from)}
                </p>
                {callerInfo?.to && (
                  <p className="text-sm text-tx-ts">to {fmtPhone(callerInfo.to)}</p>
                )}

                <motion.p
                  className="text-3xl font-mono font-light text-tx-green mt-3 tracking-wider"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {formatDuration(callDuration)}
                </motion.p>

                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="w-2 h-2 rounded-full bg-tx-green live-dot" />
                  <span className="text-xs text-tx-green font-medium">{isInternal ? 'Internal Call' : 'Active'}</span>
                </div>
              </div>
            )}

            {/* DTMF Pad (collapsed) */}
            <div className="flex-1 flex flex-col justify-end px-4 pb-2">
              <AnimatePresence>
                {showDialPad && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-2 justify-items-center py-3">
                      {DTMF_KEYS.flat().map((key) => (
                        <motion.button
                          key={key}
                          whileTap={{ scale: 0.85 }}
                          whileHover={{ scale: 1.06 }}
                          onClick={() => currentCallRef.current?.dtmf(key)}
                          className="numpad-btn w-11 h-11 rounded-full bg-tx-s3 border border-tx-bdefault/30 hover:border-tx-bdefault transition-all duration-150 flex flex-col items-center justify-center"
                        >
                          <span className="text-sm font-medium text-tx-tp leading-none">{key}</span>
                          {DTMF_SUB[key] && (
                            <span className="text-[7px] tracking-[0.12em] text-tx-ts leading-none mt-px">{DTMF_SUB[key]}</span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Call controls */}
            <div className="px-6 pb-6 pt-3">
              <div className={`flex items-center justify-center ${compact ? 'gap-3' : 'gap-4'}`}>
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={toggleMute}
                  className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    isMuted
                      ? 'bg-tx-red/20 text-tx-red border border-tx-red/20 shadow-lg shadow-tx-red/10'
                      : 'bg-tx-s3 text-tx-ts border border-tx-bdefault hover:bg-tx-s3 hover:text-tx-tp'
                  }`}
                >
                  {isMuted ? <MicOff className={compact ? 'w-4 h-4' : 'w-5 h-5'} /> : <Mic className={compact ? 'w-4 h-4' : 'w-5 h-5'} />}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={toggleHold}
                  className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    isOnHold
                      ? 'bg-tx-citron/20 text-tx-citron border border-tx-citron/20 shadow-lg shadow-tx-citron/10'
                      : 'bg-tx-s3 text-tx-ts border border-tx-bdefault hover:bg-tx-s3 hover:text-tx-tp'
                  }`}
                >
                  {isOnHold ? <Play className={compact ? 'w-4 h-4' : 'w-5 h-5'} /> : <Pause className={compact ? 'w-4 h-4' : 'w-5 h-5'} />}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setShowDialPad(!showDialPad)}
                  className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    showDialPad
                      ? 'bg-tx-green/20 text-tx-green border border-tx-green/20'
                      : 'bg-tx-s3 text-tx-ts border border-tx-bdefault hover:bg-tx-s3 hover:text-tx-tp'
                  }`}
                >
                  <Volume2 className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={hangupCall}
                  className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded-full gradient-danger flex items-center justify-center shadow-xl shadow-tx-red/25`}
                >
                  <PhoneOff className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── HELD ────────────────────────────────────────── */}
        {callState === 'held' && (
          <motion.div
            key="held"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center px-6"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-tx-citron to-tx-citron/70 flex items-center justify-center shadow-tx-lg mb-6"
            >
              <Pause className="w-8 h-8 text-tx-tp" />
            </motion.div>

            <p className="text-tx-citron text-sm font-medium mb-1">On Hold</p>
            <p className="text-lg font-semibold text-tx-tp mb-6">
              {fmtPhone(callerInfo?.from)}
            </p>
            <p className="text-2xl font-mono font-light text-tx-citron/80 tracking-wider mb-8">
              {formatDuration(callDuration)}
            </p>

            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={toggleHold}
                className="w-14 h-14 rounded-2xl bg-tx-citron/20 text-tx-citron border border-tx-citron/20 flex items-center justify-center"
              >
                <Play className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={hangupCall}
                className="w-16 h-16 rounded-full gradient-danger flex items-center justify-center shadow-xl shadow-tx-red/25"
              >
                <PhoneOff className="w-6 h-6 text-tx-tp" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── ENDED ────────────────────────────────────────── */}
        {callState === 'ended' && (
          <motion.div
            key="ended"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 rounded-2xl bg-tx-s3 border border-tx-bdefault flex items-center justify-center mb-4"
            >
              <PhoneOff className="w-7 h-7 text-tx-ts" />
            </motion.div>
            <p className="text-tx-ts font-medium">Call Ended</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error panel (inline, dismissable) ──────────────── */}
      {/*
        Render the error regardless of call state so a mic-permission revoke,
        SIP socket drop, or ICE failure during ringing/active is visible.
        During an active/ringing call the panel floats as an overlay so it
        doesn't block the call controls.
      */}
      <AnimatePresence>
        {error && (callState === 'idle' || callState === 'ended') && (
          <div className="px-4 pb-4">
            <ErrorPanel
              message={error}
              onDismiss={() => setError(null)}
              onRetry={retryConnection}
            />
          </div>
        )}
        {error && (callState === 'ringing' || callState === 'active' || callState === 'held') && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3">
            <div className="pointer-events-auto">
              <ErrorPanel
                message={error}
                onDismiss={() => setError(null)}
                onRetry={retryConnection}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
