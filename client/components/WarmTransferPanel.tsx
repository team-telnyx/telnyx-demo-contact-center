'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightLeft,
  PhoneOff,
  PhoneCall,
  Loader2,
  AlertTriangle,
  UserCircle,
  CheckCircle,
  XCircle,
  Phone,
  MessageSquare,
} from 'lucide-react';
import api from '../lib/api';

const PRESENCE_COLORS = {
  online: 'bg-tx-green',
  available: 'bg-blue-400',
  busy: 'bg-red-400',
  away: 'bg-tx-citron',
  offline: 'bg-tx-s3',
};

/**
 * WarmTransferPanel — shown during an active customer call.
 *
 * States:
 *  1. idle     — "Warm Transfer" button
 *  2. picking  — choose target agent
 *  3. consulting — on consultation call with target agent
 *  4. transferring — bridging customer + target
 */
export default function WarmTransferPanel({ activeCall, agents, agentId, onComplete, onCancel }: { activeCall?: any; agents: any[]; agentId?: string; onComplete?: () => void; onCancel?: () => void }) {
  const [state, setState] = useState<'idle' | 'picking' | 'consulting' | 'transferring'>('idle');
  const [targetAgentId, setTargetAgentId] = useState<string | null>(null);
  const [consultationCallControlId, setConsultationCallControlId] = useState<string | null>(null);
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Start warm transfer flow — pick target agent
  const startPicking = useCallback(() => {
    setState('picking');
    setError(null);
  }, []);

  // Initiate the warm transfer: hold customer + dial target
  const initiateTransfer = useCallback(async () => {
    if (!activeCall?.callControlId || !targetAgentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.post('/internal-calling/warm-transfer/initiate', {
        callControlId: activeCall.callControlId,
        targetAgentId,
        note: note || undefined,
      });
      setConsultationCallControlId(result.consultationCallControlId);
      setState('consulting');
    } catch (err: any) {
      console.error('Warm transfer initiate failed', err);
      setError(err?.data?.error || err?.message || 'Failed to initiate warm transfer');
      setState('picking');
    } finally {
      setLoading(false);
    }
  }, [activeCall, targetAgentId, note]);

  // Complete: bridge customer and target, drop original agent
  const completeTransfer = useCallback(async () => {
    if (!activeCall?.callControlId || !consultationCallControlId) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/internal-calling/warm-transfer/complete', {
        customerCallControlId: activeCall.callControlId,
        consultationCallControlId,
      });
      setState('transferring');
      onComplete?.();
    } catch (err: any) {
      console.error('Warm transfer complete failed', err);
      setError(err?.data?.error || err?.message || 'Failed to complete warm transfer');
    } finally {
      setLoading(false);
    }
  }, [activeCall, consultationCallControlId, onComplete]);

  // Cancel: hang up consultation, unhold customer
  const cancelTransfer = useCallback(async () => {
    if (!activeCall?.callControlId || !consultationCallControlId) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/internal-calling/warm-transfer/cancel', {
        customerCallControlId: activeCall.callControlId,
        consultationCallControlId,
      });
      setState('idle');
      setTargetAgentId(null);
      setConsultationCallControlId(null);
      setNote('');
      onCancel?.();
    } catch (err: any) {
      console.error('Warm transfer cancel failed', err);
      setError(err?.data?.error || err?.message || 'Failed to cancel warm transfer');
    } finally {
      setLoading(false);
    }
  }, [activeCall, consultationCallControlId, onCancel]);

  const availableAgents = agents.filter(
    (a) => a.id !== agentId && (a.presence === 'online' || a.presence === 'available' || a.status === 'online')
  );

  const targetAgent = agents.find((a) => a.id === targetAgentId);

  return (
    <div className="space-y-2.5">
      {/* ── Idle: "Warm Transfer" button ──────────────────────────── */}
      {state === 'idle' && (
        <button
          onClick={startPicking}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-tx-green/10 border border-tx-green/20 text-tx-green text-xs font-semibold hover:bg-tx-green/15 active:scale-[0.97] transition-all"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Warm Transfer
        </button>
      )}

      {/* ── Picking: Choose target agent ─────────────────────────── */}
      {state === 'picking' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold text-tx-green uppercase tracking-[0.14em]">
              Warm Transfer — Select Target
            </p>
            <button
              onClick={() => { setState('idle'); setTargetAgentId(null); setNote(''); }}
              className="text-tx-ts hover:text-tx-tp transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          {availableAgents.length === 0 && (
            <p className="text-[11px] text-tx-ts text-center py-2">No agents available</p>
          )}

          <div className="space-y-1 max-h-36 overflow-y-auto">
            {availableAgents.map((a) => {
              const isSelected = targetAgentId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setTargetAgentId(a.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all text-left ${
                    isSelected
                      ? 'bg-tx-green/15 border border-tx-green/25'
                      : 'bg-tx-s3 border border-tx-bdefault/50 hover:bg-tx-s3'
                  }`}
                >
                  <div className="relative">
                    <UserCircle className="w-4 h-4 text-tx-ts" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                      PRESENCE_COLORS[a.presence || a.status] || PRESENCE_COLORS.offline
                    }`} />
                  </div>
                  <span className="text-[11px] text-tx-tp font-medium">{a.user?.displayName || a.sipUsername || 'Agent'}</span>
                  {a.extension && (
                    <span className="text-[9px] text-tx-ts ml-auto font-mono">ext {a.extension}</span>
                  )}
                  {isSelected && <CheckCircle className="w-3 h-3 text-tx-green ml-1" />}
                </button>
              );
            })}
          </div>

          {/* Note / briefing */}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Brief note for target agent…"
            className="w-full bg-tx-s3 border border-tx-bdefault/50 rounded-lg px-3 py-1.5 text-[11px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/40"
          />

          <button
            onClick={initiateTransfer}
            disabled={!targetAgentId || loading}
            className="w-full py-2 rounded-lg gradient-primary text-tx-tp text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
            {loading ? 'Initiating…' : 'Hold & Consult'}
          </button>
        </motion.div>
      )}

      {/* ── Consulting: On consultation call ──────────────────────── */}
      {state === 'consulting' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-citron/10 border border-tx-citron/20">
            <Phone className="w-3.5 h-3.5 text-tx-citron" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-tx-citron">Consulting</p>
              <p className="text-[10px] text-tx-citron/60">Customer on hold · Talking to {targetAgent?.user?.displayName || 'target agent'}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={completeTransfer}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green text-[11px] font-semibold hover:bg-tx-green/15 disabled:opacity-30 flex items-center justify-center gap-1.5 transition-all"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Complete Transfer
            </button>
            <button
              onClick={cancelTransfer}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-red-300 text-[11px] font-semibold hover:bg-tx-red/15 disabled:opacity-30 flex items-center justify-center gap-1.5 transition-all"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Transferring: Brief success state ────────────────────── */}
      {state === 'transferring' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-green/10 border border-tx-green/20"
        >
          <CheckCircle className="w-4 h-4 text-tx-green" />
          <p className="text-[11px] font-semibold text-tx-green">Transfer complete</p>
        </motion.div>
      )}

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20">
          <AlertTriangle className="w-3.5 h-3.5 text-tx-red flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
