'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, ExternalLink, X, Zap, Globe, Code2, BookOpen } from 'lucide-react';

/**
 * TelnyxApiInfo — a floating info badge that explains which Telnyx API
 * endpoint powers the feature it's attached to.
 *
 * Usage:
 *   <TelnyxApiInfo endpoint="POST /v2/calls" product="Call Control" docs="https://..." />
 *
 * Props:
 *   endpoint   — the API path(s), e.g. "POST /v2/calls" or array of strings
 *   product    — Telnyx product name, e.g. "Call Control"
 *   description — optional plain-English explanation
 *   docs       — optional Telnyx docs URL
 *   webhook    — optional webhook event name, e.g. "call.initiated"
 *   side       — 'right' | 'left' | 'top' | 'bottom' (default 'right')
 *   size       — 'sm' | 'md' (default 'md')
 */
export default function TelnyxApiInfo({
  endpoint,
  product,
  description,
  docs,
  webhook,
  side = 'right',
  size = 'md',
}: {
  endpoint?: string | string[];
  product?: string;
  description?: string;
  docs?: string;
  webhook?: string | string[];
  side?: 'right' | 'left' | 'top' | 'bottom';
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const endpoints = Array.isArray(endpoint) ? endpoint : [endpoint].filter(Boolean);

  const sideClasses = {
    right:  'left-full ml-2 top-0',
    left:   'right-full mr-2 top-0',
    top:    'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const btnSize  = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <span ref={ref} className="relative inline-flex items-center" style={{ zIndex: 50 }}>
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className={`${btnSize} rounded-full bg-tx-green/15 border border-tx-green/30 text-tx-green hover:bg-tx-green/25 hover:border-tx-green/50 hover:text-tx-green transition-all flex items-center justify-center flex-shrink-0`}
        title="See which Telnyx API powers this"
      >
        <Info className={iconSize} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: side === 'top' ? 8 : side === 'bottom' ? -8 : 0, x: side === 'right' ? -8 : side === 'left' ? 8 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute ${sideClasses[side]} z-50 w-72`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-tx-s1/98 backdrop-blur-xl border border-tx-green/25 rounded-2xl shadow-2xl shadow-black/50 p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-tx-green/15 border border-tx-green/25 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3 h-3 text-tx-green" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-tx-green/70">Powered by Telnyx</p>
                    {product && (
                      <p className="text-xs font-semibold text-tx-tp leading-tight">{product}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-0.5 rounded-md text-tx-ts hover:text-tx-ts transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Description */}
              {description && (
                <p className="text-xs text-tx-ts leading-relaxed">{description}</p>
              )}

              {/* Endpoints */}
              {endpoints.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-tx-ts flex items-center gap-1">
                    <Code2 className="w-3 h-3" />
                    API Endpoint{endpoints.length > 1 ? 's' : ''}
                  </p>
                  {endpoints.map((ep, i) => {
                    const parts = ep.match(/^(GET|POST|PUT|PATCH|DELETE|WS|WSS)?\s*(.*)$/);
                    const method = parts?.[1];
                    const path   = parts?.[2] || ep;
                    const methodColors = {
                      GET:    'text-tx-green bg-tx-green/10 border-tx-green/20',
                      POST:   'text-tx-blue bg-tx-blue/10 border-tx-blue/20',
                      PUT:    'text-tx-citron bg-tx-citron/10 border-tx-citron/20',
                      PATCH:  'text-orange-400 bg-orange-400/10 border-orange-400/20',
                      DELETE: 'text-tx-red bg-tx-red/10 border-tx-red/20',
                      WS:     'text-tx-citron bg-tx-green/10 border-tx-citron/20',
                      WSS:    'text-tx-citron bg-tx-green/10 border-tx-citron/20',
                    };
                    return (
                      <div key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                        {method && (
                          <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase ${methodColors[method] || 'text-tx-ts bg-tx-s2 border-tx-bsubtle'}`}>
                            {method}
                          </span>
                        )}
                        <span className="text-tx-ts truncate">{path}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Webhook */}
              {webhook && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-tx-ts flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Webhook Event{Array.isArray(webhook) && webhook.length > 1 ? 's' : ''}
                  </p>
                  {(Array.isArray(webhook) ? webhook : [webhook]).map((wh, i) => (
                    <div key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase text-tx-citron bg-tx-green/10 border-tx-citron/20">
                        WH
                      </span>
                      <span className="text-tx-ts">{wh}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Docs link */}
              {docs && (
                <a
                  href={docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-tx-green hover:text-tx-green transition-colors group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <BookOpen className="w-3 h-3" />
                  View Telnyx docs
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
