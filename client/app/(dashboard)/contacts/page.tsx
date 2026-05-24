'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, UserPlus, X, Phone, Mail, Building2, Tag,
  ChevronRight, Loader2, Edit3, Trash2, Plus, List, LayoutGrid,
  Users, Star, Clock, ArrowUpDown, ArrowUp, ArrowDown,
  CheckSquare, Square, Download, PhoneCall, StickyNote,
  Contact as ContactIcon,
} from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../components/Toast';

/* ─── Helpers ─── */

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtDuration(seconds) {
  if (!seconds) return '—';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function initialsFromContact(c) {
  if (c.name) {
    const parts = c.name.trim().split(/\s+/);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }
  return (c.phoneNumber || '?').slice(-2);
}

const sentimentEmoji = { positive: '😊', neutral: '😐', negative: '😟', unknown: '🤷' };

/* ─── SentimentBadge ─── */

function SentimentBadge({ sentiment }) {
  const map = {
    positive: 'bg-tx-green/10 text-tx-green border-tx-green/20',
    neutral: 'bg-tx-s3 text-tx-ts border-tx-bdefault',
    negative: 'bg-tx-red/10 text-tx-red border-tx-red/20',
    unknown: 'bg-tx-s3/30 text-tx-ts border-tx-bdefault',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wider ${map[sentiment] ?? map.unknown}`}>
      {sentimentEmoji[sentiment] || sentimentEmoji.unknown} {sentiment || 'unknown'}
    </span>
  );
}

/* ─── TagPill ─── */

const tagColors = [
  'bg-tx-green/10 border-tx-green/20 text-tx-green',
  'bg-tx-citron/10 border-tx-citron/20 text-tx-citron',
  'bg-purple-500/10 border-purple-500/15 text-purple-400',
  'bg-sky-500/10 border-sky-500/15 text-sky-400',
  'bg-amber-500/10 border-amber-500/15 text-amber-400',
];

function TagPill({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  const idx = typeof children === 'string' ? children.length % tagColors.length : 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${tagColors[idx]}`}>
      {children}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

/* ─── FilterPill ─── */

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
        active
          ? 'bg-tx-green/15 border border-tx-green/25 text-tx-green shadow-[0_0_12px_rgba(99,102,241,0.08)]'
          : 'bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bdefault'
      }`}
    >
      {children}
    </button>
  );
}

/* ─── ViewToggle ─── */

function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center bg-tx-s3 rounded-lg border border-tx-bdefault p-0.5">
      <button
        onClick={() => onChange('list')}
        className={`p-1.5 rounded-md transition-all duration-200 ${view === 'list' ? 'bg-tx-green/15 text-tx-green' : 'text-tx-ts hover:text-tx-tp'}`}
        title="List view"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange('grid')}
        className={`p-1.5 rounded-md transition-all duration-200 ${view === 'grid' ? 'bg-tx-green/15 text-tx-green' : 'text-tx-ts hover:text-tx-tp'}`}
        title="Grid view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── SortIcon ─── */

function SortIcon({ field, sortField, sortDir }) {
  if (field !== sortField) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-tx-green" /> : <ArrowDown className="w-3 h-3 text-tx-green" />;
}

/* ─── BulkActionsToolbar ─── */

function BulkActionsToolbar({ count, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-tx-green/8 border border-tx-green/20"
    >
      <span className="text-xs font-semibold text-tx-green">{count} selected</span>
      <div className="w-px h-4 bg-tx-bdefault" />
      <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors">
        <Tag className="w-3 h-3" /> Tag
      </button>
      <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors">
        <Download className="w-3 h-3" /> Export
      </button>
      <button onClick={onDelete} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-tx-red hover:bg-tx-red/10 transition-colors">
        <Trash2 className="w-3 h-3" /> Delete
      </button>
    </motion.div>
  );
}

/* ─── ContactDetailPanel (slide-in) ─── */

function ContactDetailPanel({ contact, onClose, onEdit, onDelete, onQuickCall }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (!contact) return;
    setLoading(true);
    api.get(`/contacts/${contact.id}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contact?.id]);

  async function addTag() {
    const t = newTag.trim();
    if (!t) return;
    try {
      const updated = await api.patch(`/contacts/${contact.id}`, { tags: [...(contact.tags || []), t] });
      setDetail(updated);
      setNewTag('');
    } catch {}
  }

  async function removeTag(t) {
    try {
      const updated = await api.patch(`/contacts/${contact.id}`, { tags: (contact.tags || []).filter(x => x !== t) });
      setDetail(updated);
    } catch {}
  }

  if (!contact) return null;
  const c = detail || contact;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-tx-s1 border-l border-tx-bdefault z-50 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-tx-bdefault">
          <h2 className="text-base font-semibold text-tx-tp">Contact Details</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-6 space-y-4">
              <div className="shimmer h-16 rounded-xl" />
              <div className="shimmer h-32 rounded-xl" />
              <div className="shimmer h-48 rounded-xl" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-tx-green/30 to-tx-citron/30 border border-tx-bdefault flex items-center justify-center text-lg font-bold text-tx-tp flex-shrink-0 uppercase">{initialsFromContact(c)}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-tx-tp truncate">{c.name || 'Unnamed Contact'}</h3>
                  {c.company && <p className="text-sm text-tx-ts flex items-center gap-1 mt-0.5"><Building2 className="w-3.5 h-3.5" />{c.company}</p>}
                  <div className="mt-2"><SentimentBadge sentiment={c.sentiment} /></div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => c.phoneNumber && onQuickCall(c)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-tx-green/8 border border-tx-green/20 text-tx-green hover:bg-tx-green/15 transition-colors"><PhoneCall className="w-4 h-4" /><span className="text-[10px] font-semibold">Call</span></button>
                <button className="flex flex-col items-center gap-1 p-3 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bdefault transition-colors"><Mail className="w-4 h-4" /><span className="text-[10px] font-semibold">Email</span></button>
                <button onClick={() => onEdit(c)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bdefault transition-colors"><Edit3 className="w-4 h-4" /><span className="text-[10px] font-semibold">Edit</span></button>
                <button onClick={() => onDelete(c)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-tx-red/5 border border-tx-red/10 text-tx-red hover:bg-tx-red/10 transition-colors"><Trash2 className="w-4 h-4" /><span className="text-[10px] font-semibold">Delete</span></button>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Contact Info</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-tx-s3/60 border border-tx-bdefault"><Phone className="w-4 h-4 text-tx-tt flex-shrink-0" /><div><p className="text-[10px] text-tx-tt uppercase tracking-wider">Phone</p><p className="text-sm text-tx-tp font-mono">{c.phoneNumber}</p></div></div>
                  {c.email && <div className="flex items-center gap-3 p-3 rounded-xl bg-tx-s3/60 border border-tx-bdefault"><Mail className="w-4 h-4 text-tx-tt flex-shrink-0" /><div><p className="text-[10px] text-tx-tt uppercase tracking-wider">Email</p><p className="text-sm text-tx-tp">{c.email}</p></div></div>}
                  {c.company && <div className="flex items-center gap-3 p-3 rounded-xl bg-tx-s3/60 border border-tx-bdefault"><Building2 className="w-4 h-4 text-tx-tt flex-shrink-0" /><div><p className="text-[10px] text-tx-tt uppercase tracking-wider">Company</p><p className="text-sm text-tx-tp">{c.company}</p></div></div>}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Tags</h4>
                <div className="p-3 rounded-xl bg-tx-s3/60 border border-tx-bdefault">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(c.tags || []).length > 0 ? c.tags.map(t => <TagPill key={t} onRemove={() => removeTag(t)}>{t}</TagPill>) : <p className="text-xs text-tx-tt">No tags</p>}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Add tag…" className="flex-1 bg-tx-s2 border border-tx-bdefault rounded-lg px-2.5 py-1.5 text-xs text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/30 transition-colors" />
                    <button onClick={addTag} className="px-2 py-1.5 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green hover:bg-tx-green/20 transition-colors"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider flex items-center gap-1.5"><StickyNote className="w-3 h-3" /> Notes</h4>
                <div className="p-3 rounded-xl bg-tx-s3/60 border border-tx-bdefault">
                  {c.notes ? <p className="text-sm text-tx-ts whitespace-pre-wrap">{c.notes}</p> : <p className="text-xs text-tx-tt italic">No notes yet</p>}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider flex items-center gap-1.5"><PhoneCall className="w-3 h-3" /> Call History</h4>
                {detail?.callRecords?.length ? (
                  <div className="space-y-1.5">
                    {detail.callRecords.map(cr => (
                      <div key={cr.id} className="p-3 rounded-xl bg-tx-s3/60 border border-tx-bdefault flex items-center gap-3 text-xs">
                        <span className="text-tx-ts font-mono w-28">{fmtDate(cr.startedAt)}</span>
                        <span className="text-tx-ts capitalize w-14">{cr.direction}</span>
                        <span className="text-tx-ts font-mono w-12">{fmtDuration(cr.duration)}</span>
                        {cr.disposition && <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: `${cr.disposition.color}22`, color: cr.disposition.color, border: `1px solid ${cr.disposition.color}44` }}>{cr.disposition.name}</span>}
                        <span className="text-tx-ts ml-auto">{cr.queueName || '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-tx-s3/40 border border-tx-bdefault text-center">
                    <PhoneCall className="w-6 h-6 text-tx-tt mx-auto mb-2" />
                    <p className="text-xs text-tx-tt">No calls recorded</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ─── ContactModal (New / Edit) ─── */

function ContactModal({ contact, onClose, onSaved }) {
  const isEdit = !!contact;
  const [form, setForm] = useState({
    phoneNumber: contact?.phoneNumber || '', name: contact?.name || '',
    email: contact?.email || '', company: contact?.company || '',
    notes: contact?.notes || '', tags: contact?.tags || [],
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, any>>({});

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required';
    else if (!/^\+?[\d\s()-]{7,20}$/.test(form.phoneNumber.trim())) errors.phoneNumber = 'Enter a valid phone number';
    if (!form.name.trim()) errors.name = 'Name is required';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (form.tags.includes(t)) { setTagInput(''); return; }
    setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  }
  function removeTag(t) { setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) })); }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setError(null);
    try {
      const payload = { ...form };
      if (!payload.email) delete payload.email;
      const saved = isEdit ? await api.patch(`/contacts/${contact.id}`, payload) : await api.post('/contacts', payload);
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err: any) { setError(err.data?.error || err.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="bg-tx-s1 backdrop-blur-xl border border-tx-bdefault rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-tx-bdefault">
          <h2 className="text-lg font-semibold text-tx-tp">{isEdit ? 'Edit Contact' : 'New Contact'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Phone Number *</label>
            <input type="tel" value={form.phoneNumber} onChange={e => { setForm(f => ({ ...f, phoneNumber: e.target.value })); setValidationErrors(v => { const { phoneNumber, ...rest } = v; return rest; }); }} disabled={isEdit} placeholder="+61400000000" className={`mt-1 w-full bg-tx-s3 border rounded-xl px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors disabled:opacity-50 ${validationErrors.phoneNumber ? 'border-tx-red/50' : 'border-tx-bdefault'}`} />
            {validationErrors.phoneNumber && <p className="text-[10px] text-tx-red mt-1">{validationErrors.phoneNumber}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Name *</label>
              <input type="text" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setValidationErrors(v => { const { name, ...rest } = v; return rest; }); }} className={`mt-1 w-full bg-tx-s3 border rounded-xl px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors ${validationErrors.name ? 'border-tx-red/50' : 'border-tx-bdefault'}`} />
              {validationErrors.name && <p className="text-[10px] text-tx-red mt-1">{validationErrors.name}</p>}
            </div>
            <div>
              <label className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Company</label>
              <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="mt-1 w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Tags</label>
            <div className="mt-1 flex flex-wrap gap-1.5 mb-2">{form.tags.map(t => <TagPill key={t} onRemove={() => removeTag(t)}>{t}</TagPill>)}</div>
            <div className="flex gap-2">
              <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Add a tag and press Enter" className="flex-1 bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors" />
              <button onClick={addTag} className="px-3 py-2 rounded-xl bg-tx-green/10 border border-tx-green/20 text-tx-green hover:bg-tx-green/20 transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="mt-1 w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors resize-none" />
          </div>
          {error && <p className="text-xs text-tx-red">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-tx-bdefault flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-tx-ts hover:text-tx-tp text-sm font-medium transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.phoneNumber || saving} className="px-4 py-2 rounded-xl bg-tx-green/20 border border-tx-green/30 text-tx-green text-sm font-semibold hover:bg-tx-green/30 disabled:opacity-30 transition-colors flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Contact')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Skeleton / Loading ─── */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-tx-bdefault">
      <div className="shimmer w-4 h-4 rounded" />
      <div className="shimmer w-9 h-9 rounded-xl" />
      <div className="flex-1 space-y-2"><div className="shimmer h-3.5 w-32 rounded" /><div className="shimmer h-2.5 w-48 rounded" /></div>
      <div className="shimmer h-5 w-16 rounded-md" />
      <div className="shimmer h-5 w-20 rounded-md" />
      <div className="shimmer h-3 w-20 rounded" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-4 space-y-3">
          <div className="shimmer w-12 h-12 rounded-2xl" />
          <div className="shimmer h-4 w-24 rounded" />
          <div className="shimmer h-3 w-32 rounded" />
          <div className="flex gap-1.5"><div className="shimmer h-5 w-12 rounded-md" /><div className="shimmer h-5 w-14 rounded-md" /></div>
        </div>
      ))}
    </div>
  );
}

/* ─── EmptyState ─── */

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-tx-green/8 border border-tx-green/20 flex items-center justify-center">
          <Users className="w-9 h-9 text-tx-green/50" />
        </div>
        <div className="absolute -right-1 -top-1 w-7 h-7 rounded-xl bg-tx-citron/10 border border-tx-citron/20 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-tx-citron/60" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-tx-tp mb-1">No contacts yet</h3>
      <p className="text-sm text-tx-ts text-center max-w-sm mb-6">
        Build your contact list by adding people manually, or they&apos;ll be auto-created from incoming calls.
      </p>
      <button onClick={onAdd} className="gradient-primary px-5 py-2.5 rounded-xl text-tx-inverse text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg">
        <UserPlus className="w-4 h-4" /> Add your first contact
      </button>
    </div>
  );
}

/* ─── ContactGridCard ─── */

function ContactGridCard({ contact, selected, onToggleSelect, onClick }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`bg-tx-s2 border border-tx-bdefault rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:border-tx-green/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.06)] ${selected ? 'ring-1 ring-tx-green/30 border-tx-green/30' : ''}`}
      onClick={() => onClick(contact)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tx-green/20 to-tx-citron/20 border border-tx-bdefault flex items-center justify-center text-sm font-bold text-tx-tp uppercase">
          {initialsFromContact(contact)}
        </div>
        <button onClick={e => { e.stopPropagation(); onToggleSelect(contact.id); }} className="text-tx-tt hover:text-tx-tp transition-colors">
          {selected ? <CheckSquare className="w-4 h-4 text-tx-green" /> : <Square className="w-4 h-4" />}
        </button>
      </div>
      <h4 className="text-sm font-semibold text-tx-tp truncate">{contact.name || 'Unnamed'}</h4>
      <p className="text-xs text-tx-ts font-mono mt-0.5">{contact.phoneNumber}</p>
      {contact.company && <p className="text-[10px] text-tx-tt mt-1 flex items-center gap-1 truncate"><Building2 className="w-3 h-3 flex-shrink-0" /> {contact.company}</p>}
      {contact.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {contact.tags.slice(0, 3).map(t => <TagPill key={t}>{t}</TagPill>)}
          {contact.tags.length > 3 && <span className="text-[10px] text-tx-tt">+{contact.tags.length - 3}</span>}
        </div>
      )}
      <div className="mt-2"><SentimentBadge sentiment={contact.sentiment} /></div>
    </motion.div>
  );
}

/* ─── Main Page ─── */

export default function ContactsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const CONTACTS_LIMIT = 25;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailContact, setDetailContact] = useState<any>(null);
  const [modalContact, setModalContact] = useState<any>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(CONTACTS_LIMIT) });
      if (search.trim()) params.set('search', search.trim());
      const data = await api.get(`/contacts?${params}`);
      if (Array.isArray(data)) {
        setContacts(data);
        setTotal(data.length);
      } else {
        setContacts(data.contacts || data.rows || []);
        setTotal(data.total || (data.contacts || data.rows || []).length);
      }
    } catch (err: any) { setError(err.message || 'Failed to load contacts'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => { setPage(1); }, [search]);

  const filtered = useMemo(() => {
    let list = [...contacts];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phoneNumber || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (filter === 'recent') {
      list = list.filter(c => c.lastContactAt);
      list.sort((a, b) => new Date(b.lastContactAt as string).getTime() - new Date(a.lastContactAt as string).getTime());
    } else if (filter === 'favorites') {
      list = list.filter(c => c.favorite);
    }
    if (filter === 'all') {
      list.sort((a, b) => {
        let va = a[sortField], vb = b[sortField];
        if (sortField === 'name') { va = va || ''; vb = vb || ''; }
        if (sortField === 'lastContactAt') { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; }
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [contacts, search, filter, sortField, sortDir]);

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selectedIds.size} contacts?`)) return;
    try {
      await Promise.all([...selectedIds].map(id => api.delete(`/contacts/${id}`)));
      setSelectedIds(new Set());
      fetchContacts();
    } catch {}
  }

  async function deleteContact(c) {
    if (!confirm(`Delete ${c.name || c.phoneNumber}?`)) return;
    try {
      await api.delete(`/contacts/${c.id}`);
      setDetailContact(null);
      fetchContacts();
    } catch {}
  }

  function openNewModal() { setModalContact({}); }

  async function quickCall(contact) {
    if (!contact.phoneNumber) return;
    try {
      await api.post('/voice/dial', { to: contact.phoneNumber });
      addToast(`Calling ${contact.phoneNumber}...`, 'info');
      router.push('/phone');
    } catch (err: any) {
      addToast(err?.data?.error || 'Failed to place call', 'error');
    }
  }
  function openEditModal(c) { setModalContact(c); setDetailContact(null); }
  function handleSaved() { fetchContacts(); }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
              <ContactIcon className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-tx-tp tracking-tight">Contacts</h1>
                {!loading && (
                  <span className="px-2 py-0.5 rounded-md bg-tx-green/10 border border-tx-green/20 text-tx-green text-[10px] font-bold tracking-wider">
                    {contacts.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-tx-ts mt-0.5">Your address book — auto-created from calls or added manually</p>
            </div>
          </div>
          <button onClick={openNewModal} className="gradient-primary px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-tx-green/20">
            <UserPlus className="w-4 h-4" /> New Contact
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx-tt" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl pl-9 pr-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-tt hover:text-tx-tp transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterPill>
            <FilterPill active={filter === 'recent'} onClick={() => setFilter('recent')}>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Recent</span>
            </FilterPill>
            <FilterPill active={filter === 'favorites'} onClick={() => setFilter('favorites')}>
              <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Favorites</span>
            </FilterPill>
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-tx-red/8 border border-tx-red/20 text-tx-red text-sm">
            {error}
            <button onClick={fetchContacts} className="ml-2 underline hover:no-underline">Retry</button>
          </div>
        )}

        <AnimatePresence>
          {selectedIds.size > 0 && (
            <div className="mb-4">
              <BulkActionsToolbar count={selectedIds.size} onDelete={deleteSelected} />
            </div>
          )}
        </AnimatePresence>

        {loading && (
          view === 'list'
            ? <div className="space-y-0">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            : <SkeletonGrid />
        )}

        {!loading && filtered.length === 0 && contacts.length === 0 && (
          <EmptyState onAdd={openNewModal} />
        )}

        {!loading && filtered.length === 0 && contacts.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Search className="w-8 h-8 text-tx-tt mb-3" />
            <p className="text-sm text-tx-ts">No contacts match your search</p>
            <button onClick={() => setSearch('')} className="mt-2 text-xs text-tx-green hover:underline">Clear search</button>
          </div>
        )}

        {/* List View */}
        {!loading && filtered.length > 0 && view === 'list' && (
          <div className="rounded-xl border border-tx-bdefault overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-2.5 bg-tx-s3/60 border-b border-tx-bdefault text-[10px] font-semibold text-tx-tt uppercase tracking-wider">
              <button onClick={toggleSelectAll} className="flex-shrink-0">
                {allSelected ? <CheckSquare className="w-4 h-4 text-tx-green" /> : <Square className="w-4 h-4" />}
              </button>
              <button onClick={() => handleSort('name')} className="flex items-center gap-1 flex-1 min-w-[140px] hover:text-tx-tp transition-colors">
                Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
              </button>
              <button onClick={() => handleSort('phoneNumber')} className="flex items-center gap-1 w-32 hover:text-tx-tp transition-colors">
                Phone <SortIcon field="phoneNumber" sortField={sortField} sortDir={sortDir} />
              </button>
              <span className="w-36">Email</span>
              <span className="w-28">Tags</span>
              <button onClick={() => handleSort('lastContactAt')} className="flex items-center gap-1 w-28 hover:text-tx-tp transition-colors">
                Last Call <SortIcon field="lastContactAt" sortField={sortField} sortDir={sortDir} />
              </button>
              <span className="w-20">Calls</span>
              <span className="w-8" />
            </div>
            <AnimatePresence>
              {filtered.map(c => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setDetailContact(c)}
                  className={`flex items-center gap-4 px-4 py-3 border-b border-tx-bdefault cursor-pointer transition-colors hover:bg-tx-s3/40 ${selectedIds.has(c.id) ? 'bg-tx-green/4' : ''}`}
                >
                  <button onClick={e => { e.stopPropagation(); toggleSelect(c.id); }} className="flex-shrink-0">
                    {selectedIds.has(c.id) ? <CheckSquare className="w-4 h-4 text-tx-green" /> : <Square className="w-4 h-4 text-tx-tt" />}
                  </button>
                  <div className="flex items-center gap-3 flex-1 min-w-[140px]">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-tx-green/20 to-tx-citron/20 border border-tx-bdefault/60 flex items-center justify-center text-xs font-bold text-tx-tp uppercase flex-shrink-0">
                      {initialsFromContact(c)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-tx-tp truncate">{c.name || 'Unnamed'}</p>
                      {c.company && <p className="text-[10px] text-tx-tt truncate">{c.company}</p>}
                    </div>
                  </div>
                  <span className="w-32 text-xs text-tx-ts font-mono truncate">{c.phoneNumber}</span>
                  <span className="w-36 text-xs text-tx-ts truncate">{c.email || '—'}</span>
                  <div className="w-28 flex flex-wrap gap-1">
                    {(c.tags || []).slice(0, 2).map(t => <TagPill key={t}>{t}</TagPill>)}
                    {(c.tags || []).length > 2 && <span className="text-[10px] text-tx-tt">+{c.tags.length - 2}</span>}
                  </div>
                  <span className="w-28 text-xs text-tx-ts">{fmtDate(c.lastContactAt)}</span>
                  <span className="w-20 text-xs text-tx-ts tabular-nums">{c.totalCalls || '—'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); quickCall(c); }}
                    className="w-8 flex items-center justify-center text-tx-tt hover:text-tx-green hover:bg-tx-green/10 rounded-lg transition-colors"
                    title="Call this contact"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Grid View */}
        {!loading && filtered.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filtered.map(c => (
                <ContactGridCard
                  key={c.id}
                  contact={c}
                  selected={selectedIds.has(c.id)}
                  onToggleSelect={toggleSelect}
                  onClick={setDetailContact}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {detailContact && (
          <ContactDetailPanel
            contact={detailContact}
            onClose={() => setDetailContact(null)}
            onEdit={openEditModal}
            onDelete={deleteContact}
            onQuickCall={quickCall}
          />
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        {modalContact !== null && (
          <ContactModal
            contact={Object.keys(modalContact).length ? modalContact : null}
            onClose={() => setModalContact(null)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>

      {/* Pagination */}
      {!loading && total > CONTACTS_LIMIT && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-tx-bdefault">
          <span className="text-[11px] text-tx-tt">{total} contact{total !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-[11px] font-medium disabled:opacity-30 hover:text-tx-tp transition-colors">Prev</button>
            <span className="text-[11px] text-tx-tt tabular-nums">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * CONTACTS_LIMIT >= total} className="px-3 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-[11px] font-medium disabled:opacity-30 hover:text-tx-tp transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
