'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import { useSocket } from '../../../lib/socket';
import {
  ListOrdered,
  Plus,
  X,
  Users,
  Clock,
  Activity,
  Sparkles,
  Trash2,
  Edit3,
  Save,
  Layers,
  ShieldCheck,
  TimerReset,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Radio,
} from 'lucide-react';

const STRATEGIES = [
  { value: 'round-robin', label: 'Round Robin', hint: 'Cycle evenly across eligible agents' },
  { value: 'least-recent', label: 'Least Recent', hint: 'Oldest lastCallEndedAt wins' },
  { value: 'most-idle', label: 'Most Idle', hint: 'Alias for least-recent' },
  { value: 'skills-weighted', label: 'Skills Weighted', hint: 'Prefer higher skill-level match' },
  { value: 'priority', label: 'Priority', hint: 'Lowest Agent.priority wins' },
];

const OVERFLOW = [
  { value: 'voicemail', label: 'Send to Voicemail' },
  { value: 'callback', label: 'Offer Callback' },
  { value: 'hangup', label: 'Hang Up' },
  { value: 'transfer', label: 'Transfer' },
];

const EMPTY_FORM = {
  name: '',
  displayName: '',
  strategy: 'round-robin',
  maxWaitSeconds: 300,
  wrapUpSeconds: 30,
  slaTargetSeconds: 20,
  slaThresholdPct: 80,
  priority: 50,
  active: true,
  musicOnHoldUrl: '',
  maxQueueSize: 50,
  overflowAction: 'voicemail',
  overflowTarget: '',
  requiredSkills: [],
};

function classNames(...xs) { return xs.filter(Boolean).join(' '); }

function SkillEditor({ skills, onChange }) {
  const [draft, setDraft] = useState({ name: '', level: 3 });

  function add() {
    if (!draft.name.trim()) return;
    if (skills.some((s) => s.name === draft.name.trim())) return;
    onChange([...skills, { name: draft.name.trim(), level: Number(draft.level) || 1 }]);
    setDraft({ name: '', level: 3 });
  }

  function remove(name) {
    onChange(skills.filter((s) => s.name !== name));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {skills.length === 0 && (
          <span className="text-[11px] text-tx-ts">No required skills — anyone qualifies.</span>
        )}
        {skills.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 bg-tx-green/10 border border-tx-citron/20 text-tx-citron text-[11px] px-2 py-0.5 rounded-lg">
            <Sparkles className="w-2.5 h-2.5" />
            {s.name}
            <span className="text-tx-citron/70 text-[9px] tnum">L{s.level}</span>
            <button type="button" onClick={() => remove(s.name)} className="text-tx-ts hover:text-tx-red">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Skill name (e.g. billing)"
          className="flex-1 bg-tx-s3 border border-tx-bdefault rounded-lg px-2.5 py-1.5 text-[12px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40"
        />
        <select
          value={draft.level}
          onChange={(e) => setDraft((d) => ({ ...d, level: Number(e.target.value) }))}
          className="bg-tx-s3 border border-tx-bdefault rounded-lg px-2 py-1.5 text-[12px] text-tx-tp focus:outline-none focus:border-tx-citron/40 appearance-none"
        >
          {[1, 2, 3, 4, 5].map((l) => (<option key={l} value={l} className="bg-tx-s1">L{l}</option>))}
        </select>
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 rounded-lg bg-tx-green/15 border border-tx-citron/25 text-tx-citron text-[11px] font-semibold hover:bg-tx-green/25 active:scale-[0.97] transition-all"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function QueueModal({ queue, onClose, onSaved }) {
  const editing = !!queue?.id;
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(queue || {}) }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }
  function setNum(field, value) { setForm((f) => ({ ...f, [field]: value === '' ? '' : Number(value) })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      for (const k of ['maxWaitSeconds', 'wrapUpSeconds', 'slaTargetSeconds', 'slaThresholdPct', 'priority', 'maxQueueSize']) {
        if (payload[k] === '' || payload[k] == null) delete payload[k];
        else payload[k] = Number(payload[k]);
      }
      if (!payload.musicOnHoldUrl) delete payload.musicOnHoldUrl;
      if (!payload.overflowTarget) delete payload.overflowTarget;

      const saved = editing
        ? await api.patch(`/queues/${queue.id}`, payload)
        : await api.post('/queues', payload);
      onSaved(saved);
    } catch (err: any) {
      const e = err.data?.error;
      const msg = Array.isArray(e) ? (e[0]?.message || JSON.stringify(e[0])) : e || err.message || 'Failed to save';
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-tx-s1/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="bg-tx-s2 border border-tx-bdefault rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-tx-bdefault flex items-center justify-between sticky top-0 bg-tx-s1/80 backdrop-blur-xl z-10">
          <div>
            <h2 className="text-sm font-semibold text-tx-tp">{editing ? 'Edit Queue' : 'Create Queue'}</h2>
            <p className="text-[11px] text-tx-ts mt-0.5">{editing ? form.name : 'Configure routing, SLA, and overflow'}</p>
          </div>
          <button onClick={onClose} className="text-tx-ts hover:text-tx-tp transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="bg-tx-red/10 border border-tx-red/20 text-tx-red px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Name</label>
              <input
                type="text"
                required
                disabled={editing}
                value={form.name}
                onChange={(e) => set('name', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="support"
                className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Display Name</label>
              <input
                type="text"
                value={form.displayName || ''}
                onChange={(e) => set('displayName', e.target.value)}
                placeholder="Customer Support"
                className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Routing Strategy</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {STRATEGIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set('strategy', s.value)}
                  className={classNames(
                    'text-left px-3 py-2 rounded-lg border transition-all',
                    form.strategy === s.value
                      ? 'bg-tx-green/15 border-tx-green/40 text-tx-tp'
                      : 'bg-tx-s3 border-tx-bdefault text-tx-ts hover:border-tx-bstrong',
                  )}
                >
                  <div className="text-[12px] font-semibold">{s.label}</div>
                  <div className="text-[10px] text-tx-ts mt-0.5">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Max Wait (s)</label>
              <input type="number" min={0} value={form.maxWaitSeconds} onChange={(e) => setNum('maxWaitSeconds', e.target.value)} className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] tnum" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Wrap-Up (s)</label>
              <input type="number" min={0} value={form.wrapUpSeconds} onChange={(e) => setNum('wrapUpSeconds', e.target.value)} className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] tnum" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">SLA Target (s)</label>
              <input type="number" min={0} value={form.slaTargetSeconds} onChange={(e) => setNum('slaTargetSeconds', e.target.value)} className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] tnum" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">SLA Threshold (%)</label>
              <input type="number" min={0} max={100} value={form.slaThresholdPct} onChange={(e) => setNum('slaThresholdPct', e.target.value)} className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] tnum" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Priority</label>
              <input type="number" min={0} max={999} value={form.priority} onChange={(e) => setNum('priority', e.target.value)} className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] tnum" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Max Queue Size</label>
              <input type="number" min={0} value={form.maxQueueSize} onChange={(e) => setNum('maxQueueSize', e.target.value)} className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] tnum" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Music on Hold URL</label>
              <input type="url" value={form.musicOnHoldUrl || ''} onChange={(e) => set('musicOnHoldUrl', e.target.value)} placeholder="https://…" className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Overflow Action</label>
              <select
                value={form.overflowAction}
                onChange={(e) => set('overflowAction', e.target.value)}
                className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] appearance-none"
              >
                {OVERFLOW.map((o) => (<option key={o.value} value={o.value} className="bg-tx-s1">{o.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Overflow Target</label>
              <input
                type="text"
                value={form.overflowTarget || ''}
                onChange={(e) => set('overflowTarget', e.target.value)}
                placeholder={form.overflowAction === 'transfer' ? '+61412345678 or sip:…' : 'Optional'}
                className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5">Required Skills</label>
            <SkillEditor skills={form.requiredSkills || []} onChange={(v) => set('requiredSkills', v)} />
          </div>

          <label className="flex items-center gap-2 text-xs text-tx-ts cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => set('active', e.target.checked)}
              className="accent-emerald-500"
            />
            Queue is active
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-semibold hover:bg-tx-s3 active:scale-[0.97] transition-all">Cancel</button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl gradient-primary text-white text-xs font-semibold shadow-lg shadow-tx-green/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {editing ? 'Save changes' : 'Create queue'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function StatPill({ icon: Icon, label, value, accent = 'indigo' }) {
  const accentMap = {
    indigo: 'text-tx-green bg-tx-green/10 border-tx-green/20',
    emerald: 'text-tx-green bg-tx-green/10 border-tx-green/20',
    amber: 'text-tx-citron bg-tx-citron/10 border-tx-citron/20',
    rose: 'text-tx-red bg-tx-red/10 border-tx-red/20',
    violet: 'text-tx-citron bg-tx-green/10 border-tx-citron/20',
    slate: 'text-tx-ts bg-tx-s3 border-tx-bdefault',
  };
  return (
    <div className={classNames('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-semibold', accentMap[accent] || accentMap.indigo)}>
      <Icon className="w-3 h-3" />
      <span className="uppercase tracking-[0.12em] text-[9px] opacity-80">{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

export default function QueuesPage() {
  const [queues, setQueues] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [peakDepths, setPeakDepths] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalQueue, setModalQueue] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const { on } = useSocket();

  const fetchQueues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/queues?includeInactive=true');
      setQueues(data);
    } catch (err: any) {
      console.error('Failed to fetch queues', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (rows) => {
    const next = {};
    await Promise.all(
      rows.map(async (q) => {
        try {
          next[q.id] = await api.get(`/queues/${q.id}/stats`);
        } catch {}
      }),
    );
    setStats(next);
  }, []);

  useEffect(() => { fetchQueues(); }, [fetchQueues]);
  useEffect(() => { if (queues.length) fetchStats(queues); }, [queues, fetchStats]);

  // Track peak depths from stats
  useEffect(() => {
    for (const [qId, s] of Object.entries(stats)) {
      const d = s?.depth || 0;
      if (d > 0) {
        setPeakDepths((prev) => ({
          ...prev,
          [qId]: Math.max(prev[qId] || 0, d),
        }));
      }
    }
  }, [stats]);

  useEffect(() => {
    if (!queues.length) return;
    const id = setInterval(() => fetchStats(queues), 10000);
    return () => clearInterval(id);
  }, [queues, fetchStats]);

  useEffect(() => {
    const cleanups = [];
    cleanups.push(on('queue:update', (depthByName) => {
      setQueues((prev) => prev.map((q) => {
        const live = depthByName?.[q.name];
        return live ? { ...q, depth: live.depth, oldestWaitMs: live.oldestWaitMs } : q;
      }));
      // Also update stats and track peaks
      if (depthByName && typeof depthByName === 'object') {
        setStats((prev) => {
          const next = { ...prev };
          for (const [qName, data] of Object.entries(depthByName)) {
            const queueId = queues.find((q) => q.name === qName)?.id;
            if (queueId && data && typeof data === 'object') {
              next[queueId] = { ...next[queueId], ...(data as Record<string,unknown>) };
              // Track peak depth
              const d = (data as any).depth || 0;
              setPeakDepths((pPrev) => ({
                ...pPrev,
                [queueId]: Math.max(pPrev[queueId] || 0, d),
              }));
            }
          }
          return next;
        });
      }
    }));
    cleanups.push(on('queue:created', () => fetchQueues()));
    cleanups.push(on('queue:updated', () => fetchQueues()));
    cleanups.push(on('queue:deleted', () => fetchQueues()));
    return () => cleanups.forEach((fn) => fn());
  }, [on, fetchQueues, queues]);

  async function handleDelete(queue) {
    try {
      await api.delete(`/queues/${queue.id}`);
      setConfirmDelete(null);
      fetchQueues();
    } catch (err: any) {
      console.error('Delete failed', err);
    }
  }

  const totalDepth = useMemo(
    () => Object.values(stats).reduce((s, x) => s + (x?.depth || 0), 0),
    [stats],
  );
  const totalAvailable = useMemo(
    () => Object.values(stats).reduce((s, x) => s + (x?.agentsAvailable || 0), 0),
    [stats],
  );
  const avgWaitSec = useMemo(() => {
    const waits = Object.values(stats).filter((x) => x?.oldestWaitMs > 0).map((x) => x.oldestWaitMs);
    return waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length / 1000) : 0;
  }, [stats]);
  const activeQueues = useMemo(
    () => Object.values(stats).filter((x) => (x?.depth || 0) > 0).length,
    [stats],
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="shimmer h-20 rounded-xl" />))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-semibold text-tx-ts uppercase tracking-[0.18em] mb-1">Routing</p>
          <h1 className="text-xl font-extrabold text-tx-tp tracking-tight">
            Queues <span className="text-tx-ts font-bold">·</span>{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-tx-green to-tx-citron">
              ACD Strategy
            </span>
          </h1>
          <p className="text-xs text-tx-ts mt-1">Configure routing strategies, SLA targets, and overflow.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatPill icon={Activity} label="Total waiting" value={totalDepth} accent={totalDepth > 0 ? 'amber' : 'slate'} />
          <StatPill icon={Clock} label="Avg wait" value={`${avgWaitSec}s`} accent={avgWaitSec > 60 ? 'rose' : avgWaitSec > 20 ? 'amber' : 'slate'} />
          <StatPill icon={Radio} label="Active" value={activeQueues} accent={activeQueues > 0 ? 'emerald' : 'slate'} />
          <StatPill icon={Users} label="Agents" value={totalAvailable} accent={totalAvailable > 0 ? 'emerald' : 'slate'} />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setModalQueue({})}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-primary text-white text-xs font-semibold shadow-lg shadow-tx-green/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New queue
          </motion.button>
        </div>
      </div>

      {queues.length === 0 ? (
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-12 text-center">
          <ListOrdered className="w-10 h-10 text-tx-tt mx-auto mb-3" />
          <p className="text-tx-ts font-medium">No queues yet</p>
          <p className="text-xs text-tx-ts mt-1">Create your first queue to start routing calls.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {queues.map((q) => {
            const live = stats[q.id] || {};
            const slaPct = live.slaPct;
            const slaThreshold = q.slaThresholdPct ?? 80;
            const slaGood = slaPct == null ? null : slaPct >= slaThreshold;
            const depth = live.depth ?? q.depth ?? 0;
            const oldestWaitMs = live.oldestWaitMs ?? q.oldestWaitMs ?? 0;
            const peak = peakDepths[q.id] || depth;
            const maxBarDepth = Math.max(10, ...Object.values(stats).map((s: any) => s?.depth || 0));
            const depthBarPct = maxBarDepth > 0 ? Math.min(100, (depth / maxBarDepth) * 100) : 0;
            const depthBarColor = depth <= 2 ? 'bg-tx-green' : depth <= 5 ? 'bg-tx-citron' : 'bg-tx-red';

            return (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={classNames('relative bg-tx-s2 border border-tx-bdefault rounded-2xl overflow-hidden hover:border-tx-bstrong transition-colors', !q.active && 'opacity-60')}
              >
                {/* SLA health top strip */}
                <span className={classNames(
                  'absolute top-0 left-0 right-0 h-0.5',
                  slaGood == null ? 'bg-tx-bdefault' : slaGood ? 'bg-tx-green shadow-[0_0_12px_rgba(0,192,139,0.4)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]',
                )} />
                <div className="px-4 py-3 border-b border-tx-bdefault flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {/* Pulsing green dot for active queues */}
                      {depth > 0 && (
                        <span className="relative flex w-2 h-2">
                          <span className="absolute inset-0 rounded-full bg-tx-green animate-ping opacity-75" />
                          <span className="relative rounded-full w-2 h-2 bg-tx-green" />
                        </span>
                      )}
                      <h3 className="text-sm font-semibold text-tx-tp truncate">{q.displayName || q.name}</h3>
                      {!q.active && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red uppercase tracking-wider">Inactive</span>
                      )}
                    </div>
                    <p className="text-[10px] text-tx-ts font-mono mt-0.5 truncate">{q.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModalQueue(q)}
                      className="w-7 h-7 rounded-lg bg-tx-s3 hover:bg-tx-green/15 border border-tx-bdefault hover:border-tx-green/25 text-tx-ts hover:text-tx-green flex items-center justify-center transition-all"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {q.active && (
                      <button
                        onClick={() => setConfirmDelete(q)}
                        className="w-7 h-7 rounded-lg bg-tx-s3 hover:bg-tx-red/15 border border-tx-bdefault hover:border-tx-red/25 text-tx-ts hover:text-tx-red flex items-center justify-center transition-all"
                        title="Deactivate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold text-tx-ts uppercase tracking-[0.14em]">Depth</p>
                    <div className="flex items-center gap-2">
                      <p className={classNames('text-xl font-bold tnum', depth > 0 ? 'text-tx-citron' : 'text-tx-tp')}>{depth}</p>
                      {/* Visual depth indicator bar */}
                      <div className="w-[60px] h-1.5 bg-tx-s3 rounded-full overflow-hidden">
                        <div
                          className={classNames('h-full rounded-full transition-all duration-500 ease-out', depthBarColor)}
                          style={{ width: `${depthBarPct}%` }}
                        />
                      </div>
                    </div>
                    {oldestWaitMs > 0 && (
                      <p className="text-[10px] text-tx-citron/70">Oldest: {Math.round(oldestWaitMs / 1000)}s</p>
                    )}
                    {/* Peak badge */}
                    {peak > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <TrendingUp className="w-2.5 h-2.5 text-tx-tt" />
                        <span className="text-[9px] font-semibold text-tx-tt tnum">Peak: {peak}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold text-tx-ts uppercase tracking-[0.14em]">Available</p>
                    <p className={classNames('text-xl font-bold tnum', (live.agentsAvailable || 0) > 0 ? 'text-tx-green' : 'text-tx-ts')}>
                      {live.agentsAvailable ?? 0}
                    </p>
                    <p className="text-[10px] text-tx-ts">{(live.agentsOnline ?? 0)} online · {(live.agentsInWrapUp ?? 0)} wrapping</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold text-tx-ts uppercase tracking-[0.14em]">SLA</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className={classNames(
                        'text-xl font-bold tnum',
                        slaGood == null ? 'text-tx-ts' : slaGood ? 'text-tx-green' : 'text-tx-red',
                      )}>
                        {slaPct == null ? '—' : `${slaPct}%`}
                      </p>
                      <span className="text-[10px] text-tx-ts">target {slaThreshold}%</span>
                    </div>
                    <p className="text-[10px] text-tx-ts">{q.slaTargetSeconds}s answer target</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold text-tx-ts uppercase tracking-[0.14em]">Strategy</p>
                    <p className="text-xs font-semibold text-tx-citron capitalize">{q.strategy.replace('-', ' ')}</p>
                    <p className="text-[10px] text-tx-ts">Wrap-up {q.wrapUpSeconds}s</p>
                  </div>
                </div>

                {(q.required_XqSkls?.length ?? 0) > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1">
                    {q.requiredSkills.map((s) => (
                      <span key={s.name} className="inline-flex items-center gap-1 text-[10px] bg-tx-green/10 border border-tx-citron/20 text-tx-citron px-1.5 py-0.5 rounded-md">
                        <Sparkles className="w-2.5 h-2.5" />
                        {s.name}
                        <span className="text-tx-citron/70 text-[9px] tnum">L{s.level}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="px-4 py-2 border-t border-tx-bdefault bg-tx-s2 flex items-center justify-between text-[10px] text-tx-ts">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Priority {q.priority}
                  </span>
                  <span className="flex items-center gap-1">
                    <TimerReset className="w-3 h-3" />
                    Max {q.maxWaitSeconds}s
                  </span>
                  <span className="flex items-center gap-1 capitalize">
                    <ShieldCheck className="w-3 h-3" />
                    {q.overflowAction}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modalQueue && (
          <QueueModal
            queue={modalQueue}
            onClose={() => setModalQueue(null)}
            onSaved={() => { setModalQueue(null); fetchQueues(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-tx-s1/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-tx-s2 border border-tx-bdefault rounded-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-tx-citron" />
                <h3 className="text-sm font-semibold text-tx-tp">Deactivate queue?</h3>
              </div>
              <p className="text-xs text-tx-ts">
                <span className="text-tx-tp font-semibold">{confirmDelete.displayName || confirmDelete.name}</span> will be marked inactive. Calls in flight aren't affected, but new calls won't enter this queue.
              </p>
              <div className="flex items-center justify-end gap-2 mt-5">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-semibold hover:bg-tx-s3 active:scale-[0.97] transition-all">Cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 rounded-xl bg-tx-red/15 border border-tx-red/25 text-tx-red text-xs font-semibold hover:bg-tx-red/25 active:scale-[0.97] transition-all">Deactivate</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
