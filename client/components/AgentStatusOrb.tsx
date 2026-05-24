'use client';

/**
 * AgentStatusOrb — visual presence orb that opens a status menu on click.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_META = {
  online:  { label: 'Online',   dot: 'bg-tx-green',   ring: 'rgba(99,102,241,0.5)',  text: 'text-tx-green',   pulse: true  },
  away:    { label: 'Away',     dot: 'bg-tx-citron',  ring: 'rgba(211,255,166,0.5)', text: 'text-tx-citron',  pulse: false },
  busy:    { label: 'On Call',  dot: 'bg-tx-red',     ring: 'rgba(235,0,0,0.5)',    text: 'text-tx-red',     pulse: true  },
  break:   { label: 'Break',    dot: 'bg-orange-400',  ring: 'rgba(251,146,60,0.5)',  text: 'text-orange-300', pulse: false },
  dnd:     { label: 'DND',      dot: 'bg-tx-ts',       ring: 'rgba(122,148,136,0.4)', text: 'text-tx-ts',     pulse: false },
  offline: { label: 'Offline',  dot: 'bg-tx-tt',       ring: 'rgba(74,99,88,0.3)',   text: 'text-tx-tt',     pulse: false },
};

const ORDER = ['online', 'away', 'busy', 'break', 'dnd', 'offline'];

export default function AgentStatusOrb({ status = 'offline', onChange, agentName }: { status?: string; onChange?: (status: string) => void; agentName?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const meta = STATUS_META[status] || STATUS_META.offline;

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full elev-2 lift hover:border-tx-bstrong active:scale-[0.97] transition-transform"
      >
        {/* The orb */}
        <span className="relative flex items-center justify-center w-6 h-6">
          <span
            className={`absolute inset-1 rounded-full ${meta.dot} ${meta.pulse ? 'orb-pulse' : ''}`}
            style={{ '--orb-color': meta.ring }}
          />
          <span className={`relative w-2.5 h-2.5 rounded-full ${meta.dot} shadow-[0_0_8px_currentColor]`} />
        </span>

        <div className="flex flex-col items-start leading-none">
          {agentName && (
            <span className="text-[9px] font-semibold text-tx-tt uppercase tracking-[0.12em]">
              {agentName}
            </span>
          )}
          <span className={`text-[11px] font-semibold ${meta.text}`}>{meta.label}</span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-1.5 w-48 elev-3 rounded-xl overflow-hidden z-[200]"
          >
            <div className="px-3 py-2 border-b border-tx-bsubtle">
              <p className="text-[10px] font-semibold text-tx-tt uppercase tracking-[0.12em]">
                Set status
              </p>
            </div>
            <div className="p-1">
              {ORDER.map((key) => {
                const m = STATUS_META[key];
                const active = key === status;
                return (
                  <button
                    key={key}
                    onClick={() => { onChange?.(key); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                      active
                        ? 'bg-tx-green/[0.06] text-tx-tp'
                        : 'text-tx-ts hover:bg-tx-s2 hover:text-tx-tp'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${m.dot} ${m.pulse ? 'shadow-[0_0_6px_currentColor]' : ''}`} />
                    <span className="flex-1 text-left">{m.label}</span>
                    {active && <span className="text-[10px] text-tx-green font-semibold">●</span>}
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
