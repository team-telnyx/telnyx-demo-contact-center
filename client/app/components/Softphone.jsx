'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Draggable from 'react-draggable';
import { useAppSelector, useAppDispatch } from '../../src/store/hooks';
import {
  dialDigit,
  backspace,
  clearDial,
  setIsMuted,
  setIsHeld,
} from '../../src/features/call/callSlice';
import { useCallStore, callStore } from '../../src/lib/call-store';
import { playDTMF } from '../../src/lib/dtmf';
import { validatePhoneNumber, toE164, COUNTRY_CODES } from '../../src/lib/phone-utils';
import CircleButton from './CircleButton';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Softphone({ open, onClose }) {
  const dispatch = useAppDispatch();
  const { dialNumber, callState, clientStatus, isMuted, isHeld, startTime, callerInfo, callerNumber } =
    useAppSelector((s) => s.call);
  const { call } = useCallStore();

  const [duration, setDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [countryCode, setCountryCode] = useState('+1');
  const [dialError, setDialError] = useState('');
  const nodeRef = useRef(null);

  const isActive = callState === 'ACTIVE';
  const isInCall = ['ACTIVE', 'DIALING', 'INCOMING'].includes(callState);

  // Duration timer
  useEffect(() => {
    if (!startTime) { setDuration(0); return; }
    const tick = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [startTime]);

  // Call stats polling
  useEffect(() => {
    if (!isActive || !showStats || !call) return;
    const poll = setInterval(async () => {
      try {
        if (call.getStats) {
          const report = await call.getStats();
          setStats(report);
        }
      } catch { /* noop */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [isActive, showStats, call]);

  const handleDialKey = useCallback(
    (key) => {
      playDTMF(key);
      dispatch(dialDigit(key));
      if (isActive && call && call.dtmf) {
        call.dtmf(key);
      }
    },
    [dispatch, isActive, call]
  );

  const handleCall = () => {
    const client = callStore.getClient();
    if (!dialNumber || !client) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setDialError('Microphone requires HTTPS. Use https:// or localhost.');
      return;
    }

    // Format and validate — country code dropdown always prepends
    const fullNumber = toE164(dialNumber, countryCode);
    const validation = validatePhoneNumber(fullNumber);
    if (!validation.valid) {
      setDialError(validation.error);
      return;
    }
    setDialError('');

    const opts = {
      destinationNumber: validation.formatted,
      clientState: 'VGVzdA==',
      debug: true,
    };
    if (callerNumber) opts.callerNumber = callerNumber;
    client.newCall(opts);
  };

  const handleAnswer = () => { if (call) call.answer(); };
  const handleHangUp = () => { if (call) call.hangup(); };

  const handleMuteToggle = () => {
    if (!call) return;
    if (isMuted) { call.unmuteAudio(); dispatch(setIsMuted(false)); }
    else { call.muteAudio(); dispatch(setIsMuted(true)); }
  };

  const handleHoldToggle = () => {
    if (!call) return;
    if (isHeld) { call.unhold(); dispatch(setIsHeld(false)); }
    else { call.hold(); dispatch(setIsHeld(true)); }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <Draggable handle=".drag-handle" bounds="parent" nodeRef={nodeRef}>
      <div
        ref={nodeRef}
        className="fixed right-6 top-20 z-[1400] w-80 rounded-card glass-dark shadow-2xl"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {/* Header / drag handle */}
        <div className="drag-handle flex cursor-move items-center justify-between rounded-t-card px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-telnyx-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-sm font-semibold text-white">Softphone</span>
            {/* Status chip */}
            <span className={`ml-1 inline-block h-2 w-2 rounded-full ${
              clientStatus === 'READY' ? 'bg-telnyx-green-vibrant' :
              clientStatus === 'ERROR' ? 'bg-red-500' : 'bg-yellow-400 status-pulse'
            }`} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {/* Active call display */}
          {isInCall ? (
            <div className="text-center py-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                {callState === 'INCOMING' ? 'Incoming Call' : callState === 'DIALING' ? 'Dialing...' : 'Active Call'}
              </p>
              <p className="text-lg font-mono text-white mt-1">
                {callerInfo?.name || callerInfo?.number || dialNumber || 'Unknown'}
              </p>
              {callerInfo?.name && callerInfo?.number && (
                <p className="text-xs text-gray-400 font-mono">{callerInfo.number}</p>
              )}
              {isActive && (
                <p className="text-2xl font-mono text-telnyx-green-vibrant mt-2">{formatDuration(duration)}</p>
              )}
            </div>
          ) : (
            <>
              {/* Country code + phone number input */}
              <div className="flex gap-1.5">
                <select
                  value={countryCode}
                  onChange={(e) => { setCountryCode(e.target.value); setDialError(''); }}
                  className="w-20 rounded-btn bg-white/10 px-2 py-3 text-sm text-white outline-none border border-white/10 focus:border-telnyx-green/50 transition-colors"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-gray-900">{c.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={dialNumber}
                  onChange={(e) => {
                    setDialError('');
                    dispatch(clearDial());
                    // Strip + since country code dropdown handles it
                    e.target.value.replace(/[^\d*#]/g, '').split('').forEach((d) => dispatch(dialDigit(d)));
                  }}
                  placeholder="Phone number"
                  className={`flex-1 rounded-btn bg-white/10 px-3 py-3 text-center font-mono text-lg text-white placeholder-gray-500 outline-none border transition-colors ${
                    dialError ? 'border-red-400/60' : 'border-white/10 focus:border-telnyx-green/50'
                  }`}
                />
              </div>
              {dialError && (
                <p className="text-[11px] text-red-400 px-1">{dialError}</p>
              )}
            </>
          )}

          {/* Call controls */}
          <div className="flex items-center justify-center gap-3">
            {callState === 'INCOMING' ? (
              <>
                <CircleButton variant="green" size={48} onClick={handleAnswer} title="Answer" pulse>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </CircleButton>
                <CircleButton variant="red" size={48} onClick={handleHangUp} title="Decline">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L8.23 3.684A1 1 0 007.28 3H5z" />
                  </svg>
                </CircleButton>
              </>
            ) : isInCall ? (
              <>
                <CircleButton variant="red" size={48} onClick={handleHangUp} title="Hang Up">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L8.23 3.684A1 1 0 007.28 3H5z" />
                  </svg>
                </CircleButton>
                <CircleButton
                  variant={isMuted ? 'outline' : 'gray'}
                  size={48}
                  onClick={handleMuteToggle}
                  disabled={!isActive}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {isMuted ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    )}
                  </svg>
                </CircleButton>
                <CircleButton
                  variant={isHeld ? 'outline' : 'gray'}
                  size={48}
                  onClick={handleHoldToggle}
                  disabled={!isActive}
                  title={isHeld ? 'Unhold' : 'Hold'}
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </CircleButton>
              </>
            ) : (
              <CircleButton variant="green" size={48} onClick={handleCall} disabled={!dialNumber} title="Call">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </CircleButton>
            )}
          </div>

          {/* Collapsible DTMF Keypad */}
          <div>
            <button
              onClick={() => setShowKeypad(!showKeypad)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <svg className={`h-3 w-3 transition-transform ${showKeypad ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Keypad
            </button>
            {showKeypad && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {DIAL_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleDialKey(key)}
                    className="rounded-btn py-2.5 text-base font-medium text-white bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors"
                  >
                    {key}
                  </button>
                ))}
                <button
                  onClick={() => dispatch(backspace())}
                  className="col-span-2 rounded-btn py-2 text-xs text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Backspace
                </button>
                <button
                  onClick={() => dispatch(clearDial())}
                  className="rounded-btn py-2 text-xs text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Collapsible call quality stats */}
          {isActive && (
            <div>
              <button
                onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <svg className={`h-3 w-3 transition-transform ${showStats ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Call Stats
              </button>
              {showStats && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {stats ? (
                    <>
                      <StatItem label="Codec" value={stats.codec || '—'} />
                      <StatItem label="Packet Loss" value={stats.packetsLost != null ? `${stats.packetsLost}` : '—'} />
                      <StatItem label="Jitter" value={stats.jitter != null ? `${Math.round(stats.jitter * 1000)}ms` : '—'} />
                      <StatItem label="RTT" value={stats.rtt != null ? `${Math.round(stats.rtt)}ms` : '—'} />
                    </>
                  ) : (
                    <p className="col-span-2 text-gray-500">Gathering stats...</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Draggable>,
    document.body
  );
}

function StatItem({ label, value }) {
  return (
    <div className="rounded bg-white/5 px-2 py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="ml-1 text-gray-200">{value}</span>
    </div>
  );
}
