'use client';

/**
 * CallHero — the dominant card on the Phone page.
 *
 * Wraps the Softphone (which owns the WebRTC engine + call controls + dial
 * pad) in premium chrome. Adds rich caller context, animated waveform, and
 * an idle "Ready for calls" empty state badge.
 *
 * IMPORTANT: We do NOT replace Softphone's controls — it remains the source
 * of truth for mute/hold/hangup/DTMF. We only add the framing.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Radio,
  Sparkles,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import Waveform from './Waveform';
import AnimatedNumber from './AnimatedNumber';

function fmtPhone(raw: string | undefined | null): string {
  if (!raw) return 'Unknown';
  const d = raw.replace(/[^+\d]/g, '');
  const auMobile = /^\+61(4\d{8})$/;
  const auLocal = /^\+61([02-9]\d{1,3})(\d{3})(\d{3,4})$/;
  const usLocal = /^\+1(\d{3})(\d{3})(\d{4})$/;
  if (auMobile.test(d)) return d.replace(auMobile, '+61 $1');
  if (auLocal.test(d)) return d.replace(auLocal, '+61 $1 $2 $3');
  if (usLocal.test(d)) return d.replace(usLocal, '+1 ($1) $2-$3');
  if (d.startsWith('+')) return d.slice(0, 3) + ' ' + d.slice(3).replace(/(\d{4})(?=\d)/g, '$1 ');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function fmtDuration(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function CallStatePill({ callState, direction }: { callState: string; direction?: string }) {
  if (callState === 'active') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tx-green/10 border border-tx-green/20 text-tx-green">
        <span className="w-1.5 h-1.5 rounded-full bg-tx-green live-dot" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">In call</span>
      </div>
    );
  }
  if (callState === 'ringing' || callState === 'incoming') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tx-green/10 border border-tx-green/20 text-tx-green">
        <PhoneIncoming className="w-3 h-3" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Incoming</span>
      </div>
    );
  }
  if (callState === 'dialing' || direction === 'outbound') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tx-blue/10 border border-tx-blue/20 text-tx-blue">
        <PhoneOutgoing className="w-3 h-3" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Dialing</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tx-s3 border border-tx-bdefault text-tx-ts">
      <span className="w-1.5 h-1.5 rounded-full bg-tx-tt" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Ready</span>
    </div>
  );
}

interface ActiveCall {
  from?: string;
  to?: string;
  queueName?: string;
  direction?: string;
  startedAt?: string;
}

export default function CallHero({
  callState = 'idle',
  activeCall,
  duration = 0,
  children,
}: {
  callState?: string;
  activeCall?: ActiveCall | null;
  duration?: number;
  children?: React.ReactNode;
}) {
  const isActive = callState === 'active' || callState === 'ringing' || callState === 'dialing';
  const heroGlow = callState === 'active'
    ? 'hero-glow-active'
    : (callState === 'ringing' ? 'hero-glow-incoming' : '');

  const callerLabel = fmtPhone(activeCall?.from || activeCall?.to);
  const direction = activeCall?.direction;

  // Animated ring colour for the avatar on active calls
  const ringClass = callState === 'active'
    ? 'ring-2 ring-tx-green/40 ring-offset-2 ring-offset-tx-s2'
    : callState === 'ringing'
      ? 'ring-2 ring-tx-citron/40 ring-offset-2 ring-offset-tx-s2'
      : '';

  /* Duration pulse on minute boundaries */
  const [durationPulse, setDurationPulse] = useState(false);
  const prevMinuteRef = useRef(0);
  useEffect(() => {
    const currentMinute = Math.floor(duration / 60);
    if (currentMinute !== prevMinuteRef.current && prevMinuteRef.current !== 0) {
      setDurationPulse(true);
      const timer = setTimeout(() => setDurationPulse(false), 600);
      return () => clearTimeout(timer);
    }
    prevMinuteRef.current = currentMinute;
  }, [duration]);

  return (
    <div className={`relative rounded-2xl overflow-hidden transition-shadow duration-500 ${heroGlow}`}>
      {/* Animated gradient border when call is active */}
      {callState === 'active' && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none z-0">
          <div className="absolute inset-0 rounded-2xl border-2 border-tx-green/30 hero-gradient-border" />
        </div>
      )}
      <div className="relative z-10">
      {/* Top band — context strip */}
      <div className="px-5 pt-4 pb-3 border-b border-tx-bsubtle bg-tx-s2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-tx-sm flex-shrink-0">
              <Phone className="w-3.5 h-3.5 text-tx-ti" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-tx-tt uppercase tracking-[0.12em]">
                Softphone
              </p>
              <p className="text-[13px] font-semibold text-tx-tp truncate">
                {isActive ? 'Active session' : 'Ready for calls'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-tx-s1 border border-tx-bsubtle text-[10px] font-medium text-tx-tt">
              <ShieldCheck className="w-3 h-3 text-tx-green" />
              <span>WebRTC · WSS</span>
            </div>
            <CallStatePill callState={callState} direction={direction} />
          </div>
        </div>
      </div>

      {/* Active call banner — rich caller info + waveform */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pt-4 pb-3 border-b border-tx-bsubtle bg-gradient-to-b from-tx-green/[0.04] via-transparent to-transparent">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <motion.div
                  initial={{ scale: 0.85 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex-shrink-0"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-tx-ti shadow-tx-lg ${
                    callState === 'active'
                      ? 'bg-gradient-to-br from-tx-green to-tx-green-dark'
                      : 'bg-gradient-to-br from-tx-green-dark to-tx-citron'
                  } ${ringClass}`}>
                    {(callerLabel || '?').replace(/[^\w]/g, '').slice(0, 2).toUpperCase() || <Phone className="w-5 h-5" />}
                  </div>
                  {callState === 'active' && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-tx-green border-2 border-tx-s2 orb-pulse" style={{ '--orb-color': 'rgba(99,102,241,0.5)' }} />
                  )}
                </motion.div>

                {/* Caller details */}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-tx-green/70 uppercase tracking-[0.12em] mb-0.5">
                    {direction === 'outbound' ? 'Outbound Call' : 'Inbound Call'}
                    {activeCall?.queueName && <span className="text-tx-tt"> · via {activeCall.queueName.replace(/_/g, ' ')}</span>}
                  </p>
                  <h2 className="text-xl font-bold text-tx-tp tracking-tight truncate tnum">
                    {callerLabel}
                  </h2>
                  {activeCall?.to && activeCall?.from && direction === 'outbound' && (
                    <p className="text-[12px] text-tx-tt mt-0.5 truncate">
                      calling {fmtPhone(activeCall.to)}
                    </p>
                  )}
                  {activeCall?.to && activeCall?.from && direction !== 'outbound' && (
                    <p className="text-[12px] text-tx-tt mt-0.5 truncate">
                      to {fmtPhone(activeCall.to)}
                    </p>
                  )}
                </div>

                {/* Duration + waveform */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5 min-w-[160px]">
                  <span className="text-[9px] font-semibold text-tx-ts uppercase tracking-[0.14em] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    Call duration
                  </span>
                  <div className={`text-2xl font-bold text-tx-tp tnum tracking-tight transition-transform duration-300 ${durationPulse ? 'scale-110' : 'scale-100'}`}>
                    {fmtDuration(duration)}
                  </div>
                  <Waveform
                    bars={20}
                    active={callState === 'active'}
                    color={callState === 'active' ? 'emerald' : 'indigo'}
                    className="w-[160px] h-7"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle hint banner */}
      <AnimatePresence>
        {!isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="px-5 py-2.5 border-b border-tx-bsubtle flex items-center gap-2.5 bg-gradient-to-r from-tx-green/[0.03] via-tx-citron/[0.02] to-transparent"
          >
            <div className="w-6 h-6 rounded-md ai-chip flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3 h-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-tx-ts font-medium">
                Standing by — dial a number or wait for the queue.
              </p>
              <p className="text-[11px] text-tx-tt">
                AI transcript &amp; whisper coaching activate automatically when a call starts.
              </p>
            </div>
            <span className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-md bg-tx-s1 border border-tx-bsubtle">
              <Radio className="w-2.5 h-2.5 text-tx-green live-dot" />
              <span className="text-[9px] font-semibold text-tx-green uppercase tracking-[0.12em]">Listening</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Softphone slot — preserves all WebRTC functionality */}
      <div className="relative w-full">
        {children}
      </div>
      </div>{/* end inner wrapper z-10 */}
    </div>
  );
}
