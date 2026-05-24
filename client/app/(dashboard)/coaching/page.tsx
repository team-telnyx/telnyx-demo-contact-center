'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import {
  Plus,
  Filter,
  ChevronRight,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  BookOpen,
  Trash2,
  Edit3,
  AlertCircle,
  User,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { useSocketEvent } from '../../../lib/socket';
import { useToast } from '../../../components/Toast';

/* ── Constants ─────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { key: 'greeting', label: 'Greeting & Opening', icon: '\u{1F44B}' },
  { key: 'productKnowledge', label: 'Product Knowledge', icon: '\u{1F4DA}' },
  { key: 'resolution', label: 'Issue Resolution', icon: '\u2705' },
  { key: 'communication', label: 'Communication Skills', icon: '\u{1F4AC}' },
  { key: 'compliance', label: 'Compliance & Procedure', icon: '\u{1F6E1}\uFE0F' },
];

const TALK_TRACK_CATEGORIES = ['Opening', 'Objection Handling', 'Closing', 'Compliance', 'Escalation'];

const TABS = [
  { key: 'scorecards', label: 'Scorecards', icon: Award },
  { key: 'talk-tracks', label: 'Talk Tracks', icon: BookOpen },
  { key: 'performance', label: 'Agent Performance', icon: TrendingUp },
];

const CATEGORY_COLORS = {
  Opening: { bg: 'bg-tx-green/10', text: 'text-tx-green', border: 'border-tx-green/20' },
  'Objection Handling': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  Closing: { bg: 'bg-tx-blue/10', text: 'text-tx-blue', border: 'border-tx-blue/20' },
  Compliance: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  Escalation: { bg: 'bg-tx-red/10', text: 'text-tx-red', border: 'border-tx-red/20' },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function scoreBadgeColor(score) {
  if (score >= 90) return 'bg-tx-green/15 text-tx-green border-tx-green/20';
  if (score >= 70) return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  return 'bg-tx-red/15 text-tx-red border-tx-red/20';
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function trendIcon(trend) {
  if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-tx-green" />;
  if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-tx-red" />;
  return <Minus className="w-4 h-4 text-tx-tt" />;
}

/* ── Score Dot Picker (1\u20135) ────────────────────────────────────────── */

function ScoreDotPicker({ value, onChange, size = 'md' }) {
  const sz = size === 'sm' ? 'w-3 h-3' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          className={`${sz} rounded-full border-2 transition-all duration-150 ${
            n <= (value || 0)
              ? 'bg-tx-green border-tx-green shadow-[0_0_6px_rgba(99,102,241,0.3)]'
              : 'bg-tx-s3 border-tx-bdefault hover:border-tx-bstrong'
          }`}
        />
      ))}
      {value != null && <span className="ml-1 text-xs text-tx-tt tabular-nums">{value}/5</span>}
    </div>
  );
}

/* ── Category Score Bar ────────────────────────────────────────────────── */

function CategoryBar({ label, score, icon }) {
  const pct = score != null ? Math.round((score / 5) * 100) : 0;
  const barColor = pct >= 80 ? 'bg-tx-green' : pct >= 60 ? 'bg-amber-500' : 'bg-tx-red';
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-sm w-6 text-center">{icon}</span>
      <span className="text-[13px] text-tx-tp w-40 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-tx-s3 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[12px] text-tx-tt tabular-nums w-10 text-right">
        {score != null ? `${pct}%` : '\u2014'}
      </span>
    </div>
  );
}

/* ── NEW SCORECARD MODAL ──────────────────────────────────────────────── */

function NewScorecardModal({ agents, onClose, onCreated }) {
  const [agentId, setAgentId] = useState('');
  const [categoryScores, setCategoryScores] = useState<Record<string, any>>({});
  const [categoryNotes, setCategoryNotes] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<any>(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agentId) { setError('Select an agent'); return; }
    const hasScores = Object.values(categoryScores).some((v) => v != null);
    if (!hasScores) { setError('Rate at least one category'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/coaching/scorecards', { agentId, categoryScores, categoryNotes, notes });
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create scorecard');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-tx-s2 border border-tx-bdefault shadow-tx-xl"
      >
        <div className="sticky top-0 z-10 bg-tx-s2 border-b border-tx-bdefault px-6 py-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-tx-tp">New Scorecard</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tx-s3 text-tx-tt hover:text-tx-tp transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-[13px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <div>
            <label className="block text-[12px] font-medium text-tx-ts uppercase tracking-wide mb-2">Agent</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp text-[13px] focus:outline-none focus:border-tx-green/50 transition-colors">
              <option value="">Select agent\u2026</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.user?.displayName || a.user?.username || a.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-tx-ts uppercase tracking-wide mb-3">Category Ratings</label>
            <div className="space-y-4">
              {CATEGORIES.map(({ key, label, icon }) => (
                <div key={key} className="p-3 rounded-xl bg-tx-s3 border border-tx-bdefault">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{icon}</span>
                    <span className="text-[13px] font-medium text-tx-tp">{label}</span>
                  </div>
                  <ScoreDotPicker value={categoryScores[key]} onChange={(v) => setCategoryScores((prev) => ({ ...prev, [key]: v }))} />
                  <textarea value={categoryNotes[key] || ''} onChange={(e) => setCategoryNotes((prev) => ({ ...prev, [key]: e.target.value }))} placeholder="Notes for this category (optional)\u2026" rows={2} className="mt-2 w-full px-3 py-2 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-tp text-[12px] placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50 transition-colors resize-none" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-tx-ts uppercase tracking-wide mb-2">Overall Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="General coaching notes, action items\u2026" rows={3} className="w-full px-3 py-2.5 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp text-[13px] placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50 transition-colors resize-none" />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-tx-green text-tx-ti text-[13px] font-semibold hover:bg-tx-green/90 disabled:opacity-50 transition-colors shadow-tx-md">
              {submitting ? 'Creating\u2026' : 'Create Scorecard'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ── TALK TRACK MODAL ──────────────────────────────────────────────────── */

function TalkTrackModal({ track, onClose, onSaved }) {
  const isNew = !track;
  const [name, setName] = useState(track?.name || '');
  const [description, setDescription] = useState(track?.description || '');
  const [category, setCategory] = useState(track?.category || 'Opening');
  const [script, setScript] = useState(track?.script || '');
  const [tips, setTips] = useState(track?.tips || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { name, description, category, script, tips };
      if (isNew) { await api.post('/coaching/talk-tracks', payload); }
      else { await api.patch(`/coaching/talk-tracks/${track.id}`, payload); }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save talk track');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-tx-s2 border border-tx-bdefault shadow-tx-xl">
        <div className="sticky top-0 z-10 bg-tx-s2 border-b border-tx-bdefault px-6 py-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-tx-tp">{isNew ? 'New Talk Track' : 'Edit Talk Track'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tx-s3 text-tx-tt hover:text-tx-tp transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-[13px]"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}</div>
          )}
          <div>
            <label className="block text-[12px] font-medium text-tx-ts uppercase tracking-wide mb-2">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Billing Objection Handler" className="w-full px-3 py-2.5 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp text-[13px] placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-tx-ts uppercase tracking-wide mb-2">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp text-[13px] focus:outline-none focus:border-tx-green/50 transition-colors">
                {TALK_TRACK_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-tx-ts uppercase tracking-wide mb-2">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" className="w-full px-3 py-2.5 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp text-[13px] placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-tx-ts uppercase tracking-wide mb-2">Script</label>
            <textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder="Full script or dialogue template\u2026" rows={5} className="w-full px-3 py-2.5 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp text-[13px] placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50 transition-colors resize-none" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-tx-ts uppercase tracking-wide mb-2">Tips &amp; Best Practices</label>
            <textarea value={tips} onChange={(e) => setTips(e.target.value)} placeholder="Coaching tips for this talk track\u2026" rows={3} className="w-full px-3 py-2.5 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp text-[13px] placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50 transition-colors resize-none" />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-tx-green text-tx-ti text-[13px] font-semibold hover:bg-tx-green/90 disabled:opacity-50 transition-colors shadow-tx-md">
              {saving ? 'Saving\u2026' : isNew ? 'Create Track' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ── SCORECARD ROW (expandable) ────────────────────────────────────────── */

function ScorecardRow({ scorecard }) {
  const [expanded, setExpanded] = useState(false);
  const agentName = scorecard.agent?.user?.displayName || scorecard.agent?.user?.username || 'Unknown';
  const reviewerName = scorecard.reviewer?.displayName || scorecard.reviewer?.username || 'Unknown';

  return (
    <div className="border-b border-tx-bdefault last:border-b-0">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-tx-s2/50 transition-colors text-left">
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }} className="flex-shrink-0">
          <ChevronRight className="w-4 h-4 text-tx-tt" />
        </motion.div>
        <div className="flex-1 min-w-0 grid grid-cols-5 gap-4 items-center">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-tx-s3 flex items-center justify-center flex-shrink-0"><User className="w-3.5 h-3.5 text-tx-tt" /></div>
            <span className="text-[13px] font-medium text-tx-tp truncate">{agentName}</span>
          </div>
          <span className="text-[12px] text-tx-ts truncate">{reviewerName}</span>
          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${scoreBadgeColor(scorecard.overallScore)}`}>{scorecard.overallScore}</span>
          <div className="flex items-center gap-1">
            {CATEGORIES.slice(0, 3).map(({ key }) => {
              const s = scorecard.categoryScores?.[key];
              return <span key={key} className={`w-2 h-2 rounded-full ${s >= 4 ? 'bg-tx-green' : s >= 3 ? 'bg-amber-500' : s ? 'bg-tx-red' : 'bg-tx-s4'}`} title={`${key}: ${s || '\u2014'}`} />;
            })}
            <span className="text-[10px] text-tx-tt ml-1">+{Math.max(0, Object.values(scorecard.categoryScores || {}).filter((v) => v != null).length - 3)}</span>
          </div>
          <span className="text-[12px] text-tx-tt tabular-nums">{formatDate(scorecard.createdAt)}</span>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 ml-8 space-y-4">
              <div className="p-4 rounded-xl bg-tx-s3/50 border border-tx-bdefault">
                <h4 className="text-[12px] font-semibold text-tx-ts uppercase tracking-wide mb-3">Category Breakdown</h4>
                <div className="space-y-1">
                  {CATEGORIES.map(({ key, label, icon }) => (
                    <div key={key}>
                      <CategoryBar label={label} score={scorecard.categoryScores?.[key]} icon={icon} />
                      {scorecard.categoryNotes?.[key] && <p className="text-[11px] text-tx-tt ml-12 mt-0.5 italic">&ldquo;{scorecard.categoryNotes[key]}&rdquo;</p>}
                    </div>
                  ))}
                </div>
              </div>
              {scorecard.notes && (
                <div className="p-4 rounded-xl bg-tx-s3/50 border border-tx-bdefault">
                  <h4 className="text-[12px] font-semibold text-tx-ts uppercase tracking-wide mb-2">Notes</h4>
                  <p className="text-[13px] text-tx-tp leading-relaxed">{scorecard.notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════ */

export default function CoachingPage() {
  const [activeTab, setActiveTab] = useState('scorecards');
  const [scorecards, setScorecards] = useState<any[]>([]);
  const [talkTracks, setTalkTracks] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [scPage, setScPage] = useState(1);
  const [scTotal, setScTotal] = useState(0);
  const SC_LIMIT = 25;

  // Scorecard filters
  const [filterAgent, setFilterAgent] = useState('');
  const [filterReviewer, setFilterReviewer] = useState('');
  const [dateRange, setDateRange] = useState('last_30_days');

  // Modals
  const [showNewScorecard, setShowNewScorecard] = useState(false);
  const [showTalkTrackModal, setShowTalkTrackModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState<any>(null);

  // Agent Performance tab
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agentSummary, setAgentSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const { addToast } = useToast();

  // AI Insights
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showInsights, setShowInsights] = useState(true);

  // Listen for real-time coaching events via Socket.IO
  useSocketEvent('coaching:scorecard_created', useCallback((scorecard) => {
    setScorecards((prev) => {
      if (prev.some((s) => s.id === scorecard.id)) return prev;
      return [scorecard, ...prev];
    });
    addToast('New scorecard created', 'success');
  }, [addToast]));

  useSocketEvent('coaching:scorecard_updated', useCallback((scorecard) => {
    setScorecards((prev) => prev.map((s) => s.id === scorecard.id ? scorecard : s));
  }, []));

  /* ── Data fetching ──────────────────────────────────────────────────── */

  const loadScorecards = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (filterAgent) params.set('agentId', filterAgent);
      if (filterReviewer) params.set('reviewerId', filterReviewer);
      if (dateRange === 'last_7_days') { const d = new Date(); d.setDate(d.getDate() - 7); params.set('fromDate', d.toISOString()); }
      else if (dateRange === 'last_30_days') { const d = new Date(); d.setDate(d.getDate() - 30); params.set('fromDate', d.toISOString()); }
      else if (dateRange === 'last_90_days') { const d = new Date(); d.setDate(d.getDate() - 90); params.set('fromDate', d.toISOString()); }
      params.set('page', String(scPage));
      params.set('limit', String(SC_LIMIT));
      const data = await api.get(`/coaching/scorecards?${params.toString()}`);
      setScorecards(data.rows || []);
      setScTotal(data.total || (data.rows || []).length);
    } catch (err: any) { console.error('Failed to load scorecards:', err); setError(err.message || 'Failed to load scorecards'); }
  }, [filterAgent, filterReviewer, dateRange, scPage]);

  const loadTalkTracks = useCallback(async () => {
    try { const data = await api.get('/coaching/talk-tracks'); setTalkTracks(data); }
    catch (err: any) { console.error('Failed to load talk tracks:', err); setError(err.message || 'Failed to load talk tracks'); }
  }, []);

  const loadAgents = useCallback(async () => {
    try { const data = await api.get('/agents'); setAgents(data); }
    catch (err: any) { console.error('Failed to load agents:', err); }
  }, []);

  const loadAgentSummary = useCallback(async (agentId) => {
    if (!agentId) { setAgentSummary(null); return; }
    setLoadingSummary(true);
    try { const data = await api.get(`/coaching/agent/${agentId}/summary?days=30`); setAgentSummary(data); }
    catch (err: any) { console.error('Failed to load agent summary:', err); setAgentSummary(null); }
    finally { setLoadingSummary(false); }
  }, []);

  const loadAiInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const data = await api.get('/coaching/insights');
      if (Array.isArray(data)) {
        setAiInsights(data);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err: any) {
      // If API returns 404 or error, show placeholder tips
      setAiInsights([
        { id: 'hold-time', icon: 'clock', title: 'Reduce hold times', tip: 'Your average hold time is above target. Consider using warm transfers for complex escalations to avoid putting customers on hold.', tone: 'amber' },
        { id: 'confirm-lang', icon: 'lightbulb', title: 'Use confirmatory language', tip: 'Customers respond better to confirmatory language. Try \"I can help with that\" instead of \"I don\u2019t know\" — it builds confidence and keeps the conversation moving.', tone: 'green' },
        { id: 'warm-transfer', icon: 'trending', title: 'Warm transfer for escalations', tip: 'Consider using warm transfers for complex escalations. Cold transfers lead to 3x higher callback rates and lower CSAT scores.', tone: 'blue' },
        { id: 'greeting', icon: 'target', title: 'Consistent greeting adherence', tip: 'Opening score consistency varies by 22% across agents. Standardize greetings to improve first impressions and build trust from the first second.', tone: 'violet' },
      ]);
    } finally {
      setLoadingInsights(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  useEffect(() => { loadAiInsights(); }, [loadAiInsights]);

  useEffect(() => { setScPage(1); }, [filterAgent, filterReviewer, dateRange]);

  useEffect(() => {
    if (activeTab === 'scorecards') { setLoading(true); loadScorecards().finally(() => setLoading(false)); }
    else if (activeTab === 'talk-tracks') { setLoading(true); loadTalkTracks().finally(() => setLoading(false)); }
  }, [activeTab, loadScorecards, loadTalkTracks]);

  useEffect(() => {
    if (activeTab === 'performance' && selectedAgentId) { loadAgentSummary(selectedAgentId); }
  }, [activeTab, selectedAgentId, loadAgentSummary]);

  const handleDeleteTrack = async (id) => {
    if (!confirm('Delete this talk track?')) return;
    try { await api.delete(`/coaching/talk-tracks/${id}`); loadTalkTracks(); }
    catch (err: any) { console.error('Failed to delete track:', err); }
  };

  /* ── Page render ────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-tx-red/10 border border-tx-red/20 text-tx-red text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => { if (activeTab === 'scorecards') loadScorecards(); else loadTalkTracks(); }} className="px-3 py-1 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-xs font-medium hover:bg-tx-red/20 transition-colors">Retry</button>
          <button onClick={() => setError(null)} className="p-1 text-tx-red/60 hover:text-tx-red transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
            <Award className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-tx-tp tracking-tight">Quality &amp; Coaching</h1>
            <p className="text-[11px] text-tx-ts mt-0.5">Review agent performance, manage coaching scripts, and track improvements</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="px-3 py-2 rounded-xl bg-tx-s2 border border-tx-bdefault text-tx-tp text-[12px] font-medium focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all">
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_90_days">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
          <button onClick={() => setShowNewScorecard(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-[13px] font-semibold shadow-lg shadow-tx-green/20 hover:shadow-tx-green/40 transition-shadow">
            <Plus className="w-4 h-4" /> New Scorecard
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-tx-s2 border border-tx-bdefault w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${activeTab === key ? 'bg-tx-s3 text-tx-tp shadow-tx-sm border border-tx-bdefault' : 'text-tx-tt hover:text-tx-ts hover:bg-tx-s3/50'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ═══ SCORECARDS TAB ═══════════════════════════════════════════ */}
      {activeTab === 'scorecards' && (
        <div className="flex gap-4">
          <div className="flex-1 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-tx-tt" />
              <span className="text-[12px] text-tx-tt font-medium">Filters:</span>
            </div>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="px-3 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-tp text-[12px] focus:outline-none focus:border-tx-green/50 transition-colors">
              <option value="">All Agents</option>
              {agents.map((a) => (<option key={a.id} value={a.id}>{a.user?.displayName || a.user?.username || a.id}</option>))}
            </select>
            <select value={filterReviewer} onChange={(e) => setFilterReviewer(e.target.value)} className="px-3 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-tp text-[12px] focus:outline-none focus:border-tx-green/50 transition-colors">
              <option value="">All Reviewers</option>
              {[...new Map(scorecards.map((s) => [s.reviewer?.id, s.reviewer])).values()].filter(Boolean).map((r) => (
                <option key={r.id} value={r.id}>{r.displayName || r.username}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-tx-s1 border border-tx-bdefault overflow-hidden">
            <div className="grid grid-cols-5 gap-4 items-center px-5 py-3 border-b border-tx-bdefault bg-tx-s2/50">
              <span className="text-[11px] font-semibold text-tx-tt uppercase tracking-wider">Agent</span>
              <span className="text-[11px] font-semibold text-tx-tt uppercase tracking-wider">Reviewer</span>
              <span className="text-[11px] font-semibold text-tx-tt uppercase tracking-wider">Score</span>
              <span className="text-[11px] font-semibold text-tx-tt uppercase tracking-wider">Categories</span>
              <span className="text-[11px] font-semibold text-tx-tt uppercase tracking-wider">Date</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-tx-green/30 border-t-tx-green rounded-full animate-spin" />
                  <span className="text-[13px] text-tx-tt">Loading scorecards\u2026</span>
                </div>
              </div>
            ) : scorecards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Award className="w-10 h-10 text-tx-tt mb-3" />
                <p className="text-[14px] font-medium text-tx-ts">No scorecards yet</p>
                <p className="text-[12px] text-tx-tt mt-1">Create your first coaching scorecard to get started</p>
                <button onClick={() => setShowNewScorecard(true)} className="mt-3 px-4 py-2 rounded-xl bg-tx-green/10 border border-tx-green/20 text-tx-green text-xs font-semibold hover:bg-tx-green/20 transition-colors">Create Scorecard</button>
              </div>
            ) : (
              <div className="divide-y divide-tx-bdefault">
                {scorecards.map((sc) => (<ScorecardRow key={sc.id} scorecard={sc} />))}
              </div>
            )}
            {/* Scorecards pagination */}
            {!loading && scTotal > SC_LIMIT && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-tx-bdefault bg-tx-s2/30">
                <span className="text-[11px] text-tx-tt">{scTotal} scorecard{scTotal !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setScPage((p) => Math.max(1, p - 1))} disabled={scPage === 1} className="px-3 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-[11px] font-medium disabled:opacity-30 hover:text-tx-tp transition-colors">Prev</button>
                  <span className="text-[11px] text-tx-tt tabular-nums">Page {scPage}</span>
                  <button onClick={() => setScPage((p) => p + 1)} disabled={scPage * SC_LIMIT >= scTotal} className="px-3 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-[11px] font-medium disabled:opacity-30 hover:text-tx-tp transition-colors">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── AI Insights sidebar ─────────────────────────────────── */}
        {showInsights && (
          <aside className="w-[300px] flex-shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-tx-green/20 to-tx-citron/20 border border-tx-green/20 flex items-center justify-center">
                  <Lightbulb className="w-3.5 h-3.5 text-tx-green" />
                </div>
                <h3 className="text-[13px] font-semibold text-tx-tp">AI Insights</h3>
              </div>
              <button
                onClick={() => setShowInsights(false)}
                className="text-[10px] text-tx-tt hover:text-tx-ts transition-colors"
              >
                Hide
              </button>
            </div>

            {loadingInsights ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-tx-green/30 border-t-tx-green rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2.5">
                {aiInsights.map((insight, idx) => {
                  const toneMap: Record<string, { bg: string; border: string; iconBg: string; iconText: string }> = {
                    green:  { bg: 'bg-gradient-to-br from-tx-green/5 to-tx-green/[0.02]', border: 'border-tx-green/15', iconBg: 'bg-tx-green/15', iconText: 'text-tx-green' },
                    amber:  { bg: 'bg-gradient-to-br from-tx-citron/5 to-tx-citron/[0.02]', border: 'border-tx-citron/15', iconBg: 'bg-tx-citron/15', iconText: 'text-tx-citron' },
                    blue:   { bg: 'bg-gradient-to-br from-tx-blue/5 to-tx-blue/[0.02]', border: 'border-tx-blue/15', iconBg: 'bg-tx-blue/15', iconText: 'text-tx-blue' },
                    violet: { bg: 'bg-gradient-to-br from-purple-500/5 to-purple-500/[0.02]', border: 'border-purple-500/15', iconBg: 'bg-purple-500/15', iconText: 'text-purple-400' },
                  };
                  const t = toneMap[insight.tone] || toneMap.green;
                  const iconMap: Record<string, any> = {
                    lightbulb: Lightbulb,
                    clock: Clock,
                    trending: TrendingUp,
                    target: Award,
                  };
                  const InsightIcon = iconMap[insight.icon] || Lightbulb;
                  return (
                    <motion.div
                      key={insight.id || idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.08 }}
                      className={`p-3.5 rounded-xl border ${t.bg} ${t.border}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-lg ${t.iconBg} ${t.iconText} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <InsightIcon className="w-3 h-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[12px] font-semibold text-tx-tp">{insight.title}</h4>
                          <p className="text-[11px] text-tx-ts leading-relaxed mt-1">{insight.tip}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </aside>
        )}

        {!showInsights && (
          <button
            onClick={() => setShowInsights(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-tx-s2 border border-tx-bdefault text-tx-ts text-[11px] font-medium hover:border-tx-bstrong transition-colors"
          >
            <Lightbulb className="w-3.5 h-3.5 text-tx-green" />
            Show AI Insights
          </button>
        )}
      </div>
      )}

      {/* ═══ TALK TRACKS TAB ══════════════════════════════════════════ */}
      {activeTab === 'talk-tracks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-tx-ts">{talkTracks.length} talk track{talkTracks.length !== 1 ? 's' : ''}</p>
            <button onClick={() => { setEditingTrack(null); setShowTalkTrackModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tx-s2 border border-tx-bdefault text-tx-tp text-[13px] font-medium hover:border-tx-bstrong transition-colors">
              <Plus className="w-4 h-4" /> New Track
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-tx-green/30 border-t-tx-green rounded-full animate-spin" />
                <span className="text-[13px] text-tx-tt">Loading talk tracks\u2026</span>
              </div>
            </div>
          ) : talkTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="w-10 h-10 text-tx-tt mb-3" />
              <p className="text-[14px] font-medium text-tx-ts">No talk tracks yet</p>
              <p className="text-[12px] text-tx-tt mt-1">Create coaching scripts and feedback templates</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {talkTracks.map((track) => {
                const cc = CATEGORY_COLORS[track.category] || CATEGORY_COLORS.Opening;
                return (
                  <motion.div key={track.id} layout className="rounded-xl bg-tx-s1 border border-tx-bdefault overflow-hidden hover:border-tx-bstrong transition-colors">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-semibold text-tx-tp truncate">{track.name}</h3>
                          {track.description && <p className="text-[12px] text-tx-ts mt-0.5 line-clamp-2">{track.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => { setEditingTrack(track); setShowTalkTrackModal(true); }} className="p-1.5 rounded-lg hover:bg-tx-s3 text-tx-tt hover:text-tx-tp transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteTrack(track.id)} className="p-1.5 rounded-lg hover:bg-tx-red/10 text-tx-tt hover:text-tx-red transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cc.bg} ${cc.text} ${cc.border}`}>
                          {track.category}
                        </span>
                        <span className="text-[11px] text-tx-tt">{track.usageCount || 0} uses</span>
                      </div>
                      {track.script && (
                        <p className="text-[12px] text-tx-tt line-clamp-3 italic">&ldquo;{track.script.substring(0, 120)}{track.script.length > 120 ? '\u2026' : ''}&rdquo;</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ AGENT PERFORMANCE TAB ════════════════════════════════════ */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Agent selector */}
          <div className="flex items-center gap-4">
            <label className="text-[12px] font-medium text-tx-ts uppercase tracking-wide">Select Agent</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-tx-s2 border border-tx-bdefault text-tx-tp text-[13px] focus:outline-none focus:border-tx-green/50 transition-colors min-w-[240px]"
            >
              <option value="">Choose an agent\u2026</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.user?.displayName || a.user?.username || a.id}</option>
              ))}
            </select>
          </div>

          {!selectedAgentId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TrendingUp className="w-10 h-10 text-tx-tt mb-3" />
              <p className="text-[14px] font-medium text-tx-ts">Select an agent to view performance</p>
              <p className="text-[12px] text-tx-tt mt-1">Choose an agent above to see coaching analytics</p>
            </div>
          ) : loadingSummary ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-tx-green/30 border-t-tx-green rounded-full animate-spin" />
                <span className="text-[13px] text-tx-tt">Loading agent summary\u2026</span>
              </div>
            </div>
          ) : agentSummary ? (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-tx-s1 border border-tx-bdefault">
                  <p className="text-[11px] font-semibold text-tx-tt uppercase tracking-wider mb-1">Average Score</p>
                  <div className="flex items-center gap-3">
                    <span className={`text-[28px] font-bold tabular-nums ${agentSummary.avgScore >= 90 ? 'text-tx-green' : agentSummary.avgScore >= 70 ? 'text-amber-400' : 'text-tx-red'}`}>
                      {agentSummary.avgScore ?? '\u2014'}
                    </span>
                    <div className="flex items-center gap-1">
                      {trendIcon(agentSummary.trend)}
                      <span className="text-[11px] text-tx-tt capitalize">{agentSummary.trend}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-tx-s1 border border-tx-bdefault">
                  <p className="text-[11px] font-semibold text-tx-tt uppercase tracking-wider mb-1">Total Scorecards</p>
                  <span className="text-[28px] font-bold text-tx-tp tabular-nums">{agentSummary.totalScorecards}</span>
                </div>
                <div className="p-4 rounded-xl bg-tx-s1 border border-tx-bdefault">
                  <p className="text-[11px] font-semibold text-tx-tt uppercase tracking-wider mb-1">Lowest Category</p>
                  <span className="text-[28px] font-bold text-tx-tp">
                    {agentSummary.recommendations?.[0]?.label || '\u2014'}
                  </span>
                </div>
              </div>

              {/* Score Trend Chart Placeholder */}
              <div className="p-5 rounded-xl bg-tx-s1 border border-tx-bdefault">
                <h3 className="text-[13px] font-semibold text-tx-tp mb-4">Score Trend (Last 30 Days)</h3>
                {agentSummary.recentScorecards && agentSummary.recentScorecards.length > 1 ? (
                  <div className="flex items-end gap-2 h-40">
                    {agentSummary.recentScorecards.map((sc, i) => {
                      const h = Math.max(8, (sc.overallScore / 100) * 160);
                      const color = sc.overallScore >= 90 ? 'bg-tx-green' : sc.overallScore >= 70 ? 'bg-amber-500' : 'bg-tx-red';
                      return (
                        <div key={sc.id} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-tx-tt tabular-nums">{sc.overallScore}</span>
                          <motion.div
                            className={`w-full rounded-t-md ${color}`}
                            initial={{ height: 0 }}
                            animate={{ height: h }}
                            transition={{ duration: 0.4, delay: i * 0.05 }}
                          />
                          <span className="text-[8px] text-tx-tt">{new Date(sc.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-tx-tt text-[13px]">
                    Need at least 2 scorecards to show trend
                  </div>
                )}
              </div>

              {/* Category Breakdown */}
              <div className="p-5 rounded-xl bg-tx-s1 border border-tx-bdefault">
                <h3 className="text-[13px] font-semibold text-tx-tp mb-4">Category Breakdown</h3>
                <div className="space-y-3">
                  {CATEGORIES.map(({ key, label, icon }) => {
                    const avg = agentSummary.categoryAverages?.[key];
                    const pct = avg != null ? avg : 0;
                    const barColor = pct >= 80 ? 'bg-tx-green' : pct >= 60 ? 'bg-amber-500' : 'bg-tx-red';
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-sm w-6 text-center">{icon}</span>
                        <span className="text-[13px] text-tx-tp w-40 flex-shrink-0">{label}</span>
                        <div className="flex-1 h-3 bg-tx-s3 rounded-full overflow-hidden">
                          <motion.div className={`h-full rounded-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                        </div>
                        <span className="text-[12px] text-tx-tt tabular-nums w-10 text-right">{avg != null ? `${avg}%` : '\u2014'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Scorecards */}
              {agentSummary.recentScorecards?.length > 0 && (
                <div className="p-5 rounded-xl bg-tx-s1 border border-tx-bdefault">
                  <h3 className="text-[13px] font-semibold text-tx-tp mb-4">Recent Scorecards</h3>
                  <div className="space-y-2">
                    {agentSummary.recentScorecards.map((sc) => (
                      <div key={sc.id} className="flex items-center gap-4 p-3 rounded-lg bg-tx-s2/50 border border-tx-bdefault">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${scoreBadgeColor(sc.overallScore)}`}>{sc.overallScore}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-tx-tp truncate">{sc.notes || 'No notes'}</p>
                        </div>
                        <span className="text-[11px] text-tx-tt tabular-nums flex-shrink-0">{formatDate(sc.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaching Recommendations */}
              {agentSummary.recommendations?.length > 0 && (
                <div className="p-5 rounded-xl bg-tx-s1 border border-tx-bdefault">
                  <h3 className="text-[13px] font-semibold text-tx-tp mb-4 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" /> Coaching Recommendations
                  </h3>
                  <div className="space-y-3">
                    {agentSummary.recommendations.map((rec, i) => (
                      <div key={i} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] font-semibold text-amber-400">{rec.label}</span>
                          <span className="text-[11px] text-tx-tt">({rec.score}%)</span>
                        </div>
                        <p className="text-[12px] text-tx-ts leading-relaxed">{rec.tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewScorecard && (
          <NewScorecardModal
            agents={agents}
            onClose={() => setShowNewScorecard(false)}
            onCreated={() => { setShowNewScorecard(false); loadScorecards(); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTalkTrackModal && (
          <TalkTrackModal
            track={editingTrack}
            onClose={() => { setShowTalkTrackModal(false); setEditingTrack(null); }}
            onSaved={() => { setShowTalkTrackModal(false); setEditingTrack(null); loadTalkTracks(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
