'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  Clock,
  CheckCheck,
  AlertTriangle,
  X,
  Users,
  Calendar,
  Play,
  RefreshCw,
  Radio,
  Zap,
  ChevronRight,
  Search,
  Hash,
  MessageSquare,
  Sparkles,
  CircleX,
  Timer,
} from 'lucide-react';
import api from '../../../lib/api';
import { analyzeSms } from '../../../lib/smsSegments';
import { useSocket } from '../../../lib/socket';

/* ── Types ──────────────────────────────────────────────────────── */
interface BroadcastProgress {
  broadcastId?: string;
  total: number;
  delivered: number;
  pending: number;
  failed: number;
}

interface ScheduledSmsRow {
  id: string;
  fromNumber: string;
  toNumber: string;
  text: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  scheduledAt: string;
  sentAt: string | null;
  error: string | null;
  broadcastId?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function timeShort(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - dt.getTime()) / 60000);
  if (diffMin < 0) return 'in ' + Math.abs(diffMin) + 'm';
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + 'h ago';
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeAbs(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function mergePlaceholders(template: string, contact: any): string {
  return template
    .replace(/\{\{first_name\}\}/g, contact?.name?.split(' ')[0] || 'there')
    .replace(/\{\{name\}\}/g, contact?.name || 'Customer')
    .replace(/\{\{phone\}\}/g, contact?.phoneNumber || '')
    .replace(/\{\{company\}\}/g, contact?.company || '');
}

function initials(name: string, phone: string) {
  const n = name || phone || '?';
  const parts = n.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

const STATUS_CFG = {
  pending:   { Icon: Timer,        color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Scheduled' },
  sent:      { Icon: CheckCheck,   color: 'text-tx-green',  bg: 'bg-tx-green/10',  label: 'Sent' },
  failed:    { Icon: AlertTriangle, color: 'text-tx-red',   bg: 'bg-tx-red/10',    label: 'Failed' },
  cancelled: { Icon: CircleX,      color: 'text-tx-tt',     bg: 'bg-tx-s3',        label: 'Cancelled' },
} as const;

/* ── Sub-components ──────────────────────────────────────────────── */

function StatsBar({ history }: { history: ScheduledSmsRow[] }) {
  const total   = history.length;
  const sent    = history.filter(r => r.status === 'sent').length;
  const pending = history.filter(r => r.status === 'pending').length;
  const failed  = history.filter(r => r.status === 'failed').length;
  const denom   = total - pending;
  const rate    = denom > 0 ? Math.round((sent / denom) * 100) : 0;

  const items = [
    { label: 'Sent',          value: sent,       color: 'text-tx-green',  glow: 'shadow-[0_0_18px_rgba(0,192,139,0.12)]', Icon: CheckCheck },
    { label: 'Scheduled',     value: pending,    color: 'text-amber-400', glow: 'shadow-[0_0_18px_rgba(251,191,36,0.10)]', Icon: Clock },
    { label: 'Failed',        value: failed,     color: 'text-red-400',   glow: 'shadow-[0_0_18px_rgba(239,68,68,0.10)]',  Icon: AlertTriangle },
    { label: 'Delivery rate', value: rate + '%', color: 'text-tx-tp',     glow: '', Icon: Zap },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {items.map(({ label, value, color, glow, Icon }) => (
        <div key={label} className={`rounded-2xl border border-tx-bdefault bg-tx-s2 px-4 py-3.5 flex items-center gap-3 ${glow}`}>
          <div className="w-9 h-9 rounded-xl bg-tx-s3 flex items-center justify-center flex-shrink-0">
            <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.8} />
          </div>
          <div>
            <div className={`text-xl font-bold tabular-nums leading-none ${color}`}>{value}</div>
            <div className="text-[10px] text-tx-tt mt-0.5 uppercase tracking-widest font-medium">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecipientCard({ contact, selected, preview, onClick }: {
  contact: any; selected: boolean; preview: string | null; onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`relative w-full text-left rounded-xl border p-3 transition-all duration-150 group ${
        selected
          ? 'border-tx-green/50 bg-tx-green/8 shadow-[0_0_0_1px_rgba(0,192,139,0.12)]'
          : 'border-transparent bg-tx-s3 hover:border-tx-bdefault hover:bg-tx-s4'
      }`}
    >
      {/* Selected left accent */}
      {selected && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-tx-green" />
      )}

      <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center transition-all ${
        selected
          ? 'bg-tx-green'
          : 'border-2 border-tx-bdefault group-hover:border-tx-ts bg-transparent'
      }`}>
        {selected && <span className="text-[#060D1A] text-[9px] font-black leading-none">✓</span>}
      </div>

      <div className="flex items-center gap-2.5 pr-6 pl-1">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all ${
          selected
            ? 'gradient-primary text-white'
            : 'bg-tx-s4 text-tx-ts border border-tx-bdefault'
        }`}>
          {initials(contact.name, contact.phoneNumber)}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-tx-tp truncate leading-tight">{contact.name || contact.phoneNumber}</div>
          {contact.name && <div className="text-[10px] text-tx-tt font-mono truncate mt-0.5">{contact.phoneNumber}</div>}
        </div>
      </div>

      {preview && (
        <div className="mt-2 ml-1 px-2.5 py-2 rounded-lg bg-tx-s1 border border-tx-bdefault">
          <p className="text-[10px] text-tx-ts leading-relaxed line-clamp-2 font-mono">{preview}</p>
        </div>
      )}
    </motion.button>
  );
}

function BroadcastProgressBar({ total, delivered, pending, failed }: { total: number; delivered: number; pending: number; failed: number }) {
  if (total === 0) return null;
  const deliveredPct = (delivered / total) * 100;
  const pendingPct = (pending / total) * 100;
  const failedPct = (failed / total) * 100;
  const overallPct = Math.round((delivered / total) * 100);

  return (
    <div className="space-y-1.5">
      <div className="h-2.5 w-full rounded-full bg-tx-s4 border border-tx-bdefault overflow-hidden flex">
        {deliveredPct > 0 && (
          <div className="bg-tx-green h-full transition-all duration-500" style={{ width: `${deliveredPct}%` }} />
        )}
        {pendingPct > 0 && (
          <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${pendingPct}%` }} />
        )}
        {failedPct > 0 && (
          <div className="bg-tx-red h-full transition-all duration-500" style={{ width: `${failedPct}%` }} />
        )}
      </div>
      <p className="text-[10px] text-tx-ts tabular-nums">
        <span className="font-semibold text-tx-green">{delivered}</span> of {total} delivered ({overallPct}%)
        {pending > 0 && <span className="text-amber-400"> · {pending} pending</span>}
        {failed > 0 && <span className="text-tx-red"> · {failed} failed</span>}
      </p>
    </div>
  );
}

function HistoryRow({ row, onSendNow, onCancel }: {
  row: ScheduledSmsRow;
  onSendNow: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[row.status] ?? STATUS_CFG.cancelled;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="border border-tx-bdefault rounded-xl bg-tx-s3 overflow-hidden"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-tx-s4 transition-colors select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
          <cfg.Icon className={`w-3.5 h-3.5 ${cfg.color}`} strokeWidth={2} />
        </div>

        <div className="w-36 flex-shrink-0">
          <div className="text-xs font-mono text-tx-tp font-medium truncate">{row.toNumber}</div>
          <div className="text-[10px] text-tx-tt font-mono truncate">{row.fromNumber}</div>
        </div>

        <p className="flex-1 text-xs text-tx-ts truncate min-w-0">{row.text}</p>

        <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>

        <div className="text-right flex-shrink-0 w-20">
          <div className="text-[11px] text-tx-ts">{timeShort(row.scheduledAt)}</div>
          <div className="text-[9px] text-tx-tt">{timeAbs(row.scheduledAt)}</div>
        </div>

        {row.status === 'pending' && (
          <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onSendNow(row.id)}
              title="Send now"
              className="p-1.5 rounded-lg text-tx-green hover:bg-tx-green/15 transition-colors"
            >
              <Play className="w-3.5 h-3.5" fill="currentColor" />
            </button>
            <button
              onClick={() => onCancel(row.id)}
              title="Cancel"
              className="p-1.5 rounded-lg text-tx-tt hover:text-tx-red hover:bg-tx-red/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <ChevronRight className={`w-3.5 h-3.5 text-tx-tt transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-tx-bdefault pt-3">
              <div className="p-3 rounded-xl bg-tx-s2 border border-tx-bdefault">
                <p className="text-xs text-tx-ts whitespace-pre-wrap leading-relaxed font-mono">{row.text}</p>
              </div>
              {row.error && (
                <p className="mt-2 text-[11px] text-tx-red flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> {row.error}
                </p>
              )}
              {row.sentAt && (
                <p className="mt-1.5 text-[10px] text-tx-tt">Delivered {timeAbs(row.sentAt)}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════ */
export default function BroadcastsPage() {
  const [tab, setTab] = useState<'compose' | 'history'>('compose');

  const [numbers, setNumbers]     = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [contacts, setContacts]   = useState<any[]>([]);
  const [history, setHistory]     = useState<ScheduledSmsRow[]>([]);
  const [broadcastProgress, setBroadcastProgress] = useState<Record<string, BroadcastProgress>>({});
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const [fromNumber, setFromNumber]     = useState('');
  const [messageText, setMessageText]   = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt]   = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [historyFilter, setHistoryFilter] = useState('all');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }

  /* ── Socket: broadcast:progress ─────────────────────────────── */
  const { on } = useSocket();
  useEffect(() => {
    const unsub = on('broadcast:progress', (data: BroadcastProgress & { broadcastId: string }) => {
      if (data.broadcastId) {
        setBroadcastProgress(prev => ({ ...prev, [data.broadcastId]: data }));
      }
    });
    return unsub;
  }, [on]);

  useEffect(() => {
    Promise.all([
      api.get('/numbers').catch(() => []),
      api.get('/sms-templates').catch(() => []),
    ]).then(([nums, tmpls]) => {
      const sms = (nums as any[]).filter(n => n.smsEnabled !== false);
      setNumbers(sms);
      if (sms.length > 0) setFromNumber(sms[0].phoneNumber);
      setTemplates(tmpls as any[]);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingContacts(true);
    api.get(`/contacts?search=${encodeURIComponent(contactSearch)}&limit=300`)
      .then((d: any) => { if (!cancelled) setContacts(Array.isArray(d) ? d : d.contacts || []); })
      .catch(() => { if (!cancelled) setContacts([]); })
      .finally(() => { if (!cancelled) setLoadingContacts(false); });
    return () => { cancelled = true; };
  }, [contactSearch]);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab]);

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const d = await api.get('/scheduled-sms');
      setHistory(Array.isArray(d) ? d : []);
    } catch { setHistory([]); }
    finally { setLoadingHistory(false); }
  }

  const smsInfo = analyzeSms(messageText);

  const filteredContacts = useMemo(() =>
    contacts.filter(c => {
      if (!c.phoneNumber || c.metadata?.optOut) return false;
      if (!contactSearch) return true;
      const q = contactSearch.toLowerCase();
      return (c.name || '').toLowerCase().includes(q) || c.phoneNumber.includes(q);
    }),
    [contacts, contactSearch],
  );

  const filteredHistory = useMemo(() => {
    let rows = history;
    if (historyFilter !== 'all') rows = rows.filter(r => r.status === historyFilter);
    if (historySearch) {
      const q = historySearch.toLowerCase();
      rows = rows.filter(r => r.toNumber.includes(q) || r.text.toLowerCase().includes(q));
    }
    return rows;
  }, [history, historyFilter, historySearch]);

  const allSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedContacts.has(c.id));

  function toggleContact(id: string) {
    setSelectedContacts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedContacts(prev => { const n = new Set(prev); filteredContacts.forEach(c => n.delete(c.id)); return n; });
    } else {
      setSelectedContacts(prev => { const n = new Set(prev); filteredContacts.forEach(c => n.add(c.id)); return n; });
    }
  }

  async function sendBroadcast() {
    if (!fromNumber)             return showToast('Select a from number', false);
    if (!messageText.trim())     return showToast('Enter a message', false);
    if (selectedContacts.size === 0) return showToast('Select at least one recipient', false);
    if (scheduleMode === 'later' && !scheduledAt) return showToast('Set a scheduled time', false);

    const recipients = contacts.filter(c => selectedContacts.has(c.id));
    setSending(true);
    let ok = 0, fail = 0;

    await Promise.all(recipients.map(async c => {
      try {
        await api.post('/scheduled-sms', {
          fromNumber,
          toNumber: c.phoneNumber,
          text: mergePlaceholders(messageText, c),
          scheduledAt: scheduleMode === 'later'
            ? new Date(scheduledAt).toISOString()
            : new Date(Date.now() + 3000).toISOString(),
        });
        ok++;
      } catch { fail++; }
    }));

    setSending(false);
    showToast(
      `${ok} message${ok !== 1 ? 's' : ''} ${scheduleMode === 'later' ? 'scheduled' : 'queued'}${fail ? ` · ${fail} failed` : ''}`,
      fail === 0,
    );
    setSelectedContacts(new Set());
    setMessageText('');
  }

  /* ── Compute progress per broadcastId from history rows ──── */
  useEffect(() => {
    const grouped: Record<string, BroadcastProgress> = {};
    for (const row of history) {
      const bid = row.broadcastId || row.id;
      if (!grouped[bid]) grouped[bid] = { broadcastId: bid, total: 0, delivered: 0, pending: 0, failed: 0 };
      grouped[bid].total++;
      if (row.status === 'sent') grouped[bid].delivered++;
      else if (row.status === 'pending') grouped[bid].pending++;
      else if (row.status === 'failed') grouped[bid].failed++;
    }
    setBroadcastProgress(prev => {
      const next = { ...prev };
      for (const [id, prog] of Object.entries(grouped)) {
        if (!next[id]) next[id] = prog;
      }
      return next;
    });
  }, [history]);

  async function refreshBroadcastStatus(broadcastId: string) {
    setRefreshingIds(prev => new Set(prev).add(broadcastId));
    try {
      const d = await api.get('/scheduled-sms');
      const allRows = Array.isArray(d) ? d : [];
      const broadcastRows = allRows.filter((r: ScheduledSmsRow) => r.broadcastId === broadcastId);
      if (broadcastRows.length > 0) {
        const total = broadcastRows.length;
        const delivered = broadcastRows.filter((r: ScheduledSmsRow) => r.status === 'sent').length;
        const failed = broadcastRows.filter((r: ScheduledSmsRow) => r.status === 'failed').length;
        const pending = broadcastRows.filter((r: ScheduledSmsRow) => r.status === 'pending').length;
        setBroadcastProgress(prev => ({
          ...prev,
          [broadcastId]: { broadcastId, total, delivered, pending, failed },
        }));
      }
      showToast('Status refreshed');
    } catch {
      showToast('Refresh failed', false);
    } finally {
      setRefreshingIds(prev => { const n = new Set(prev); n.delete(broadcastId); return n; });
    }
  }

  async function cancelRow(id: string) {
    try {
      await api.delete(`/scheduled-sms/${id}`);
      setHistory(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' as const } : r));
    } catch (e: any) { showToast(e.message || 'Cancel failed', false); }
  }

  async function sendNowRow(id: string) {
    try {
      await api.post(`/scheduled-sms/${id}/send-now`, {});
      setHistory(prev => prev.map(r => r.id === id ? { ...r, status: 'sent' as const, sentAt: new Date().toISOString() } : r));
      showToast('Sent');
    } catch (e: any) { showToast(e.message || 'Send failed', false); }
  }

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
            <Send className="w-5 h-5 text-tx-tp" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-tx-tp tracking-tight leading-tight">SMS Broadcasts</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Radio className="w-2.5 h-2.5 text-tx-green" />
              <span className="text-[11px] text-tx-ts">Personalised one-to-many campaigns with scheduling &amp; delivery tracking</span>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 p-1 rounded-xl bg-tx-s2 border border-tx-bdefault">
          {([['compose', 'Compose'], ['history', 'Activity']] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              {tab === t && (
                <motion.div
                  layoutId="tab-pill"
                  className="absolute inset-0 gradient-primary rounded-lg"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className={`relative ${tab === t ? 'text-tx-tp' : 'text-tx-tt hover:text-tx-ts'}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ══════ COMPOSE TAB ══════ */}
        {tab === 'compose' && (
          <motion.div
            key="compose"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex-1 grid grid-cols-[1fr_320px] gap-5 min-h-0"
          >
            {/* Left — composer */}
            <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">

              {/* From number */}
              <div className="rounded-2xl border border-tx-bdefault bg-tx-s2 p-4">
                <p className="text-[10px] font-bold text-tx-tt uppercase tracking-widest mb-3">Send from</p>
                {numbers.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-tx-ts">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    No SMS-enabled numbers — add one in Numbers settings
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {numbers.map(n => (
                      <button
                        key={n.id}
                        onClick={() => setFromNumber(n.phoneNumber)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          fromNumber === n.phoneNumber
                            ? 'border-tx-green/60 bg-tx-green/10 text-tx-tp shadow-[0_0_12px_rgba(0,192,139,0.12)]'
                            : 'border-tx-bdefault bg-tx-s3 text-tx-ts hover:border-tx-bstrong hover:bg-tx-s4 hover:text-tx-tp'
                        }`}
                      >
                        <Hash className={`w-3 h-3 ${fromNumber === n.phoneNumber ? 'text-tx-green' : 'text-tx-tt'}`} />
                        <span className="font-mono">{n.phoneNumber}</span>
                        {n.label && <span className={fromNumber === n.phoneNumber ? 'text-tx-ts' : 'text-tx-tt'}>· {n.label}</span>}
                        {n.numberType && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                            fromNumber === n.phoneNumber ? 'bg-tx-green/20 text-tx-green' : 'bg-tx-s1 text-tx-tt'
                          }`}>
                            {n.numberType.replace('_', ' ')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="rounded-2xl border border-tx-bdefault bg-tx-s2 p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Message</p>
                  <div className="flex items-center gap-3">
                    {templates.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={e => {
                          const t = templates.find(x => x.id === e.target.value);
                          if (t) setMessageText(t.body || t.content || '');
                          (e.target as HTMLSelectElement).value = '';
                        }}
                        className="text-[11px] bg-tx-s3 border border-tx-bdefault rounded-lg px-2 py-1 text-tx-ts focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] cursor-pointer"
                      >
                        <option value="" className="bg-tx-s1">Load template…</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id} className="bg-tx-s1">{t.name || t.title}</option>
                        ))}
                      </select>
                    )}
                    <span
                      title={`${smsInfo.encoding} · ${smsInfo.unitCount} units · ${smsInfo.segmentCount} segment${smsInfo.segmentCount !== 1 ? 's' : ''} · ${smsInfo.remainingInSegment} remaining`}
                      className={`flex items-center gap-1 text-[11px] tabular-nums cursor-help font-medium ${
                        smsInfo.segmentCount > 3 ? 'text-tx-red' :
                        smsInfo.segmentCount > 1 || smsInfo.emojiOrUnicode ? 'text-amber-400' : 'text-tx-tt'
                      }`}
                    >
                      <MessageSquare className="w-3 h-3" />
                      {smsInfo.charCount} · {smsInfo.encoding === 'UCS-2' ? 'Unicode' : 'GSM-7'} · {smsInfo.segmentCount}×
                    </span>
                  </div>
                </div>

                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder={'Hi {{first_name}}, we wanted to reach out…'}
                  rows={7}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] resize-none font-mono leading-relaxed transition-all"
                />

                {/* Merge chips */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <Sparkles className="w-3 h-3 text-tx-tt flex-shrink-0" />
                  <span className="text-[10px] text-tx-tt">Insert:</span>
                  {['{{first_name}}', '{{name}}', '{{phone}}', '{{company}}'].map(f => (
                    <button
                      key={f}
                      onClick={() => setMessageText(t => t + f)}
                      className="px-1.5 py-0.5 rounded bg-tx-s3 border border-tx-bdefault text-[10px] text-tx-ts hover:text-tx-tp hover:border-tx-green/40 transition-colors font-mono"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery timing */}
              <div className="rounded-2xl border border-tx-bdefault bg-tx-s2 p-4">
                <p className="text-[10px] font-bold text-tx-tt uppercase tracking-widest mb-3">Delivery</p>
                <div className="flex items-center gap-2 mb-3">
                  {(['now', 'later'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setScheduleMode(m)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        scheduleMode === m
                          ? 'border-tx-green/60 bg-tx-green/10 text-tx-tp shadow-[0_0_12px_rgba(0,192,139,0.12)]'
                          : 'border-tx-bdefault bg-tx-s3 text-tx-ts hover:border-tx-bstrong hover:bg-tx-s4 hover:text-tx-tp'
                      }`}
                    >
                      {m === 'now'
                        ? <><Zap className="w-3.5 h-3.5" /> Send immediately</>
                        : <><Calendar className="w-3.5 h-3.5" /> Schedule</>
                      }
                    </button>
                  ))}
                </div>
                {scheduleMode === 'later' && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all"
                  />
                )}
              </div>

              {/* Send CTA */}
              <motion.button
                onClick={sendBroadcast}
                disabled={sending || selectedContacts.size === 0 || !messageText.trim() || !fromNumber}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-2xl gradient-primary text-white text-sm font-semibold shadow-lg shadow-tx-green/15 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
              >
                {sending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : <><Send className="w-4 h-4" /> {scheduleMode === 'later' ? 'Schedule' : 'Send'} to {selectedContacts.size} recipient{selectedContacts.size !== 1 ? 's' : ''}</>
                }
              </motion.button>
            </div>

            {/* Right — recipients */}
            <div className="rounded-2xl border border-tx-bdefault bg-tx-s2 flex flex-col overflow-hidden min-h-0">
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-tx-bdefault flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-tx-ts" />
                  <span className="text-sm font-semibold text-tx-tp">Recipients</span>
                  {selectedContacts.size > 0 && (
                    <span className="px-2 py-0.5 rounded-full gradient-primary text-white text-[10px] font-bold">
                      {selectedContacts.size}
                    </span>
                  )}
                </div>
                <button
                  onClick={toggleAll}
                  className="text-[10px] font-medium text-tx-ts hover:text-tx-tp transition-colors"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Search */}
              <div className="px-3 py-2 border-b border-tx-bdefault">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-tx-tt" />
                  <input
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Search contacts…"
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-tx-s4 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50"
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
                {loadingContacts ? (
                  <div className="col-span-full flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-tx-ts" />
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-10 text-tx-tt">
                    <Users className="w-6 h-6 mb-2" />
                    <p className="text-xs">{contactSearch ? 'No matches' : 'No contacts with phone numbers'}</p>
                  </div>
                ) : filteredContacts.map(c => (
                  <RecipientCard
                    key={c.id}
                    contact={c}
                    selected={selectedContacts.has(c.id)}
                    preview={messageText ? mergePlaceholders(messageText.slice(0, 80), c) : null}
                    onClick={() => toggleContact(c.id)}
                  />
                ))}
              </div>

              {contacts.some(c => c.metadata?.optOut) && (
                <div className="px-4 py-2 border-t border-tx-bdefault text-[10px] text-tx-tt flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Opted-out contacts hidden automatically
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══════ HISTORY TAB ══════ */}
        {tab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <StatsBar history={history} />

            {/* Broadcast delivery progress section */}
            {Object.keys(broadcastProgress).length > 0 && (
              <div className="mb-5 space-y-3">
                <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Broadcast Delivery</span>
                {Object.values(broadcastProgress).map((prog) => (
                  <div key={prog.broadcastId} className="rounded-xl border border-tx-bdefault bg-tx-s2 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-tx-green" />
                        <span className="text-xs font-semibold text-tx-tp font-mono">{prog.broadcastId.slice(0, 8)}…</span>
                      </div>
                      <button
                        onClick={() => refreshBroadcastStatus(prog.broadcastId)}
                        disabled={refreshingIds.has(prog.broadcastId)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-[10px] font-medium hover:text-tx-tp transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${refreshingIds.has(prog.broadcastId) ? 'animate-spin' : ''}`} />
                        Refresh Status
                      </button>
                    </div>
                    <BroadcastProgressBar
                      total={prog.total}
                      delivered={prog.delivered}
                      pending={prog.pending}
                      failed={prog.failed}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-tx-bdefault bg-tx-s2 flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="px-4 pt-4 pb-3 border-b border-tx-bdefault flex items-center gap-3 flex-wrap">
                {/* Filter pills */}
                <div className="flex items-center gap-1">
                  {(['all', 'pending', 'sent', 'failed', 'cancelled'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setHistoryFilter(f)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        historyFilter === f ? 'gradient-primary text-white' : 'text-tx-tt hover:text-tx-ts'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-tx-tt" />
                  <input
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Search messages…"
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50"
                  />
                </div>

                <div className="flex-1" />

                <button
                  onClick={fetchHistory}
                  className="p-1.5 rounded-lg text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Message feed */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-tx-ts" />
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-tx-tt">
                    <MessageSquare className="w-8 h-8 mb-3" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1 text-tx-tt">Send a broadcast from the Compose tab</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {filteredHistory.map(row => (
                      <HistoryRow
                        key={row.id}
                        row={row}
                        onSendNow={sendNowRow}
                        onCancel={cancelRow}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-xl text-sm font-medium ${
              toast.ok
                ? 'bg-tx-s2 border-tx-green/30 text-tx-tp'
                : 'bg-tx-s2 border-tx-red/30 text-tx-red'
            }`}
          >
            {toast.ok ? <CheckCheck className="w-4 h-4 text-tx-green" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
