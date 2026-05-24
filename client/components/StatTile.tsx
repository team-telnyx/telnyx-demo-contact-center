'use client';

/**
 * StatTile — premium stat card with left-edge accent strip, animated number,
 * optional trend indicator, and live pulse badge.
 */

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

const ACCENT_CLASS = {
  emerald: 'accent-emerald',
  indigo:  'accent-indigo',
  violet:  'accent-violet',
  cyan:    'accent-cyan',
  amber:   'accent-amber',
  rose:    'accent-rose',
};

const ICON_TINT = {
  emerald: 'text-tx-green bg-tx-green/10',
  indigo:  'text-tx-green bg-tx-green/10',
  violet:  'text-tx-citron bg-tx-green/10',
  cyan:    'text-tx-blue bg-tx-blue/10',
  amber:   'text-tx-citron bg-tx-citron/10',
  rose:    'text-tx-red bg-tx-red/10',
};

export default function StatTile({
  icon: Icon,
  label,
  value,
  trend,
  accent = 'indigo',
  live = false,
  delay = 0,
  format,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number | string;
  trend?: { dir: 'up' | 'down' | 'flat'; delta: string; label?: string };
  accent?: string;
  live?: boolean;
  delay?: number;
  format?: (n: number) => string;
  sub?: string;
  color?: string;
}) {
  const accentClass = ACCENT_CLASS[accent] || ACCENT_CLASS.indigo;
  const tint = ICON_TINT[accent] || ICON_TINT.indigo;

  const TrendIcon =
    trend?.dir === 'up'   ? TrendingUp :
    trend?.dir === 'down' ? TrendingDown :
                             Minus;

  const trendColor =
    trend?.dir === 'up'   ? 'text-tx-green' :
    trend?.dir === 'down' ? 'text-tx-red'    :
                             'text-tx-tt';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`elev-2 lift accent-strip ${accentClass} rounded-xl pl-5 pr-4 py-4 hover:border-tx-bstrong`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold text-tx-tt uppercase tracking-[0.12em]">
              {label}
            </p>
            {live && (
              <span className="flex items-center gap-1 px-1.5 py-px rounded-full bg-tx-green/10 border border-tx-green/15">
                <span className="w-1 h-1 rounded-full bg-tx-green live-dot" />
                <span className="text-[8px] font-semibold text-tx-green uppercase tracking-wider">Live</span>
              </span>
            )}
          </div>
          <p className="text-[24px] font-bold text-tx-tp leading-tight mt-1 tnum">
            <AnimatedNumber value={value} format={format} />
          </p>
          {trend && (
            <div className={`flex items-center gap-1 mt-1 text-[11px] font-semibold ${trendColor}`}>
              <TrendIcon className="w-3 h-3" strokeWidth={2.5} />
              <span className="tnum">{trend.delta}</span>
              {trend.label && <span className="text-tx-tt font-medium">· {trend.label}</span>}
            </div>
          )}
        </div>

        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
            <Icon className="w-[16px] h-[16px]" strokeWidth={1.75} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
