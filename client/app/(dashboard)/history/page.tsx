'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TelnyxApiInfo from '../../../components/TelnyxApiInfo';
import DispositionPicker from '../../../components/DispositionPicker';
import {
  Clock,
  X,
  Brain,
  Loader2,
  ChevronLeft,
  ChevronRight,
  PhoneMissed,
  Inbox,
  MessageSquare,
  Tag as TagIcon,
  Filter,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  RotateCw,
  Download,
  Play,
  FileText,
  Phone,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Voicemail,
  ArrowDownLeft,
  ArrowUpRight,
  Cloud,
  CloudOff,
  PhoneOff,
  ExternalLink,
  User,
  Calendar,
  Zap,
} from 'lucide-react';
import api from '../../../lib/api';

/* ── Constants ────────────────────────────────────────────────────────────── */

const CASE_NOTES_STATUS_LABELS = {
  pending:              { label: 'Pending',       color: 'text-tx-ts' },
  generating:           { label: 'Generating…',   color: 'text-tx-blue' },
  done:                 { label: 'Done',          color: 'text-tx-green' },
  skipped_no_llm_key:   { label: 'AI Disabled',   color: 'text-tx-citron' },
  skipped_no_transcript:{ label: 'No Transcript',  color: 'text-tx-ts' },
  error:                { label: 'Error',          color: 'text-tx-red' },
};

const DIRECTION_OPTIONS = [
  { value: '',        label: 'All Directions' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

const STATUS_OPTIONS = [
  { value: '',          label: 'All Statuses' },
  { value: 'answered',  label: 'Answered' },
  { value: 'missed',    label: 'Missed' },
  { value: 'abandoned', label: 'Abandoned' },
  { value: 'voicemail', label: 'Voicemail' },
];

const STATUS_BADGE_MAP: Record<string, { label: string; className: string; Icon: any }> = {
  answered:  { label: 'Answered',  className: 'bg-tx-green/10 text-tx-green border-tx-green/20',   Icon: CheckCircle2 },
  missed:    { label: 'Missed',    className: 'bg-tx-red/10 text-tx-red border-tx-red/20',         Icon: PhoneMissed },
  abandoned: { label: 'Abandoned', className: 'bg-amber-400/10 text-amber-400 border-amber-400/20', Icon: PhoneOff },
  voicemail: { label: 'Voicemail', className: 'bg-purple-400/10 text-purple-300 border-purple-400/20', Icon: Voicemail },
};

const DATE_RANGE_OPTIONS = [
  { value: 'today',  label: 'Today' },
  { value: '7days',  label: '7 Days' },
  { value: '30days', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
];

const LIMIT = 25;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function fmtDuration(seconds) {
  if (!seconds) return '—';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function fmtDurationLong(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function dateRangeToParams(range) {
  const now = new Date();
  let dateFrom, dateTo;
  switch (range) {
    case 'today':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      break;
    case '7days':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
      dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      break;
    case '30days':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString();
      dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      break;
    default:
      return {};
  }
  return { dateFrom, dateTo };
}

/* ── Small Components ─────────────────────────────────────────────────────── */

function SentimentBadge({ sentiment }) {
  const map = {
    positive: 'bg-tx-green/10 text-tx-green border-tx-green/20',
    neutral:  'bg-tx-s2 text-tx-ts border-tx-bdefault',
    negative: 'bg-orange-400/10 text-orange-400 border-orange-400/15',
    urgent:   'bg-tx-red/10 text-tx-red border-tx-red/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wider ${map[sentiment] ?? map.neutral}`}>
      {sentiment}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const map = {
    low:      'bg-tx-s2 text-tx-ts border-tx-bdefault',
    medium:   'bg-tx-blue/10 text-tx-blue border-tx-blue/15',
    high:     'bg-orange-400/10 text-orange-400 border-orange-400/15',
    critical: 'bg-tx-red/10 text-tx-red border-tx-red/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wider ${map[priority] ?? map.low}`}>
      {priority}
    </span>
  );
}

function DispositionBadge({ disposition }) {
  if (!disposition) return <span className="text-tx-ts text-xs">—</span>;
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider inline-block"
      style={{
        background: `${disposition.color}22`,
        color: disposition.color,
        border: `1px solid ${disposition.color}44`,
      }}
    >
      {disposition.name}
    </span>
  );
}

function TagPill({ children }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-tx-green/10 border border-tx-green/20 text-tx-green text-[10px] font-medium">
      <TagIcon className="w-2 h-2" />
      {children}
    </span>
  );
}

function DirectionIcon({ direction }) {
  // Inbound = green arrow into the system (↙), Outbound = blue arrow leaving (↗)
  if (direction === 'inbound') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-tx-green/10 border border-tx-green/20" title="Inbound">
        <ArrowDownLeft className="w-3.5 h-3.5 text-tx-green" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-tx-blue/10 border border-tx-blue/20" title="Outbound">
      <ArrowUpRight className="w-3.5 h-3.5 text-tx-blue" strokeWidth={2.5} />
    </span>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_BADGE_MAP[status] ?? {
    label: status || 'Unknown',
    className: 'bg-tx-s2 text-tx-ts border-tx-bdefault',
    Icon: Phone,
  };
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${meta.className}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function StatusIcon({ status }) {
  switch (status) {
    case 'answered':  return <CheckCircle2 className="w-3.5 h-3.5 text-tx-green" />;
    case 'missed':    return <PhoneMissed className="w-3.5 h-3.5 text-tx-red" />;
    case 'abandoned': return <PhoneOff className="w-3.5 h-3.5 text-amber-400" />;
    case 'voicemail': return <Voicemail className="w-3.5 h-3.5 text-purple-300" />;
    default:          return <Phone className="w-3.5 h-3.5 text-tx-ts" />;
  }
}

function fmtRelativeTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return fmtDate(iso);
  const s = Math.floor(diffMs / 1000);
  if (s < 5)        return 'just now';
  if (s < 60)       return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)       return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)       return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)        return `${d}d ago`;
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}

function SortIcon({ column, sortColumn, sortDir }) {
  if (column !== sortColumn) return <ArrowUpDown className="w-3 h-3 text-tx-tt opacity-0 group-hover:opacity-50 transition-opacity" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 text-tx-green" />
    : <ArrowDown className="w-3 h-3 text-tx-green" />;
}

/* ── Skeleton Loader ──────────────────────────────────────────────────────── */

function SkeletonTable() {
  return (
    <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tx-bdefault">
            {['', 'Direction', 'From', 'To', 'Duration', 'Status', 'Queue', 'Agent', 'Disposition', 'Date'].map((h, i) => (
              <th key={i} className="px-4 py-3 text-[10px] font-semibold text-tx-tt uppercase tracking-wider">
                {h && <div className="shimmer h-3 w-12 rounded" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }).map((_, i) => (
            <tr key={i} className="border-b border-tx-bdefault">
              <td className="px-4 py-3"><div className="shimmer h-4 w-4 rounded" /></td>
              {Array.from({ length: 9 }).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="shimmer h-4 rounded" style={{ width: `${40 + Math.random() * 50}px` }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Call Detail Drawer (slide-in from right) ─────────────────────────────── */

function CallDetailDrawer({ record, onClose, onUpdated }) {
  const { caseNote, transcript } = record;
  const status = record.caseNotesStatus ?? 'pending';
  const statusMeta = CASE_NOTES_STATUS_LABELS[status] ?? CASE_NOTES_STATUS_LABELS.pending;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 34 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-tx-s1 border-l border-tx-bdefault shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tx-bdefault flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-tx-tp">Call Detail</h2>
            <p className="text-sm text-tx-ts truncate">
              {fmtDate(record.startedAt)} · {record.contact?.name || record.from} → {record.to}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Core details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">From</span>
              <p className="font-medium text-tx-tp mt-0.5 font-mono text-xs">{record.from || '—'}</p>
            </div>
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">To</span>
              <p className="font-medium text-tx-tp mt-0.5 font-mono text-xs">{record.to || '—'}</p>
            </div>
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Direction</span>
              <p className="font-medium text-tx-tp mt-0.5 capitalize flex items-center gap-1.5">
                <DirectionIcon direction={record.direction} />
                {record.direction || '—'}
              </p>
            </div>
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Duration</span>
              <p className="font-medium text-tx-tp mt-0.5">{fmtDurationLong(record.duration)}</p>
            </div>
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Status</span>
              <p className="mt-0.5"><StatusBadge status={record.status} /></p>
            </div>
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Queue</span>
              <p className="font-medium text-tx-tp mt-0.5">{record.queueName || '—'}</p>
            </div>
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Agent</span>
              <p className="font-medium text-tx-tp mt-0.5 text-xs">
                {record.agent?.user?.displayName
                  ? <a href={`/agents?id=${record.agentId}`} className="text-tx-green hover:underline flex items-center gap-1"><User className="w-3 h-3" />{record.agent.user.displayName}</a>
                  : record.agent?.extension
                    ? `ext ${record.agent.extension}`
                    : '—'}
              </p>
            </div>
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Disposition</span>
              <p className="mt-0.5"><DispositionBadge disposition={record.disposition} /></p>
            </div>
            <div className="col-span-2 bg-tx-s2 border border-tx-bdefault rounded-xl p-3">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Date</span>
              <p className="font-medium text-tx-tp mt-0.5 flex items-center gap-1.5"><Calendar className="w-3 h-3 text-tx-ts" />{fmtDate(record.startedAt)}</p>
            </div>
          </div>

          {/* Tags */}
          {record.tags?.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {record.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}
              </div>
            </div>
          )}

          {/* Contact info */}
          {record.contact && (
            <div className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Contact</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-tx-tp text-sm">{record.contact.name || record.contact.phoneNumber}</span>
                {record.contact.company && <span className="text-tx-ts text-xs">· {record.contact.company}</span>}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {record.recordingUrl && (
              <a href={`/recordings?callId=${record.callId || record.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green text-xs font-medium hover:bg-tx-green/20 transition-colors">
                <Play className="w-3 h-3" /> View Recording
              </a>
            )}
            {record.recordingUrl && (
              <a href={record.recordingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium hover:text-tx-tp transition-colors">
                <ExternalLink className="w-3 h-3" /> Open Recording
              </a>
            )}
            {record.agentId && (
              <a href={`/agents?id=${record.agentId}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-blue/10 border border-tx-blue/20 text-tx-blue text-xs font-medium hover:bg-tx-blue/20 transition-colors">
                <User className="w-3 h-3" /> View Agent
              </a>
            )}
            {(record.from || record.to) && (
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium hover:text-tx-tp transition-colors">
                <Phone className="w-3 h-3" /> Call Back
              </button>
            )}
          </div>

          {/* Disposition */}
          {record.callId && (
            <div>
              <h3 className="font-semibold text-tx-tp text-sm mb-3 flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-tx-green" />
                Disposition
              </h3>
              <DispositionPicker
                callId={record.callId}
                currentDispositionId={record.dispositionId}
                currentNotes={record.notes || ''}
                onSaved={(call) => {
                  if (onUpdated) onUpdated({
                    ...record,
                    dispositionId: call.dispositionId,
                    disposition: call.disposition,
                    notes: call.notes,
                  });
                }}
                compact
              />
            </div>
          )}

          {/* Transcript */}
          <div>
            <h3 className="font-semibold text-tx-tp text-sm mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-tx-green" />
              Transcript
            </h3>
            {transcript?.fullText ? (
              <div className="bg-tx-s3 border border-tx-bdefault rounded-xl p-4 font-mono text-sm text-tx-ts max-h-48 overflow-y-auto whitespace-pre-wrap">
                {transcript.fullText}
              </div>
            ) : (
              <p className="text-tx-ts text-sm">No transcript recorded for this call.</p>
            )}
          </div>

          {/* AI Case Notes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-tx-citron" />
              <h3 className="font-semibold text-tx-tp text-sm">AI Case Notes</h3>
              <TelnyxApiInfo
                product="Telnyx AI — Chat Completions"
                description="After each call, the transcript is sent to the Telnyx AI Chat Completions API. It uses LLaMA 3.1 with guided JSON to extract a structured case note: summary, key points, sentiment, and tasks."
                endpoint={['POST /v2/ai/chat/completions']}
                docs="https://developers.telnyx.com/api/inference"
                side="top"
                size="sm"
              />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${statusMeta.color}`}>{statusMeta.label}</span>
            </div>

            {status === 'skipped_no_llm_key' && (
              <div className="bg-tx-citron/10 border border-tx-citron/20 rounded-xl p-4 text-sm text-tx-citron">
                <p className="font-medium mb-1">AI case notes are disabled</p>
                <p className="text-xs text-tx-citron/60">Set <code className="bg-tx-citron/10 px-1.5 py-0.5 rounded border border-tx-citron/20">TELNYX_AI_ENABLED=true</code> in server/.env and restart.</p>
              </div>
            )}

            {status === 'error' && (
              <div className="bg-tx-red/10 border border-tx-red/20 rounded-xl p-4 text-sm text-tx-red">
                AI case note generation failed. Check server logs.
              </div>
            )}

            {status === 'generating' && (
              <div className="flex items-center gap-2 text-sm text-tx-blue">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating case notes…
              </div>
            )}

            {status === 'done' && caseNote && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-tx-ts">Caller:</span>
                  <span className="font-medium text-sm text-tx-tp">{caseNote.callerName || 'Unknown'}</span>
                  <SentimentBadge sentiment={caseNote.sentiment} />
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-tx-ts uppercase tracking-wider mb-1">Summary</h4>
                  <p className="text-sm text-tx-ts leading-relaxed">{caseNote.summary}</p>
                </div>

                {caseNote.keyPoints?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-tx-ts uppercase tracking-wider mb-1">Key Points</h4>
                    <ul className="space-y-1">
                      {caseNote.keyPoints.map((kp, i) => (
                        <li key={i} className="text-sm text-tx-ts flex items-start gap-2">
                          <span className="text-tx-green mt-1">•</span>{kp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {caseNote.tasks?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-tx-ts uppercase tracking-wider mb-2">Tasks</h4>
                    <div className="space-y-2">
                      {caseNote.tasks.map((task) => (
                        <div key={task.id} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-3 flex items-start gap-3">
                          <PriorityBadge priority={task.priority} />
                          <div className="flex-1">
                            <p className="font-medium text-sm text-tx-tp">{task.description}</p>
                            <p className="text-xs text-tx-ts mt-0.5">{task.type.replace('_', ' ')}{task.due && ` · due ${fmtDate(task.due)}`}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── Summary Stats Bar ────────────────────────────────────────────────────── */

function SummaryBar({ records, total }) {
  const stats = useMemo(() => {
    if (!records.length) return { total: 0, answeredPct: 0, avgDuration: 0, avgWait: 0 };
    const answered = records.filter((r) => r.status === 'answered' || r.duration > 0);
    const durations = records.filter((r) => r.duration > 0).map((r) => r.duration);
    const waits = records.filter((r) => r.timeToAnswer > 0).map((r) => r.timeToAnswer);
    return {
      total,
      answeredPct: records.length ? Math.round((answered.length / records.length) * 100) : 0,
      avgDuration: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      avgWait: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
    };
  }, [records, total]);

  return (
    <div className="flex items-center gap-6 px-4 py-2.5 bg-tx-s3/50 border border-tx-bdefault rounded-xl text-xs mb-4">
      <div className="flex items-center gap-1.5">
        <Phone className="w-3 h-3 text-tx-ts" />
        <span className="text-tx-ts">Total</span>
        <span className="font-semibold text-tx-tp">{stats.total}</span>
      </div>
      <div className="w-px h-4 bg-tx-bdefault/40" />
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3 h-3 text-tx-green" />
        <span className="text-tx-ts">Answered</span>
        <span className="font-semibold text-tx-green">{stats.answeredPct}%</span>
      </div>
      <div className="w-px h-4 bg-tx-bdefault/40" />
      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3 text-tx-blue" />
        <span className="text-tx-ts">Avg Duration</span>
        <span className="font-semibold text-tx-tp">{fmtDurationLong(stats.avgDuration)}</span>
      </div>
      <div className="w-px h-4 bg-tx-bdefault/40" />
      <div className="flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 text-tx-citron" />
        <span className="text-tx-ts">Avg Wait</span>
        <span className="font-semibold text-tx-tp">{fmtDurationLong(stats.avgWait)}</span>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function HistoryPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [expandedRow, setExpandedRow] = useState<any>(null);

  // Telnyx sync
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Dropdown data
  const [dispositions, setDispositions] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);

  // Filters
  const [filterDirection, setFilterDirection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDispositionId, setFilterDispositionId] = useState('');
  const [filterAgentId, setFilterAgentId] = useState('');
  const [filterQueueName, setFilterQueueName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('30days');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  // Sort
  const [sortColumn, setSortColumn] = useState('startedAt');
  const [sortDir, setSortDir] = useState('desc');

  // Select
  const [selectedIds, setSelectedIds] = useState(new Set());

  /* ── Fetch dropdown data ─────────────────────────────────────────────── */

  useEffect(() => {
    api.get('/dispositions').then((d) => setDispositions(Array.isArray(d) ? d : [])).catch(() => {});
    api.get('/agents').then((d) => setAgents(Array.isArray(d) ? d : [])).catch(() => {});
    api.get('/queues').then((d) => setQueues(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  /* ── Compute active filter count ─────────────────────────────────────── */

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterDirection) c++;
    if (filterStatus) c++;
    if (filterDispositionId) c++;
    if (filterAgentId) c++;
    if (filterQueueName) c++;
    if (searchQuery) c++;
    if (dateRange !== '30days') c++;
    return c;
  }, [filterDirection, filterStatus, filterDispositionId, filterAgentId, filterQueueName, searchQuery, dateRange]);

  /* ── Fetch records ───────────────────────────────────────────────────── */

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (filterDirection) params.set('direction', filterDirection);
      if (filterStatus) params.set('status', filterStatus);
      if (filterDispositionId) params.set('dispositionId', filterDispositionId);
      if (filterAgentId) params.set('agentId', filterAgentId);
      if (filterQueueName) params.set('queueName', filterQueueName);
      if (searchQuery) params.set('search', searchQuery);

      if (dateRange === 'custom' && customDateFrom && customDateTo) {
        params.set('dateFrom', new Date(customDateFrom).toISOString());
        params.set('dateTo', new Date(customDateTo).toISOString());
      } else if (dateRange !== 'custom') {
        const dr = dateRangeToParams(dateRange);
        if (dr.dateFrom) params.set('dateFrom', dr.dateFrom);
        if (dr.dateTo) params.set('dateTo', dr.dateTo);
      }

      const data = await api.get(`/history?${params}`);
      setRecords(data.records || []);
      setTotal(data.total || 0);
      if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
    } catch (err: any) {
      console.error('Failed to fetch records', err);
      setError(err.message || 'Failed to load call history');
    } finally {
      setLoading(false);
    }
  }, [page, filterDirection, filterStatus, filterDispositionId, filterAgentId, filterQueueName, searchQuery, dateRange, customDateFrom, customDateTo]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /* ── Sync from Telnyx CDR API ────────────────────────────────────────── */

  const syncFromTelnyx = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const data = await api.get('/history/sync?date_range=last_7_days&page_size=50');
      setSyncResult(data);
      if (data?.syncedAt) setLastSyncedAt(data.syncedAt);
      await fetchRecords();
    } catch (err: any) {
      console.error('Telnyx sync failed', err);
      setError(err?.data?.error || err.message || 'Telnyx sync failed');
    } finally {
      setSyncing(false);
    }
  }, [syncing, fetchRecords]);

  /* ── Reset page when filters change ──────────────────────────────────── */

  useEffect(() => { setPage(1); }, [filterDirection, filterStatus, filterDispositionId, filterAgentId, filterQueueName, searchQuery, dateRange]);

  /* ── Sorting (client-side) ───────────────────────────────────────────── */

  const sortedRecords = useMemo(() => {
    if (!sortColumn) return records;
    return [...records].sort((a, b) => {
      let va = a[sortColumn];
      let vb = b[sortColumn];
      // Special handling for nested fields
      if (sortColumn === 'disposition') { va = a.disposition?.name ?? ''; vb = b.disposition?.name ?? ''; }
      if (sortColumn === 'contact') { va = a.contact?.name ?? a.from ?? ''; vb = b.contact?.name ?? b.from ?? ''; }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, sortColumn, sortDir]);

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir('asc');
    }
  }

  /* ── Detail fetch ────────────────────────────────────────────────────── */

  async function openDetail(record) {
    try {
      const detail = await api.get(`/history/${record.id}`);
      setSelectedRecord(detail);
    } catch {
      setSelectedRecord(record);
    }
  }

  function handleRecordUpdated(updated) {
    setSelectedRecord(updated);
    setRecords((rows) => rows.map((r) => r.id === updated.id ? { ...r, disposition: updated.disposition, dispositionId: updated.dispositionId, notes: updated.notes } : r));
  }

  /* ── Select all / individual ─────────────────────────────────────────── */

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === records.length && records.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  }

  /* ── Clear all filters ──────────────────────────────────────────────── */

  function clearAllFilters() {
    setFilterDirection('');
    setFilterStatus('');
    setFilterDispositionId('');
    setFilterAgentId('');
    setFilterQueueName('');
    setSearchQuery('');
    setDateRange('30days');
    setCustomDateFrom('');
    setCustomDateTo('');
  }

  /* ── Export CSV ──────────────────────────────────────────────────────── */

  function exportCsv() {
    const headers = ['Date', 'Direction', 'From', 'To', 'Duration (s)', 'Wait (s)', 'Queue', 'Status', 'Disposition', 'Tags'];
    const rows = sortedRecords.map((r) => [
      r.startedAt || '',
      r.direction || '',
      r.contact?.name || r.from || '',
      r.to || '',
      r.duration || 0,
      r.timeToAnswer || '',
      r.queueName || '',
      r.status || '',
      r.disposition?.name || '',
      (r.tags || []).join('; '),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Pagination ──────────────────────────────────────────────────────── */

  const pages = Math.ceil(total / LIMIT);
  const pageStart = total > 0 ? (page - 1) * LIMIT + 1 : 0;
  const pageEnd = Math.min(page * LIMIT, total);

  const pageNumbers = useMemo(() => {
    const nums = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(pages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  }, [page, pages]);

  /* ── Derived queue names ─────────────────────────────────────────────── */

  const queueNames = useMemo(() => {
    const set = new Set(records.map((r) => r.queueName).filter(Boolean));
    queues.forEach((q) => { if (q.name) set.add(q.name); });
    return [...set].sort();
  }, [records, queues]);

  /* ── Row expand/collapse ─────────────────────────────────────────────── */

  function toggleRowExpand(id) {
    setExpandedRow((prev) => (prev === id ? null : id));
  }

  /* ── Select filter component ────────────────────────────────────────── */

  function FilterSelect({ value, onChange, options, label }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs focus:outline-none focus:border-tx-green/50 appearance-none cursor-pointer pr-6 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_6px_center] bg-no-repeat hover:border-tx-bdefault"
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  /* ── Sortable column header ──────────────────────────────────────────── */

  function SortableTh({ column, children, className = '' }) {
    return (
      <th
        className={`px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest group cursor-pointer select-none hover:text-tx-tp transition-colors ${className}`}
        onClick={() => handleSort(column)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <SortIcon column={column} sortColumn={sortColumn} sortDir={sortDir} />
        </span>
      </th>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────────── */


  return (
    <div className="p-6 space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-tx-red/10 border border-tx-red/20 text-tx-red text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={fetchRecords} className="px-3 py-1 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-xs font-medium hover:bg-tx-red/20 transition-colors">Retry</button>
          <button onClick={() => setError(null)} className="p-1 text-tx-red/60 hover:text-tx-red transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
            <Clock className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-tx-tp tracking-tight">Call History</h1>
              <span className="px-2 py-0.5 rounded-md bg-tx-green/10 border border-tx-green/20 text-tx-green text-[10px] font-bold tracking-wider">
                {total}
              </span>
            </div>
            <p className="text-[11px] text-tx-ts mt-0.5">Call records, transcripts, and AI case notes</p>
          </div>
          <TelnyxApiInfo
            product="Call Control — Call Records"
            description="Every call record is captured from Telnyx Call Control webhooks. Transcripts come from Telnyx's built-in STT engine. Case notes are generated post-call via Telnyx AI."
            endpoint={['GET /api/history', 'GET /api/history/:id']}
            webhook={['call.hangup', 'call.transcription', 'call.recording.saved']}
            docs="https://developers.telnyx.com/api/call-control"
            side="right"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Date range pills */}
          <div className="flex items-center gap-0.5 bg-tx-s3/50 rounded-lg p-0.5 border border-tx-bdefault">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  dateRange === opt.value
                    ? 'bg-tx-green/20 text-tx-green shadow-sm'
                    : 'text-tx-ts hover:text-tx-tp'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="px-2 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs focus:outline-none focus:border-tx-green/50"
              />
              <span className="text-tx-ts text-xs">→</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="px-2 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs focus:outline-none focus:border-tx-green/50"
              />
            </div>
          )}

          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium hover:text-tx-tp transition-colors"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button
            onClick={syncFromTelnyx}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-green/10 border border-tx-green/25 text-tx-green text-xs font-semibold hover:bg-tx-green/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Sync call records from Telnyx CDR API"
          >
            {syncing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Cloud className="w-3.5 h-3.5" />}
            {syncing ? 'Syncing…' : 'Sync from Telnyx'}
          </button>

          <button
            onClick={fetchRecords}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium hover:text-tx-tp transition-colors"
            title="Refresh"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Sync status / last-synced ───────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-[11px]">
        <div className="flex items-center gap-1.5 text-tx-ts">
          {lastSyncedAt ? (
            <>
              <Cloud className="w-3 h-3 text-tx-green" />
              <span>Last synced from Telnyx:</span>
              <span className="font-semibold text-tx-tp" title={fmtDate(lastSyncedAt)}>{fmtRelativeTime(lastSyncedAt)}</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3 h-3 text-tx-tt" />
              <span className="text-tx-tt">Not synced yet — click <span className="text-tx-green font-medium">Sync from Telnyx</span> to pull recent CDRs.</span>
            </>
          )}
        </div>
        {syncResult && !syncing && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-tx-green/10 border border-tx-green/20 text-tx-green text-[10px] font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Synced {syncResult.upserted ?? 0} of {syncResult.fetched ?? 0} CDRs from Telnyx
            <button onClick={() => setSyncResult(null)} className="ml-1 hover:text-tx-tp"><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>

      {/* ── Quick Filter Presets ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest mr-1">Quick:</span>
        <button
          onClick={() => { setDateRange('today'); }}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors border ${
            dateRange === 'today' ? 'bg-tx-green/15 border-tx-green/30 text-tx-green' : 'bg-tx-s3 border-tx-bdefault text-tx-ts hover:text-tx-tp'
          }`}
        >
          <Clock className="w-3 h-3 inline mr-1" />Today
        </button>
        <button
          onClick={() => { setDateRange('7days'); }}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors border ${
            dateRange === '7days' ? 'bg-tx-green/15 border-tx-green/30 text-tx-green' : 'bg-tx-s3 border-tx-bdefault text-tx-ts hover:text-tx-tp'
          }`}
        >
          <Calendar className="w-3 h-3 inline mr-1" />This Week
        </button>
        <button
          onClick={() => { setFilterStatus('missed'); }}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors border ${
            filterStatus === 'missed' ? 'bg-tx-red/15 border-tx-red/30 text-tx-red' : 'bg-tx-s3 border-tx-bdefault text-tx-ts hover:text-tx-tp'
          }`}
        >
          <PhoneMissed className="w-3 h-3 inline mr-1" />Missed
        </button>
        <button
          onClick={() => { setSearchQuery(''); setFilterStatus(''); setFilterDirection(''); setFilterDispositionId(''); setFilterAgentId(''); setFilterQueueName(''); }}
          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors border bg-tx-s3 border-tx-bdefault text-tx-ts hover:text-tx-tp"
          title="Show calls longer than 5 minutes"
        >
          <Zap className="w-3 h-3 inline mr-1" />Long Calls
        </button>
      </div>

      {/* ── Active Filter Pills ─────────────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filterDirection && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-tx-citron/10 border border-tx-citron/20 text-tx-citron text-[10px] font-semibold uppercase tracking-wider">
              {filterDirection}
              <button onClick={() => setFilterDirection('')} className="hover:text-tx-tp"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterStatus && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-tx-citron/10 border border-tx-citron/20 text-tx-citron text-[10px] font-semibold uppercase tracking-wider">
              {filterStatus}
              <button onClick={() => setFilterStatus('')} className="hover:text-tx-tp"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterDispositionId && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-tx-citron/10 border border-tx-citron/20 text-tx-citron text-[10px] font-semibold uppercase tracking-wider">
              {dispositions.find(d => d.id === filterDispositionId)?.name || 'Disposition'}
              <button onClick={() => setFilterDispositionId('')} className="hover:text-tx-tp"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterAgentId && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-tx-citron/10 border border-tx-citron/20 text-tx-citron text-[10px] font-semibold uppercase tracking-wider">
              {agents.find(a => a.id === filterAgentId)?.user?.displayName || 'Agent'}
              <button onClick={() => setFilterAgentId('')} className="hover:text-tx-tp"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterQueueName && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-tx-citron/10 border border-tx-citron/20 text-tx-citron text-[10px] font-semibold uppercase tracking-wider">
              {filterQueueName}
              <button onClick={() => setFilterQueueName('')} className="hover:text-tx-tp"><X className="w-3 h-3" /></button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-tx-blue/10 border border-tx-blue/20 text-tx-blue text-[10px] font-semibold">
              "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="hover:text-tx-tp"><X className="w-3 h-3" /></button>
            </span>
          )}
          {dateRange !== '30days' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green text-[10px] font-semibold uppercase tracking-wider">
              {DATE_RANGE_OPTIONS.find(d => d.value === dateRange)?.label || dateRange}
              <button onClick={() => setDateRange('30days')} className="hover:text-tx-tp"><X className="w-3 h-3" /></button>
            </span>
          )}
          <button
            onClick={clearAllFilters}
            className="text-[10px] text-tx-citron hover:text-tx-citron/80 font-medium underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Filters Bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap p-3 bg-tx-s3/30 border border-tx-bdefault rounded-xl">
        <Filter className="w-3.5 h-3.5 text-tx-ts" />
        
        <FilterSelect
          value={filterDirection}
          onChange={setFilterDirection}
          options={DIRECTION_OPTIONS}
          label="Direction"
        />

        <FilterSelect
          value={filterStatus}
          onChange={setFilterStatus}
          options={STATUS_OPTIONS}
          label="Status"
        />

        <FilterSelect
          value={filterDispositionId}
          onChange={setFilterDispositionId}
          options={[
            { value: '', label: 'All Dispositions' },
            ...dispositions.map((d) => ({ value: d.id, label: d.name })),
          ]}
          label="Disposition"
        />

        <FilterSelect
          value={filterAgentId}
          onChange={setFilterAgentId}
          options={[
            { value: '', label: 'All Agents' },
            ...agents.map((a) => ({ value: a.id, label: a.user?.displayName || a.extension || a.id.slice(0, 8) })),
          ]}
          label="Agent"
        />

        <FilterSelect
          value={filterQueueName}
          onChange={setFilterQueueName}
          options={[
            { value: '', label: 'All Queues' },
            ...queueNames.map((q) => ({ value: q, label: q })),
          ]}
          label="Queue"
        />

        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tx-tt" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phone or name…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50"
          />
        </div>
      </div>

      {/* ── Summary Stats Bar ───────────────────────────────────────────── */}
      {!loading && records.length > 0 && <SummaryBar records={records} total={total} />}

      {/* ── Data Table ──────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonTable />
      ) : records.length === 0 ? (
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-12 text-center flex flex-col items-center">
          {/* Illustration */}
          <div className="relative w-24 h-24 mb-5">
            <div className="absolute inset-0 rounded-full bg-tx-green/5 animate-pulse" />
            <div className="absolute inset-3 rounded-full bg-tx-green/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <Phone className="w-10 h-10 text-tx-green/70" strokeWidth={1.5} />
                <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-tx-s2 border-2 border-tx-green flex items-center justify-center">
                  <span className="w-1 h-1 rounded-full bg-tx-green" />
                </span>
              </div>
            </div>
          </div>
          <p className="text-tx-tp font-semibold text-base mb-1">No call records yet</p>
          <p className="text-tx-ts text-xs max-w-sm mb-4">
            {activeFilterCount > 0
              ? 'No records match your current filters. Try widening your date range or clearing some filters.'
              : 'Calls received via Telnyx will appear here automatically. You can also pull recent CDRs from the Telnyx API.'}
          </p>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-1.5 rounded-lg bg-tx-citron/10 border border-tx-citron/25 text-tx-citron text-xs font-semibold hover:bg-tx-citron/20 transition-colors"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={syncFromTelnyx}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-green/10 border border-tx-green/25 text-tx-green text-xs font-semibold hover:bg-tx-green/20 transition-colors disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
              {syncing ? 'Syncing…' : 'Sync from Telnyx'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-tx-s1 backdrop-blur-sm">
                <tr className="border-b border-tx-bdefault">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === records.length && records.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-tx-bdefault bg-tx-s3 text-tx-green focus:ring-tx-green/30 focus:ring-offset-0"
                    />
                  </th>
                  <SortableTh column="direction" className="w-16">Direction</SortableTh>
                  <SortableTh column="contact">From</SortableTh>
                  <SortableTh column="to">To</SortableTh>
                  <SortableTh column="duration">Duration</SortableTh>
                  <SortableTh column="status">Status</SortableTh>
                  <SortableTh column="queueName">Queue</SortableTh>
                  <th className="px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest">Agent</th>
                  <SortableTh column="disposition">Disposition</SortableTh>
                  <SortableTh column="startedAt">Date</SortableTh>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r, i) => {
                  const isExpanded = expandedRow === r.id;
                  const displayFrom = r.contact?.name || r.from || '—';
                  const notesStatus = r.caseNotesStatus ?? 'pending';
                  const notesMeta = CASE_NOTES_STATUS_LABELS[notesStatus] ?? CASE_NOTES_STATUS_LABELS.pending;
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                      className={`border-b border-tx-bdefault hover:bg-tx-s3 transition-colors cursor-pointer ${
                        i % 2 === 1 ? 'bg-tx-s3/40' : ''
                      } ${isExpanded ? 'bg-tx-s3' : ''}`}
                      onClick={() => toggleRowExpand(r.id)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="rounded border-tx-bdefault bg-tx-s3 text-tx-green focus:ring-tx-green/30 focus:ring-offset-0"
                        />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <DirectionIcon direction={r.direction} />
                      </td>
                      <td className="px-4 py-3 text-tx-ts">
                        <div className="flex flex-col">
                          <span className="font-medium text-tx-tp text-xs">{displayFrom}</span>
                          {r.contact?.name && <span className="text-[10px] text-tx-tt font-mono">{r.from}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-tx-ts text-xs font-mono">{r.to || '—'}</td>
                      <td className="px-4 py-3 text-tx-ts font-mono text-xs">{fmtDuration(r.duration)}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-tx-ts text-xs">{r.queueName || '—'}</td>
                      <td className="px-4 py-3 text-tx-ts text-xs">
                        {r.agent?.user?.displayName
                          ? r.agent.user.displayName
                          : r.agent?.extension
                            ? `ext ${r.agent.extension}`
                            : r.agentId
                              ? <span className="font-mono text-tx-tt">{r.agentId.slice(0, 8)}</span>
                              : '—'}
                      </td>
                      <td className="px-4 py-3"><DispositionBadge disposition={r.disposition} /></td>
                      <td className="px-4 py-3 text-tx-ts text-xs whitespace-nowrap" title={fmtDate(r.startedAt)}>{fmtDate(r.startedAt)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded row detail panel */}
          <AnimatePresence>
            {expandedRow && (() => {
              const r = sortedRecords.find((rec) => rec.id === expandedRow);
              if (!r) return null;
              const notesStatus = r.caseNotesStatus ?? 'pending';
              const notesMeta = CASE_NOTES_STATUS_LABELS[notesStatus] ?? CASE_NOTES_STATUS_LABELS.pending;
              return (
                <motion.div
                  key={`expanded-${r.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-tx-bdefault bg-tx-s3/30 overflow-hidden"
                >
                  <div className="p-4 flex items-start gap-6 text-xs">
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Direction</span>
                        <p className="text-tx-tp mt-0.5 capitalize flex items-center gap-1.5">
                          <DirectionIcon direction={r.direction} />
                          {r.direction}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Status</span>
                        <p className="text-tx-tp mt-0.5 capitalize">{r.status || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Wait Time</span>
                        <p className="text-tx-tp mt-0.5 font-mono">{r.timeToAnswer ? fmtDuration(r.timeToAnswer) : '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Case Notes</span>
                        <p className={`mt-0.5 font-semibold ${notesMeta.color}`}>{notesMeta.label}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {r.recordingUrl && (
                        <a href={r.recordingUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green text-[10px] font-medium hover:bg-tx-green/20 transition-colors">
                          <Play className="w-3 h-3" /> Recording
                        </a>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openDetail(r); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tx-blue/10 border border-tx-blue/20 text-tx-blue text-[10px] font-medium hover:bg-tx-blue/20 transition-colors"
                      >
                        <FileText className="w-3 h-3" /> Full Detail
                      </button>
                      {(r.from || r.to) && (
                        <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-[10px] font-medium hover:text-tx-tp transition-colors">
                          <Phone className="w-3 h-3" /> Call Back
                        </button>
                      )}
                    </div>
                  </div>

                  {r.tags?.length > 0 && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <TagIcon className="w-3 h-3 text-tx-tt" />
                      <div className="flex flex-wrap gap-1">
                        {r.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-tx-ts">
            Showing <span className="font-medium text-tx-tp">{pageStart}</span>–<span className="font-medium text-tx-tp">{pageEnd}</span> of <span className="font-medium text-tx-tp">{total}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium disabled:opacity-30 hover:text-tx-tp transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>

            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  n === page
                    ? 'bg-tx-green/20 text-tx-green border border-tx-green/30'
                    : 'text-tx-ts hover:bg-tx-s3 border border-transparent'
                }`}
              >
                {n}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium disabled:opacity-30 hover:text-tx-tp transition-colors"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Detail Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedRecord && <CallDetailDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} onUpdated={handleRecordUpdated} />}
      </AnimatePresence>
    </div>
  );
}
