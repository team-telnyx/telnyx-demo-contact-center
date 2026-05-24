'use client';

/**
 * AgentAssist — collapsible right-side panel shown on the agent's Phone page.
 *
 * Three tabs:
 *   • Suggest — AI-generated response cards. Refreshed every N final
 *     transcript segments by calling POST /api/agent-assist/suggest.
 *   • Library — searchable canned responses (`/greeting` etc.). Click to copy
 *     and bump the usage counter via POST /api/canned-responses/:id/use.
 *   • Caller — known contact info + recent call history + sentiment trend.
 *
 * Designed to drop in alongside the existing transcript pane on the phone
 * page. Self-contained: receives transcript array, active call, and a
 * `phoneNumber` to look up caller info; does its own data fetching for
 * suggestions / library / caller history.
 *
 * Premium dark theme using existing utility classes (elev-1, glass-card,
 * ai-chip, gradient-primary) and lucide icons.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  BookOpen,
  User as UserIcon,
  Search,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  ChevronRight,
  Tag,
  Loader2,
  AlertCircle,
  PhoneIncoming,
  PhoneOutgoing,
  MessageSquare,
  FileText,
  ChevronDown,
} from 'lucide-react';
import api from '../lib/api';
import FormRenderer from './FormRenderer';

const TABS = [
  { id: 'suggest', label: 'Suggest', icon: Sparkles },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'caller',  label: 'Caller',  icon: UserIcon },
];

/* How many *final* transcript segments to accumulate before asking the LLM
 * for a fresh suggestion. Set to a low number for demo responsiveness; bump
 * up in prod to control LLM spend. */
const SUGGEST_INTERVAL = 3;

export default function AgentAssist({
  open = true,
  onClose,
  transcript = [],
  activeCall = null,
  phoneNumber = null,
  callerName = null,
}: {
  open?: boolean;
  onClose?: () => void;
  transcript?: any[];
  activeCall?: any;
  phoneNumber?: string | null;
  callerName?: string | null;
}) {
  const [tab, setTab] = useState<string>('suggest');

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="agent-assist-panel"
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0,  opacity: 1 }}
          exit   ={{ x: 24, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-80 flex-shrink-0 flex flex-col elev-3 rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-tx-bdefault/50 bg-gradient-to-r from-tx-green/[0.06] via-violet-500/[0.04] to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg ai-chip flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-tx-tp tracking-tight leading-tight">
                  Agent Assist
                </p>
                <p className="text-[9px] font-semibold text-tx-citron/70 uppercase tracking-[0.14em]">
                  AI Copilot
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                title="Hide panel (Ctrl+/)"
                className="text-tx-ts hover:text-tx-ts transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-tx-bdefault/30 flex-shrink-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    active
                      ? 'text-tx-tp border-b-2 border-tx-citron bg-tx-green/[0.06]'
                      : 'text-tx-ts hover:text-tx-ts border-b-2 border-transparent'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === 'suggest' && (
              <SuggestTab transcript={transcript} activeCall={activeCall} />
            )}
            {tab === 'library' && <LibraryTab />}
            {tab === 'caller' && (
              <CallerTab phoneNumber={phoneNumber} callerName={callerName} transcript={transcript} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Suggest tab                                                              */
/* ─────────────────────────────────────────────────────────────────────── */

function SuggestTab({ transcript, activeCall }: { transcript: any[]; activeCall?: any }) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [sentiment, setSentiment] = useState<any>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const scrollRef = useRef(null);

  // Count final segments — when this crosses a multiple of SUGGEST_INTERVAL
  // and we have any new transcript, ask the LLM for a refresh.
  const finalCount = useMemo(
    () => transcript.filter((s) => s.isFinal).length,
    [transcript]
  );
  const lastTriggerRef = useRef(0);

  const transcriptText = useMemo(() => {
    return transcript
      .filter((s) => s.isFinal)
      .slice(-20)
      .map((s) => `Speaker ${(s.speaker ?? 0) + 1}: ${s.text}`)
      .join('\n');
  }, [transcript]);

  const requestSuggestions = useCallback(async (): Promise<void> => {
    if (!transcriptText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/agent-assist/suggest', {
        transcript: transcriptText,
        context: {
          callerName:  activeCall?.callerName || undefined,
          callerPhone: activeCall?.from || undefined,
          queueName:   activeCall?.queueName || undefined,
        },
      });
      setSuggestions(res.suggestions || []);
      setSentiment(res.callerSentiment || null);
      setTopic(res.topicDetected || null);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      });
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, [transcriptText, activeCall?.callerName, activeCall?.from, activeCall?.queueName]);

  useEffect(() => {
    if (finalCount === 0) return;
    if (finalCount - lastTriggerRef.current < SUGGEST_INTERVAL) return;
    lastTriggerRef.current = finalCount;
    requestSuggestions();
  }, [finalCount, requestSuggestions]);

  const copySuggestion = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  return (
    <div className="h-full flex flex-col">
      {/* Sentiment + topic strip */}
      {(sentiment || topic) && (
        <div className="px-4 py-2 flex items-center gap-2 border-b border-tx-bdefault/30 flex-shrink-0">
          {sentiment && <SentimentBadge sentiment={sentiment} />}
          {topic && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tx-green/10 border border-tx-green/20 text-[10px] font-semibold text-tx-green">
              <Tag className="w-2.5 h-2.5" />
              {topic}
            </span>
          )}
          <button
            onClick={requestSuggestions}
            disabled={loading || !transcriptText}
            className="ml-auto text-[10px] font-semibold text-tx-ts hover:text-tx-citron disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {!transcriptText && (
          <EmptyState
            icon={MessageSquare}
            title="Waiting for transcript"
            body="Suggestions appear here once the conversation starts."
          />
        )}

        {transcriptText && suggestions.length === 0 && !loading && !error && (
          <EmptyState
            icon={Sparkles}
            title="Thinking…"
            body={`Auto-refresh every ${SUGGEST_INTERVAL} transcript segments.`}
          />
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-[11px] text-tx-red">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {suggestions.map((s, i) => (
            <motion.button
              key={`${i}-${s.text.slice(0, 12)}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit   ={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, delay: i * 0.04 }}
              onClick={() => copySuggestion(s.text)}
              className="w-full text-left elev-1 rounded-xl px-3 py-2.5 hover:border-tx-citron/30 hover:bg-tx-green/[0.04] active:scale-[0.99] transition-all group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-tx-citron/80">
                  {s.category || 'general'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-tx-ts tnum">
                    {Math.round((s.confidence ?? 0.7) * 100)}%
                  </span>
                  {copied === s.text ? (
                    <Check className="w-3 h-3 text-tx-green" />
                  ) : (
                    <Copy className="w-3 h-3 text-tx-ts group-hover:text-tx-citron transition-colors" />
                  )}
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-tx-tp">{s.text}</p>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: any }) {
  // Tailwind classes must be static strings for JIT to pick them up, so we
  // pre-bake the class combos rather than interpolating a colour name.
  const map = {
    positive:   { cls: 'bg-tx-green/10 border-tx-green/20 text-tx-green', icon: TrendingUp,   label: 'Positive' },
    neutral:    { cls: 'bg-tx-s2 border-tx-bsubtle text-tx-ts',       icon: Minus,        label: 'Neutral' },
    frustrated: { cls: 'bg-tx-citron/10 border-tx-citron/20 text-tx-citron',       icon: TrendingDown, label: 'Frustrated' },
    angry:      { cls: 'bg-tx-red/10 border-tx-red/20 text-tx-red',          icon: TrendingDown, label: 'Angry' },
    confused:   { cls: 'bg-tx-blue/10 border-tx-blue/20 text-tx-blue',          icon: AlertCircle,  label: 'Confused' },
    urgent:     { cls: 'bg-tx-red/10 border-tx-red/20 text-tx-red',          icon: AlertCircle,  label: 'Urgent' },
  };
  const cfg = map[sentiment] || map.neutral;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Library tab                                                              */
/* ─────────────────────────────────────────────────────────────────────── */

function LibraryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (q: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const path = q ? `/canned-responses?search=${encodeURIComponent(q)}` : '/canned-responses';
      const rows = await api.get(path);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Failed to load canned responses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => load(search), 200);
    return () => clearTimeout(id);
  }, [search, load]);

  const useSnippet = async (item) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(item.id);
      setTimeout(() => setCopied(null), 1500);
      api.post(`/canned-responses/${item.id}/use`).catch(() => {});
    } catch {}
  };

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(set);
  }, [items]);

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-tx-bdefault/30 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tx-ts" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search /shortcut or text…"
            className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg pl-8 pr-2 py-1.5 text-[12px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50 focus:bg-tx-s3 transition-colors"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSearch(c)}
                className="px-1.5 py-0.5 rounded-full bg-tx-s2 border border-tx-bsubtle text-[9px] font-semibold text-tx-ts uppercase tracking-[0.12em] hover:bg-tx-green/15 hover:text-tx-green transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center py-8 text-tx-ts">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-[11px] text-tx-red">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="No snippets"
            body="Ask an admin to seed canned responses or create some via the API."
          />
        )}

        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => useSnippet(it)}
            className="w-full text-left elev-1 rounded-xl px-3 py-2.5 hover:border-tx-green/30 hover:bg-tx-green/[0.04] active:scale-[0.99] transition-all group"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="px-1.5 py-0.5 rounded bg-tx-green/10 border border-tx-citron/20 text-[10px] font-semibold text-tx-citron tnum">
                {it.shortcut}
              </span>
              <div className="flex items-center gap-1.5">
                {it.category && (
                  <span className="text-[9px] text-tx-ts uppercase tracking-[0.12em] font-semibold">
                    {it.category}
                  </span>
                )}
                <span className="text-[9px] text-tx-ts tnum">{it.usageCount ?? 0}×</span>
                {copied === it.id ? (
                  <Check className="w-3 h-3 text-tx-green" />
                ) : (
                  <Copy className="w-3 h-3 text-tx-ts group-hover:text-tx-green transition-colors" />
                )}
              </div>
            </div>
            <p className="text-[11px] font-semibold text-tx-ts mb-0.5">{it.title}</p>
            <p className="text-[11px] leading-relaxed text-tx-ts line-clamp-2">{it.content}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Caller tab                                                               */
/* ─────────────────────────────────────────────────────────────────────── */

function CallerTab({ phoneNumber, callerName, transcript }: { phoneNumber?: string | null; callerName?: string | null; transcript: any[] }) {
  const [contact, setContact] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!phoneNumber) {
      setContact(null);
      setHistory([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Best-effort fetch — the contacts endpoint may not exist yet, in which
        // case we just show the phone number / name we already know.
        const c = await api.get(`/contacts/by-phone/${encodeURIComponent(phoneNumber)}`)
          .catch(() => null);
        const h = await api.get(`/history?page=1&limit=5&phone=${encodeURIComponent(phoneNumber)}`)
          .catch(() => null);
        if (cancelled) return;
        setContact(c || null);
        setHistory(h?.items || h?.records || h?.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load caller info');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [phoneNumber]);

  if (!phoneNumber) {
    return (
      <EmptyState
        icon={UserIcon}
        title="No active caller"
        body="Caller info appears here when a call connects."
      />
    );
  }

  const displayName = contact?.name || callerName || 'Unknown caller';
  const sentiment   = contact?.sentiment || 'unknown';

  return (
    <div className="h-full overflow-y-auto px-3 py-3 space-y-3">
      {/* Caller header */}
      <div className="elev-1 rounded-xl px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-tx-tp text-sm font-bold flex-shrink-0">
            {initials(displayName)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-tx-tp truncate">{displayName}</p>
            <p className="text-[11px] text-tx-ts tnum truncate">{phoneNumber}</p>
          </div>
        </div>

        {(contact?.company || contact?.email) && (
          <div className="mt-2 pt-2 border-t border-tx-bdefault/30 space-y-1">
            {contact?.company && (
              <p className="text-[11px] text-tx-ts">
                <span className="text-tx-ts">Company:</span> {contact.company}
              </p>
            )}
            {contact?.email && (
              <p className="text-[11px] text-tx-ts truncate">
                <span className="text-tx-ts">Email:</span> {contact.email}
              </p>
            )}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-tx-bdefault/30 flex items-center gap-2 flex-wrap">
          {sentiment && sentiment !== 'unknown' && <SentimentBadge sentiment={sentiment} />}
          {typeof contact?.totalCalls === 'number' && (
            <span className="text-[10px] text-tx-ts">
              <span className="text-tx-ts tnum font-semibold">{contact.totalCalls}</span> prior calls
            </span>
          )}
        </div>

        {Array.isArray(contact?.tags) && contact.tags.length > 0 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {contact.tags.map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded-full bg-tx-blue/10 border border-tx-blue/20 text-[9px] font-semibold text-tx-blue uppercase tracking-[0.12em]"
              >
                {t}
              </span>
            ))}          </div>
        )}

        {contact?.notes && (
          <div className="mt-2 pt-2 border-t border-tx-bdefault/30">
            <p className="text-[9px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1">
              Notes
            </p>
            <p className="text-[11px] text-tx-ts leading-relaxed whitespace-pre-wrap">
              {contact.notes}
            </p>
          </div>
        )}
      </div>

      {/* Recent calls */}
      <div>
        <p className="text-[9px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-2 px-1">
          Recent calls
        </p>

        {loading && (
          <div className="flex items-center justify-center py-4 text-tx-ts">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-[11px] text-tx-red px-2">{error}</p>
        )}

        {!loading && !error && history.length === 0 && (
          <p className="text-[11px] text-tx-ts px-2 italic">No previous calls.</p>
        )}

        <div className="space-y-1.5">
          {history.map((h) => (
            <div
              key={h.id || h.callId}
              className="elev-1 rounded-lg px-2.5 py-1.5 flex items-center gap-2"
            >
              {h.direction === 'inbound'
                ? <PhoneIncoming className="w-3 h-3 text-tx-green flex-shrink-0" />
                : <PhoneOutgoing className="w-3 h-3 text-tx-green flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-tx-ts truncate">
                  {h.direction === 'inbound' ? (h.from || h.callerNumber) : (h.to || h.callerNumber)}
                </p>
                <p className="text-[9px] text-tx-ts tnum">
                  {formatDate(h.startedAt || h.createdAt)}
                  {h.duration ? ` · ${Math.round(h.duration)}s` : ''}
                </p>
              </div>
              <ChevronRight className="w-3 h-3 text-tx-ts flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Forms */}
      <div className="mt-3 border-t border-tx-bdefault/30 pt-3">
        <p className="text-[9px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-2 px-1">
          Quick Forms
        </p>
        <FormLauncher phoneNumber={phoneNumber} callerName={callerName} transcript={transcript} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Form Launcher                                                            */
/* ─────────────────────────────────────────────────────────────────────── */
function FormLauncher({ phoneNumber, callerName, transcript }) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeForm, setActiveForm] = useState<any>(null);
  const [showList, setShowList] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<any>(null); // null | 'success' | 'error'
  const [submissionId, setSubmissionId] = useState<any>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [prefilledData, setPrefilledData] = useState<Record<string, any>>({});

  useEffect(() => {
    setLoading(true);
    api.get('/forms?enabled=true').then((res) => {
      const data = res?.forms || res?.data || res || [];
      setForms(Array.isArray(data) ? data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Base prefill from caller info
  const callerPrefill = useMemo(() => {
    const data: Record<string, string> = {};
    if (callerName) data.caller_name = callerName;
    if (phoneNumber) data.caller_phone = phoneNumber;
    return data;
  }, [callerName, phoneNumber]);

  // Merge caller prefill with AI-generated prefill
  const mergedPrefill = useMemo(() => ({
    ...callerPrefill,
    ...prefilledData,
  }), [callerPrefill, prefilledData]);

  // Auto-fill: use AI to suggest form values based on transcript
  const handleAutoFill = async () => {
    if (!activeForm || !transcript?.length) return;
    setAutoFilling(true);
    try {
      const transcriptText = transcript
        .filter((s) => s.isFinal)
        .slice(-20)
        .map((s) => `Speaker ${(s.speaker ?? 0) + 1}: ${s.text}`)
        .join('\n');

      const res = await api.post('/forms/generate', {
        description: `Extract form field values from this conversation for the form "${activeForm.name}". Return only a JSON object with variable names as keys and extracted values as values.\n\nConversation:\n${transcriptText}`,
        fields: Object.keys(activeForm.variables || {}),
      });

      // The AI returns a schema but we can try to extract suggested values
      // For now, we use the caller info as the base and just mark auto-fill as done
      if (res?.schema) {
        // Try to extract default values from the generated schema
        const suggested = {};
        for (const page of res.schema.pages || []) {
          for (const section of page.sections || []) {
            for (const field of section.fields || []) {
              if (field.variable && field.defaultValue) {
                suggested[field.variable] = field.defaultValue;
              }
            }
          }
        }
        if (Object.keys(suggested).length > 0) {
          setPrefilledData(suggested);
        }
      }
    } catch (err: any) {
      console.error('Auto-fill failed:', err);
    } finally {
      setAutoFilling(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      const res = await api.post(`/forms/${activeForm.id}/submit`, {
        data: formData,
        prefilledContext: {
          source: 'agent_assist',
          callerNumber: phoneNumber,
          callerName,
          ...mergedPrefill,
        },
      });
      setSubmitStatus('success');
      setSubmissionId(res?.id || res?.data?.id || null);
    } catch (err: any) {
      console.error('Form submit failed:', err);
      setSubmitStatus('error');
    }
  };

  const handleClose = () => {
    setActiveForm(null);
    setSubmitStatus(null);
    setSubmissionId(null);
    setPrefilledData({});
  };

  // ── Success state ──
  if (submitStatus === 'success') {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <div className="w-8 h-8 rounded-lg bg-tx-green/10 flex items-center justify-center mb-2">
          <Check className="w-4 h-4 text-tx-green" />
        </div>
        <p className="text-[11px] font-semibold text-tx-tp mb-0.5">Submitted!</p>
        {submissionId && <p className="text-[9px] text-tx-tt font-mono">{submissionId.slice(0, 8)}...</p>}
        <button onClick={handleClose} className="mt-2 text-[10px] text-tx-citron hover:text-tx-citron/80 transition-colors">Close</button>
      </div>
    );
  }

  // ── Active form ──
  if (activeForm) {
    const fieldCount = activeForm.schema?.pages?.reduce(
      (acc, p) => acc + (p.sections || []).reduce((a, s) => a + (s.fields || []).length, 0), 0
    ) || 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-tx-tp truncate">{activeForm.name}</p>
            <p className="text-[9px] text-tx-tt">{fieldCount} field{fieldCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleAutoFill}
              disabled={autoFilling || !transcript?.length}
              title="Auto-fill from transcript"
              className="w-5 h-5 rounded flex items-center justify-center text-tx-citron/60 hover:text-tx-citron disabled:opacity-40 transition-colors"
            >
              {autoFilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            </button>
            <button onClick={handleClose} className="w-5 h-5 rounded flex items-center justify-center text-tx-tt hover:text-tx-tp transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
        {activeForm.description && (
          <p className="text-[10px] text-tx-tt line-clamp-2">{activeForm.description}</p>
        )}
        {submitStatus === 'error' && (
          <div className="px-2 py-1.5 rounded-lg bg-tx-red/10 border border-tx-red/20 text-[10px] text-tx-red">
            Submission failed. Please try again.
          </div>
        )}
        <FormRenderer
          schema={activeForm.schema}
          settings={activeForm.settings}
          prefilledData={mergedPrefill}
          onSubmit={handleSubmit}
          submitLabel="Submit"
        />
      </div>
    );
  }

  // ── Form list ──
  if (loading) {
    return <div className="flex items-center justify-center py-2"><Loader2 className="w-3 h-3 text-tx-ts animate-spin" /></div>;
  }

  if (forms.length === 0) return null;

  return (
    <div>
      <button onClick={() => setShowList(!showList)} className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-tx-s2 border border-tx-bsubtle hover:border-tx-bdefault text-tx-ts hover:text-tx-tp transition-all text-[11px]">
        <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" />Launch form...</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showList ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {showList && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-1 space-y-0.5">
              {forms.map((form) => {
                const fieldCount = form.schema?.pages?.reduce(
                  (acc, p) => acc + (p.sections || []).reduce((a, s) => a + (s.fields || []).length, 0), 0
                ) || 0;
                return (
                  <button key={form.id} onClick={() => { setActiveForm(form); setShowList(false); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-tx-s3 transition-colors">
                    <FileText className="w-3 h-3 text-tx-citron flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] text-tx-tp truncate block">{form.name}</span>
                      {form.description && <span className="text-[9px] text-tx-tt truncate block">{form.description}</span>}
                    </div>
                    <span className="text-[9px] text-tx-tt flex-shrink-0">{fieldCount}f</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                  */
/* ─────────────────────────────────────────────────────────────────────── */

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      <div className="w-10 h-10 rounded-xl ai-chip flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-tx-citron" />
      </div>
      <p className="text-xs text-tx-ts font-semibold">{title}</p>
      <p className="text-[11px] text-tx-ts mt-1 max-w-[220px]">{body}</p>
    </div>
  );
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return sameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
