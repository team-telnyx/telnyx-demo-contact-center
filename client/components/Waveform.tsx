'use client';

/**
 * Waveform — small animated bar waveform for active calls.
 *
 * Pure CSS animation (no canvas) — each bar gets a randomized delay & duration
 * for a more organic look. Accepts `active` to freeze the animation.
 */

import { useMemo } from 'react';

export default function Waveform({
  bars = 28,
  active = true,
  className = '',
  color = 'emerald',
}: {
  bars?: number;
  active?: boolean;
  className?: string;
  color?: string;
}) {
  const offsets = useMemo(
    () => Array.from({ length: bars }, () => ({
      delay: Math.random() * 1.1,
      dur:   0.7 + Math.random() * 0.9,
      base:  0.3 + Math.random() * 0.5,
    })),
    [bars]
  );

  const gradient = {
    emerald: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
    indigo:  'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
    violet:  'linear-gradient(180deg, #d3ffa6 0%, #6366f1 100%)',
  }[color] || 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)';

  return (
    <div className={`flex items-center justify-center h-12 ${className}`} aria-hidden="true">
      {offsets.map((o, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{
            height: `${Math.round(o.base * 100)}%`,
            animationDelay: `${o.delay}s`,
            animationDuration: `${o.dur}s`,
            animationPlayState: active ? 'running' : 'paused',
            background: gradient,
            opacity: active ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
