'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Loader2, Check, Tag as TagIcon } from 'lucide-react';
import api from '../lib/api';

/**
 * DispositionPicker
 *
 * Grid of disposition buttons used to tag a call. Optional notes field appears
 * when the selected disposition has `requireNotes: true`.
 *
 * Props:
 *  - callId         (required)  UUID of the Call to set disposition on
 *  - currentDispositionId  (optional) currently-set disposition id
 *  - currentNotes   (optional)  currently-set notes
 *  - onSaved        (optional)  callback(call) after successful save
 *  - compact        (optional)  smaller buttons when true
 */
interface Disposition {
  id: string;
  name: string;
  icon: string;
  color: string;
  requireNotes?: boolean;
}

export default function DispositionPicker({
  callId,
  currentDispositionId,
  currentNotes = '',
  onSaved,
  compact = false,
}: {
  callId: string;
  currentDispositionId?: string | null;
  currentNotes?: string;
  onSaved?: (call: any) => void;
  compact?: boolean;
}) {
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(currentDispositionId || null);
  const [notes, setNotes] = useState(currentNotes || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/dispositions');
        if (!cancelled) setDispositions(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load dispositions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setSelectedId(currentDispositionId || null); }, [currentDispositionId]);
  useEffect(() => { setNotes(currentNotes || ''); }, [currentNotes]);

  const selected = dispositions.find((d) => d.id === selectedId) || null;
  const notesRequired = !!(selected?.requireNotes);

  async function handleSave() {
    if (!callId || !selectedId) return;
    if (notesRequired && !notes.trim()) {
      setError('Notes are required for this disposition');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.post(`/calls/${callId}/disposition`, {
        dispositionId: selectedId,
        notes: notes || undefined,
      });
      setSavedAt(Date.now());
      if (onSaved) onSaved(result);
    } catch (err: any) {
      setError(err.data?.error || err.message || 'Failed to save disposition');
    } finally {
      setSaving(false);
    }
  }

  function iconFor(name) {
    if (!name) return TagIcon;
    // Convert kebab-case to PascalCase (lucide-react export naming)
    const pascal = name
      .split(/[-_\s]+/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
    return LucideIcons[pascal] || TagIcon;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-tx-ts text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading dispositions…
      </div>
    );
  }

  if (dispositions.length === 0) {
    return <p className="text-sm text-tx-ts">No dispositions configured.</p>;
  }

  const sizing = compact
    ? 'px-3 py-2 text-xs gap-1.5'
    : 'px-4 py-3 text-sm gap-2';

  return (
    <div className="space-y-3">
      <div className={`grid ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'} gap-2`}>
        {dispositions.map((d) => {
          const Icon = iconFor(d.icon);
          const isSelected = d.id === selectedId;
          return (
            <motion.button
              key={d.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedId(d.id)}
              className={`flex items-center justify-center font-medium rounded-xl border transition-all duration-150 ${sizing} ${
                isSelected
                  ? 'text-tx-tp shadow-lg'
                  : 'text-tx-ts hover:text-tx-tp bg-tx-s3 border-tx-bdefault/50 hover:bg-tx-s3'
              }`}
              style={isSelected ? {
                background: `linear-gradient(135deg, ${d.color}33 0%, ${d.color}1a 100%)`,
                borderColor: `${d.color}66`,
                boxShadow: `0 0 18px ${d.color}33`,
              } : undefined}
            >
              <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} style={{ color: d.color }} />
              <span className="truncate">{d.name}</span>
              {isSelected && <Check className={compact ? 'w-3 h-3 ml-0.5' : 'w-3.5 h-3.5 ml-0.5'} />}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {notesRequired && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label className="text-[10px] font-semibold text-tx-ts uppercase tracking-wider">
              Notes <span className="text-tx-red normal-case font-normal">(required)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why was this disposition chosen?"
              rows={3}
              className="mt-1 w-full bg-tx-s3 border border-tx-bdefault/50 rounded-xl p-3 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/40 transition-colors resize-none"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!notesRequired && (
        <div>
          <label className="text-[10px] font-semibold text-tx-ts uppercase tracking-wider">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add context for this call…"
            rows={2}
            className="mt-1 w-full bg-tx-s3 border border-tx-bdefault/50 rounded-xl p-3 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/40 transition-colors resize-none"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-tx-red">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-tx-ts">
          {savedAt ? <span className="text-tx-green">✓ Saved</span> : selected ? `Selected: ${selected.name}` : 'Pick a disposition'}
        </p>
        <button
          onClick={handleSave}
          disabled={!selectedId || saving}
          className="px-4 py-2 rounded-xl bg-tx-green/20 border border-tx-green/30 text-tx-green text-xs font-semibold hover:bg-tx-green/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? 'Saving…' : 'Save Disposition'}
        </button>
      </div>
    </div>
  );
}
