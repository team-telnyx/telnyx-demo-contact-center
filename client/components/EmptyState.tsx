'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Reusable empty state component with subtle entrance animation.
 * Renders a large icon in a gradient container, a title, optional
 * description, and an optional action button.
 */
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {/* Large icon container with gradient background */}
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-tx-green/20 via-tx-citron/10 to-tx-blue/10 border border-tx-bsubtle flex items-center justify-center shadow-sm">
          <Icon className="w-7 h-7 text-tx-ts" strokeWidth={1.5} />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-tx-tp mb-1.5">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-[12.5px] text-tx-tt leading-relaxed max-w-[280px]">{description}</p>
      )}

      {/* Optional action button */}
      {actionLabel && onAction && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAction}
          className="mt-5 flex items-center gap-1.5 h-9 px-5 rounded-xl gradient-primary text-white text-[13px] font-medium shadow-md shadow-tx-green/15"
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
