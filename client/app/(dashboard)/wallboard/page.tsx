'use client';

/**
 * Wallboard — full-screen supervisor dashboard meant for wall-mounted TVs.
 *
 * Pulls a snapshot from /api/wallboard/live every 5s as a fallback, and also
 * subscribes to the `wallboard:update` Socket.IO event so most updates are
 * effectively instant.
 *
 * Designed for ambient glance-ability: oversized typography, generous spacing,
 * colour-coded thresholds (green / amber / red), and motion that draws the
 * eye to whatever just changed.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Clock,
  Headphones,
  PhoneCall,
  Target,
  Timer,
  TrendingUp,
  Users,
  Radio,
  AlertTriangle,
  PhoneIncoming,
  PhoneOutgoing,
  Loader2,
  RefreshCw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import api from '../../../lib/api';
import { useSocketEvent } from '../../../lib/socket';
import AnimatedNumber from '../../../components/AnimatedNumber';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${String(mm).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${m}:${String(r).padStart(2, '0')}`;
}

function fmtMsAsDuration(ms) {
  if (ms == null) return '—';
  return fmtDuration(Math.round(ms / 1000));
}

function queueColor(depth) {
  if (depth >= 10) return 'red';
  if (depth >= 3) return 'amber';
  return 'emerald';
}

function slaColor(pct) {
  if (pct == null) return 'slate';
  if (pct >= 90) return 'emerald';
  if (pct >= 75) return 'amber';
  return 'red';
}

// Neutral palette: surfaces stay calm, accent reserved for state.
const COLOR_TOKENS = {
  emerald: { text: 'text-tx-green', glow: '', bg: '', border: 'border-tx-bsubtle', accent: 'bg-tx-green' },
  amber:   { text: 'text-tx-citron', glow: '', bg: '', border: 'border-tx-bsubtle', accent: 'bg-tx-citron' },
  red:     { text: 'text-tx-red',    glow: '', bg: '', border: 'border-tx-bsubtle', accent: 'bg-tx-red' },
  indigo:  { text: 'text-tx-tp',     glow: '', bg: '', border: 'border-tx-bsubtle', accent: 'bg-tx-green' },
  violet:  { text: 'text-tx-tp',     glow: '', bg: '', border: 'border-tx-bsubtle', accent: 'bg-tx-citron' },
  cyan:    { text: 'text-tx-tp',     glow: '', bg: '', border: 'border-tx-bsubtle', accent: 'bg-tx-blue' },
  slate:   { text: 'text-tx-ts',     glow: '', bg: '', border: 'border-tx-bsubtle', accent: 'bg-tx-ts' },
};

// ── BigStat tile ──────────────────────────────────────────────────────────

function BigStat({ icon: Icon, label, value, sub, color = 'indigo', delay = 0, format }: { icon: any; label: string; value: any; sub?: any; color?: string; delay?: number; format?: (n: number) => string }) {
  const tone = COLOR_TOKENS[color] || COLOR_TOKENS.indigo;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden bg-tx-s2 border rounded-xl ${tone.border} p-4 hover:border-tx-bdefault transition-colors`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-tx-tt">
          {label}
        </span>
        <div className={`p-1.5 rounded-md bg-tx-s3 ${tone.text}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
        </div>
      </div>
      <div className={`text-[36px] leading-none font-semibold tnum tracking-tight ${tone.text}`}>
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} format={format} />
        ) : (
          <span>{value ?? '—'}</span>
        )}
      </div>
      {sub && (
        <div className="mt-2 text-[11.5px] text-tx-tt font-medium">{sub}</div>
      )}
    </motion.div>
  );
}

// ── SLA gauge (semicircle) ────────────────────────────────────────────────

function SlaGauge({ pct, target }) {
  const color = slaColor(pct);
  const tone = COLOR_TOKENS[color];
  const safePct = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const r = 80;
  const circumference = Math.PI * r;
  const offset = circumference - (safePct / 100) * circumference;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden bg-tx-s2 border rounded-xl ${tone.border} p-4 flex flex-col items-center justify-between`}
    >
      <div className="w-full flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-tx-tt">
          Service Level
        </span>
        <div className={`p-1.5 rounded-md bg-tx-s3 ${tone.text}`}>
          <Target className="w-3.5 h-3.5" strokeWidth={1.8} />
        </div>
      </div>
      <div className="relative w-[200px] h-[110px]">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="round"
            className={tone.text}
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDasharray: circumference, strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <div className={`text-[34px] leading-none font-semibold tnum ${tone.text}`}>
            {pct == null ? '—' : (
              <AnimatedNumber value={pct} format={(n) => `${n.toFixed(1)}%`} />
            )}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-tx-tt font-medium mt-1">
        % answered within {target}s
      </div>
    </motion.div>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────

const AGENT_STATUS_TONE = {
  online:  { dot: 'bg-tx-green', text: 'text-tx-green', label: 'Available', pulse: true,  border: 'border-tx-green/30' },
  busy:    { dot: 'bg-rose-400',    text: 'text-tx-red',    label: 'On Call',   pulse: true,  border: 'border-tx-red/30' },
  away:    { dot: 'bg-tx-citron',   text: 'text-tx-citron',   label: 'Away',      pulse: false, border: 'border-tx-citron/20' },
  break:   { dot: 'bg-tx-citron',  text: 'text-tx-citron',  label: 'Break',     pulse: false, border: 'border-orange-500/20' },
  dnd:     { dot: 'bg-tx-ts',   text: 'text-tx-ts',   label: 'DND',       pulse: false, border: 'border-tx-bdefault' },
  offline: { dot: 'bg-tx-s3',   text: 'text-tx-ts',   label: 'Offline',   pulse: false, border: 'border-tx-bdefault' },
};

function AgentCard({ agent, tickSeconds }) {
  const tone = AGENT_STATUS_TONE[agent.status] || AGENT_STATUS_TONE.offline;
  const baseDuration = agent.currentCallDuration ?? 0;
  const liveDuration = agent.currentCallDuration != null
    ? baseDuration + tickSeconds
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className={`bg-tx-s2 border rounded-lg ${tone.border} p-3 flex flex-col gap-1.5 hover:border-tx-bdefault transition-colors`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex items-center justify-center">
            <span className={`w-2.5 h-2.5 rounded-full ${tone.dot} shadow-[0_0_8px_currentColor]`} />
            {tone.pulse && (
              <span className={`absolute inset-0 rounded-full ${tone.dot} animate-ping opacity-60`} />
            )}
          </span>
          <span className="text-sm font-semibold text-tx-tp truncate">{agent.name}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${tone.text}`}>
          {tone.label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-tx-ts font-medium">
          {agent.callsHandled} call{agent.callsHandled === 1 ? '' : 's'} today
        </div>
        {liveDuration != null && (
          <div className="text-sm font-bold tnum text-tx-red">
            {fmtDuration(liveDuration)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Queue row ─────────────────────────────────────────────────────────────

function QueueRow({ q }) {
  const depthColor = queueColor(q.depth);
  const slaC = slaColor(q.sla);
  const depthTone = COLOR_TOKENS[depthColor];
  const slaTone = COLOR_TOKENS[slaC];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
      className="grid grid-cols-12 items-center gap-2 px-3 py-2.5 border-b border-tx-bsubtle last:border-0"
    >
      <div className="col-span-3 flex items-center gap-2">
        <span className={`w-1 h-5 rounded-full ${depthTone.accent}`} />
        <span className="text-[12.5px] font-medium text-tx-tp truncate">{q.name}</span>
      </div>
      <div className="col-span-2 text-right">
        <span className={`text-[18px] font-semibold tnum ${depthTone.text}`}>
          <AnimatedNumber value={q.depth} />
        </span>
        <div className="text-[9px] text-tx-tt uppercase tracking-wider">in queue</div>
      </div>
      <div className="col-span-2 text-right">
        <span className="text-[13px] font-semibold tnum text-tx-tp">
          {fmtMsAsDuration(q.oldestWaitMs)}
        </span>
        <div className="text-[9px] text-tx-tt uppercase tracking-wider">oldest</div>
      </div>
      <div className="col-span-2 text-right">
        <span className="text-[13px] font-semibold tnum text-tx-ts">
          {q.avgWait ? `${q.avgWait}s` : '—'}
        </span>
        <div className="text-[9px] text-tx-tt uppercase tracking-wider">avg wait</div>
      </div>
      <div className="col-span-2 text-right">
        <span className={`text-[13px] font-semibold tnum ${slaTone.text}`}>
          {q.sla == null ? '—' : `${q.sla}%`}
        </span>
        <div className="text-[9px] text-tx-tt uppercase tracking-wider">SLA</div>
      </div>
      <div className="col-span-1 text-right">
        <span className="text-[13px] font-semibold tnum text-tx-green">{q.agentsOnline}</span>
        <div className="text-[9px] text-tx-tt uppercase tracking-wider">agents</div>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function WallboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [wallClock, setWallClock] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const baselineRef = useRef({ longestWaitMs: 0, fetchedAt: Date.now() });
  const tickBaseRef = useRef(Date.now());

  async function loadSnapshot() {
    setIsRefreshing(true);
    try {
      const snap = await api.get('/wallboard/live');
      setData(snap);
      setLastUpdatedAt(new Date());
      baselineRef.current = {
        longestWaitMs: snap.longestWaitMs || 0,
        fetchedAt: Date.now(),
      };
      tickBaseRef.current = Date.now();
      setError(null);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Wallboard fetch failed', err);
      setError(err?.message || 'Failed to load wallboard');
      if (err?.status === 401 || err?.status === 403) {
        // Token stale or insufficient role — force re-login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return;
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadSnapshot();
    const t = setInterval(loadSnapshot, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Live wall clock
  useEffect(() => {
    function tickClock() {
      const now = new Date();
      setWallClock(now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }
    tickClock();
    const t = setInterval(tickClock, 1000);
    return () => clearInterval(t);
  }, []);

  // Fullscreen toggle
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useSocketEvent('wallboard:update', (payload) => {
    if (!payload) return;
    setData(payload);
    setLastUpdatedAt(new Date());
    baselineRef.current = {
      longestWaitMs: payload.longestWaitMs || 0,
      fetchedAt: Date.now(),
    };
    tickBaseRef.current = Date.now();
  });

  const liveLongestWaitMs = useMemo(() => {
    if (!data || data.callsInQueue === 0) return 0;
    const drift = Date.now() - baselineRef.current.fetchedAt;
    return baselineRef.current.longestWaitMs + drift;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, data]);

  const tickSeconds = useMemo(() => {
    return Math.floor((Date.now() - tickBaseRef.current) / 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-tx-ts">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        Loading wallboard…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-tx-red gap-3">
        <AlertTriangle className="w-6 h-6" />
        {error}
      </div>
    );
  }

  if (!data) return null;

  const qColor = queueColor(data.callsInQueue);
  const waitColor =
    liveLongestWaitMs > data.slaTargetSeconds * 1000
      ? 'red'
      : liveLongestWaitMs > data.slaTargetSeconds * 500
        ? 'amber'
        : 'emerald';

  return (
    <div className="min-h-screen p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
            <Activity className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-tx-tp tracking-tight leading-none">Live Wallboard</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-tx-ts font-medium mt-1.5">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-tx-green animate-ping opacity-75" />
                <span className="relative rounded-full w-1.5 h-1.5 bg-tx-green" />
              </span>
              <span className="tracking-[0.14em] uppercase font-bold text-tx-green">Live</span>
              <span className="text-tx-tt">· auto-refresh 5s</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-semibold tnum text-tx-tp tracking-tight leading-none">{wallClock}</div>
          <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-tx-tt mt-1">
            SLA Target
          </div>
          <div className="text-[15px] font-semibold text-tx-tp tnum mt-1 leading-none">{data.slaTargetSeconds}s</div>
          <div className="flex items-center gap-2 mt-2 justify-end">
            <span className="text-[10px] text-tx-tt tabular-nums">
              Updated: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : '—'}
            </span>
            <button
              onClick={loadSnapshot}
              className="p-1 rounded-md border border-tx-bdefault bg-tx-s2 text-tx-ts hover:text-tx-tp hover:border-tx-bdefault transition-colors"
              title="Refresh now"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1 rounded-md border border-tx-bdefault bg-tx-s2 text-tx-ts hover:text-tx-tp hover:border-tx-bdefault transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Top row: 4 hero stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <BigStat
          icon={PhoneCall}
          label="Calls in Queue"
          value={data.callsInQueue}
          sub={
            data.callsInQueue === 0
              ? 'All clear'
              : `${data.callsInQueue >= 10 ? 'Critical' : data.callsInQueue >= 3 ? 'Building up' : 'Healthy'} backlog`
          }
          color={qColor}
          delay={0}
        />
        <BigStat
          icon={Timer}
          label="Longest Wait"
          value={fmtMsAsDuration(liveLongestWaitMs)}
          sub={data.callsInQueue === 0 ? 'No one waiting' : 'Oldest queued call'}
          color={waitColor}
          delay={0.05}
        />
        <BigStat
          icon={Headphones}
          label="Active Calls"
          value={data.activeCalls}
          sub={`${data.agentsBusy} agents on calls`}
          color="indigo"
          delay={0.1}
        />
        <BigStat
          icon={Users}
          label="Agents Available"
          value={data.agentsAvailable}
          sub={`of ${data.agentsTotal} total`}
          color={data.agentsAvailable === 0 ? 'red' : data.agentsAvailable < 3 ? 'amber' : 'emerald'}
          delay={0.15}
        />
      </div>

      {/* Second row: SLA gauge + today's totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <SlaGauge pct={data.slaPercentage} target={data.slaTargetSeconds} />
        <BigStat
          icon={TrendingUp}
          label="Calls Today"
          value={data.callsToday.total}
          sub={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-tx-green">
                <PhoneIncoming className="w-3.5 h-3.5" /> {data.callsToday.inbound} in
              </span>
              <span className="inline-flex items-center gap-1 text-tx-citron">
                <PhoneOutgoing className="w-3.5 h-3.5" /> {data.callsToday.outbound} out
              </span>
            </span>
          }
          color="violet"
          delay={0.05}
        />
        <BigStat
          icon={Clock}
          label="Avg Handle Time"
          value={data.avgHandleTime}
          format={(n) => fmtDuration(n)}
          sub="Across today's calls"
          color="cyan"
          delay={0.1}
        />
        <BigStat
          icon={Timer}
          label="Avg Wait Time"
          value={data.avgWaitTime}
          format={(n) => `${Math.round(n)}s`}
          sub="Queue entry → bridge"
          color={data.avgWaitTime > data.slaTargetSeconds ? 'amber' : 'emerald'}
          delay={0.15}
        />
      </div>

      {/* Bottom: Agents + Queues */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Agent grid */}
        <div className="xl:col-span-2 bg-tx-s2 border border-tx-bsubtle rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-tx-tt">
              Agent Status
            </h2>
            <div className="text-[11px] text-tx-tt font-medium">
              {data.agents.length} agent{data.agents.length === 1 ? '' : 's'}
            </div>
          </div>
          {data.agents.length === 0 ? (
            <div className="py-12 text-center text-tx-ts text-sm">
              No agents configured.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {data.agents.map((a) => (
                  <AgentCard key={a.id} agent={a} tickSeconds={tickSeconds} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Queue breakdown */}
        <div className="bg-tx-s2 border border-tx-bsubtle rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-tx-tt">
              Queues
            </h2>
            <div className="text-[11px] text-tx-tt font-medium">
              {data.queues.length} active
            </div>
          </div>
          {data.queues.length === 0 ? (
            <div className="py-12 text-center text-tx-ts text-sm">
              No queues with activity today.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              <AnimatePresence mode="popLayout">
                {data.queues.map((q) => (
                  <QueueRow key={q.name} q={q} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
