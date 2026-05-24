'use client';

/**
 * AnimatedNumber — smoothly tweens a numeric value with framer-motion.
 *
 * Renders tabular nums so digits don't shift width as they tick.
 * Falls back to a plain string render when value is non-numeric (e.g. status label).
 */

import { useEffect, useRef } from 'react';
import { animate, useMotionValue, useTransform, motion } from 'framer-motion';

export default function AnimatedNumber({
  value,
  duration = 0.6,
  format = (n: number) => Math.round(n).toLocaleString(),
  className = '',
}: {
  value: number | string;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  // Non-numeric values bypass the tween (e.g. "Online", "—")
  const isNumeric = typeof value === 'number' && Number.isFinite(value);

  const motionVal = useMotionValue(isNumeric ? value : 0);
  const display = useTransform(motionVal, (latest) => format(latest));
  const last = useRef(isNumeric ? value : 0);

  useEffect(() => {
    if (!isNumeric) return;
    const controls = animate(motionVal, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { last.current = v; },
    });
    return () => controls.stop();
  }, [value, duration, isNumeric, motionVal]);

  if (!isNumeric) {
    return <span className={`tnum ${className}`}>{value ?? '—'}</span>;
  }

  return <motion.span className={`tnum ${className}`}>{display}</motion.span>;
}
