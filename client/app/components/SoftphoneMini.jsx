'use client';

import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../src/store/hooks';
import { dialDigit, backspace, clearDial } from '../../src/features/call/callSlice';
import { useCallStore, callStore } from '../../src/lib/call-store';
import { validatePhoneNumber, toE164, COUNTRY_CODES } from '../../src/lib/phone-utils';
import CircleButton from './CircleButton';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function SoftphoneMini({ onExpand }) {
  const dispatch = useAppDispatch();
  const { dialNumber, callState, isMuted, isHeld, startTime } = useAppSelector((s) => s.call);
  const { call } = useCallStore();
  const [duration, setDuration] = useState(0);
  const [countryCode, setCountryCode] = useState('+1');

  const isActive = callState === 'ACTIVE';
  const isInCall = ['ACTIVE', 'DIALING', 'INCOMING'].includes(callState);

  useEffect(() => {
    if (!startTime) { setDuration(0); return; }
    const tick = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [startTime]);

  const handleCall = () => {
    const client = callStore.getClient();
    if (!dialNumber || !client) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Microphone access requires HTTPS. Please use https:// or localhost.');
      return;
    }
    const fullNumber = toE164(dialNumber, countryCode);
    const validation = validatePhoneNumber(fullNumber);
    if (!validation.valid) return;
    client.newCall({
      destinationNumber: validation.formatted,
      clientState: 'VGVzdA==',
      debug: true,
    });
  };

  const handleHangUp = () => { if (call) call.hangup(); };
  const handleMute = () => { if (call) call.muteAudio(); };
  const handleUnmute = () => { if (call) call.unmuteAudio(); };
  const handleHold = () => { if (call) call.hold(); };
  const handleUnhold = () => { if (call) call.unhold(); };

  return (
    <div className="glass flex items-center gap-1.5 rounded-full px-2 py-1">
      {/* Country code + phone input (only when not in call) */}
      {!isInCall && (
        <>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="h-7 w-16 rounded-full bg-white/10 px-1 text-[11px] text-white outline-none border-none cursor-pointer"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code} className="bg-gray-900 text-white">{c.label}</option>
            ))}
          </select>
          <input
            type="tel"
            value={dialNumber}
            onChange={(e) => {
              dispatch(clearDial());
              // Strip + since country code dropdown handles it
              const cleaned = e.target.value.replace(/[^\d*#]/g, '');
              cleaned.split('').forEach((d) => dispatch(dialDigit(d)));
            }}
            placeholder="Number..."
            className="w-24 bg-transparent text-sm text-white placeholder-gray-400 outline-none font-mono"
          />
        </>
      )}

      {/* Duration badge when in call */}
      {isInCall && (
        <span className="font-mono text-xs text-telnyx-green-vibrant px-2">
          {callState === 'DIALING' ? 'Dialing...' : formatDuration(duration)}
        </span>
      )}

      {/* Action buttons */}
      {!isInCall ? (
        <CircleButton variant="green" size={32} onClick={handleCall} disabled={!dialNumber} title="Call">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </CircleButton>
      ) : (
        <>
          <CircleButton variant="red" size={32} onClick={handleHangUp} title="Hang Up">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L8.23 3.684A1 1 0 007.28 3H5z" />
            </svg>
          </CircleButton>
          <CircleButton
            variant={isMuted ? 'outline' : 'gray'}
            size={32}
            onClick={isMuted ? handleUnmute : handleMute}
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
            size={32}
            onClick={isHeld ? handleUnhold : handleHold}
            disabled={!isActive}
            title={isHeld ? 'Unhold' : 'Hold'}
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </CircleButton>
        </>
      )}

      {/* Expand button */}
      <CircleButton variant="outline" size={32} onClick={onExpand} title="Open Softphone">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </CircleButton>
    </div>
  );
}
