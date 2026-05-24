'use client';

/**
 * SupervisorControls — list of currently active calls with Monitor / Barge /
 * Whisper actions. Only rendered for users with role 'supervisor' or 'admin'.
 *
 * - Monitor (ear icon)        → listen-only via POST /api/voice/monitor
 * - Barge   (PhoneForwarded)  → full-duplex join via POST /api/voice/barge
 * - Whisper (MessageCircle)   → coach the agent only via POST /api/voice/whisper
 *
 * Pulls active calls from /api/history?status=active (best-effort — if the
 * endpoint doesn't filter that way it'll show recent calls and let the
 * supervisor pick). Subscribes to call:answered/call:ended/monitor:started
 * /barge:started over Socket.IO so the list and "currently monitoring"
 * indicator stay live.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ear,
  PhoneForwarded,
  MessageCircle,
  Headphones,
  Loader2,
  AlertCircle,
  CheckCircle,
  Phone,
  Shield,
} from 'lucide-react';
import api from '../lib/api';
import { useSocket } from '../lib/socket';

export default function SupervisorControls({ user, supervisorSipUsername }: { user: any; supervisorSipUsername?: string }) {
  const role = user?.role;
  const isPriv = role === 'supervisor' || role === 'admin';
  const { on } = useSocket();

  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [busyCall, setBusyCall] = useState<{ callId: string; action: string } | null>(null);
  const [activeMonitor, setActiveMonitor] = useState<string | null>(null);
  const [activeBarge, setActiveBarge] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try the most likely shapes. /history is paginated; we want anything
      // currently in 'active' state. Fall back to the latest 10 calls.
      let rows = [];
      const r1 = await api.get('/history?page=1&limit=20&status=active').catch(() => null);
      if (Array.isArray(r1?.items)) rows = r1.items;
      else if (Array.isArray(r1?.records)) rows = r1.records;
      else if (Array.isArray(r1?.data)) rows = r1.data;
      else if (Array.isArray(r1)) rows = r1;

      // Drop non-primary legs (transfer/whisper/monitor/barge) — they're
      // already part of a primary supervised call.
      const primary = rows.filter((c) => !c.callPurpose || c.callPurpose === 'primary' || c.callPurpose === 'agent_answer');
      // Keep only those still active
      const active = primary.filter((c) => c.status === 'active' || c.status === 'ringing' || c.status === 'on_hold');
      setCalls(active);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPriv) return;
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [isPriv, refresh]);

  useEffect(() => {
    if (!isPriv) return;
    const cleanups = [];
    cleanups.push(on('call:answered', refresh));
    cleanups.push(on('call:ended',    refresh));
    cleanups.push(on('call:ringing',  refresh));
    cleanups.push(on('monitor:started', ({ callControlId }) => {
      setActiveMonitor(callControlId);
      setFeedback({ type: 'ok', message: 'Monitoring started' });
      setTimeout(() => setFeedback(null), 2500);
    }));
    cleanups.push(on('barge:started', ({ callControlId }) => {
      setActiveBarge(callControlId);
      setFeedback({ type: 'ok', message: 'Barge active — you are now audible' });
      setTimeout(() => setFeedback(null), 2500);
    }));
    return () => cleanups.forEach((fn) => fn());
  }, [on, isPriv, refresh]);

  const doAction = useCallback(async (call, action) => {
    if (!supervisorSipUsername) {
      setFeedback({ type: 'err', message: 'Your SIP username is not set — cannot supervise.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setBusyCall({ callId: call.id, action });
    try {
      if (action === 'monitor') {
        await api.post('/voice/monitor', {
          callControlId: call.callControlId,
          supervisorSipUsername,
        });
      } else if (action === 'barge') {
        await api.post('/voice/barge', {
          callControlId: call.callControlId,
          supervisorSipUsername,
        });
      } else if (action === 'whisper') {
        await api.post('/voice/whisper', {
          callControlId: call.callControlId,
          supervisorSipUsername,
        });
        setFeedback({ type: 'ok', message: 'Whisper leg initiated' });
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch (err: any) {
      setFeedback({ type: 'err', message: err?.data?.error || err?.message || 'Action failed' });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setBusyCall(null);
    }
  }, [supervisorSipUsername]);

  if (!isPriv) return null;

  return (
    <div className="elev-3 rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-tx-bdefault/50 bg-gradient-to-r from-tx-citron/[0.06] via-tx-red/4 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-tx-citron/15 border border-tx-citron/25 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-tx-citron" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-tx-tp tracking-tight leading-tight">
              Supervisor Controls
            </p>
            <p className="text-[9px] font-semibold text-tx-citron/70 uppercase tracking-[0.14em]">
              {calls.length} active call{calls.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        {(activeMonitor || activeBarge) && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tx-red/10 border border-tx-red/20 text-[10px] font-semibold text-tx-red">
            <Headphones className="w-2.5 h-2.5 live-dot" />
            {activeBarge ? 'Barging' : 'Monitoring'}
          </span>
        )}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit   ={{ opacity: 0, y: -4 }}
            className={`px-4 py-2 text-[11px] font-medium flex items-center gap-2 border-b ${
              feedback.type === 'ok'
                ? 'bg-tx-green/[0.08] border-tx-green/15 text-tx-green'
                : 'bg-tx-red/[0.08] border-tx-red/15 text-tx-red'
            }`}
          >
            {feedback.type === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {loading && calls.length === 0 && (
          <div className="flex items-center justify-center py-6 text-tx-ts">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-[11px] text-tx-red">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && calls.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-6">
            <div className="w-10 h-10 rounded-xl bg-tx-s2 border border-tx-bsubtle flex items-center justify-center mb-3">
              <Phone className="w-5 h-5 text-tx-ts" />
            </div>
            <p className="text-xs text-tx-ts font-semibold">No active calls</p>
            <p className="text-[11px] text-tx-ts mt-1 max-w-[220px]">
              When agents pick up calls they'll appear here for live oversight.
            </p>
          </div>
        )}

        {calls.map((c) => (
          <CallRow
            key={c.id || c.callControlId}
            call={c}
            busy={busyCall && busyCall.callId === c.id ? busyCall.action : null}
            monitoringThis={activeMonitor === c.callControlId}
            bargingThis={activeBarge === c.callControlId}
            onMonitor={() => doAction(c, 'monitor')}
            onBarge={()   => doAction(c, 'barge')}
            onWhisper={() => doAction(c, 'whisper')}
          />
        ))}
      </div>
    </div>
  );
}

function CallRow({ call, busy, monitoringThis, bargingThis, onMonitor, onBarge, onWhisper }: { call: any; busy: string | null; monitoringThis: boolean; bargingThis: boolean; onMonitor: () => void; onBarge: () => void; onWhisper: () => void }) {
  const callerLabel = call.from || call.callerNumber || 'Unknown';
  const agentName   = call.agent?.user?.displayName || call.agentName || call.agent?.sipUsername || 'Unassigned';

  const Btn = ({ label, onClick, icon: Icon, accent, active, busyHere }: { label: string; onClick: () => void; icon: any; accent: string; active?: boolean; busyHere?: boolean }) => (
    <button
      onClick={onClick}
      disabled={!!busy}
      title={label}
      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-[0.12em] transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${accent} ${
        active ? 'ring-1 ring-tx-red/40' : ''
      }`}
    >
      {busyHere ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </button>
  );

  return (
    <div className="elev-1 rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-tx-tp truncate tnum">{callerLabel}</p>
          <p className="text-[10px] text-tx-ts truncate">
            <span className="text-tx-ts">{agentName}</span>
            {call.queueName ? <span> · {call.queueName}</span> : null}
          </p>
        </div>
        <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-semibold uppercase tracking-[0.12em] ${
          call.status === 'active'
            ? 'bg-tx-green/10 border-tx-green/20 text-tx-green'
            : call.status === 'on_hold'
            ? 'bg-tx-citron/10 border-tx-citron/20 text-tx-citron'
            : 'bg-tx-s2 border-tx-bsubtle text-tx-ts'
        }`}>
          {call.status || 'active'}
        </span>
      </div>

      <div className="flex gap-1.5">
        <Btn
          label="Monitor"
          icon={Ear}
          onClick={onMonitor}
          busyHere={busy === 'monitor'}
          active={monitoringThis}
          accent="bg-tx-blue/[0.08] border-tx-blue/20 text-tx-blue hover:bg-tx-blue/15"
        />
        <Btn
          label="Whisper"
          icon={MessageCircle}
          onClick={onWhisper}
          busyHere={busy === 'whisper'}
          accent="bg-tx-green/[0.08] border-tx-citron/20 text-tx-citron hover:bg-tx-green/15"
        />
        <Btn
          label="Barge"
          icon={PhoneForwarded}
          onClick={onBarge}
          busyHere={busy === 'barge'}
          active={bargingThis}
          accent="bg-tx-red/[0.08] border-tx-red/20 text-tx-red hover:bg-tx-red/15"
        />
      </div>
    </div>
  );
}
