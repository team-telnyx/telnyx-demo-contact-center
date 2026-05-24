'use client';

/**
 * QueueStrip — horizontally scrolling row of queue pills.
 */

import { motion } from 'framer-motion';
import { Activity, Users, Clock } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

function tierFor(depth, waitMs) {
  const waitSec = Math.round((waitMs || 0) / 1000);
  if (depth >= 5 || waitSec >= 60) {
    return {
      base: 'bg-tx-red/10 border-tx-red/20 text-tx-tp hover:border-tx-red/30',
      dot:  'bg-tx-red',
      live: true,
    };
  }
  if (depth > 0) {
    return {
      base: 'bg-tx-citron/10 border-tx-citron/20 text-tx-tp hover:border-tx-citron/30',
      dot:  'bg-tx-citron',
      live: true,
    };
  }
  return {
    base: 'bg-tx-green/[0.07] border-tx-green/15 text-tx-tp hover:border-tx-green/25',
    dot:  'bg-tx-green',
    live: false,
  };
}

function fmtWait(ms) {
  if (!ms || ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m${r ? ` ${r}s` : ''}`;
}

export default function QueueStrip({ queueStatus = {}, className = '' }: { queueStatus?: Record<string, { depth?: number; oldestWaitMs?: number }>; className?: string }) {
  const entries = Object.entries(queueStatus);

  if (entries.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 elev-1 rounded-xl ${className}`}>
        <Activity className="w-3.5 h-3.5 text-tx-tt" />
        <span className="text-[12px] text-tx-ts font-medium">No active queues</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-tx-tt" />
        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-[0.12em]">
          Queues
        </span>
        <span className="text-[10px] text-tx-tt font-medium">
          · <span className="tnum">{entries.length}</span> active
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {entries.map(([name, info], i) => {
          const tier = tierFor(info.depth || 0, info.oldestWaitMs || 0);
          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-lg border lift cursor-default flex-shrink-0 ${tier.base}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tier.dot} ${tier.live ? 'live-dot' : ''}`} />
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-semibold capitalize">
                  {name.replace(/_/g, ' ')}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-tx-ts mt-0.5">
                  <span className="flex items-center gap-0.5">
                    <Users className="w-2.5 h-2.5" />
                    <span className="tnum"><AnimatedNumber value={info.depth || 0} /></span>
                  </span>
                  <span className="text-tx-bsubtle">·</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="tnum">{fmtWait(info.oldestWaitMs)}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
