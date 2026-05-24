'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] leading-none border transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--surface-3)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
        success:
          'bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--border-strong)]',
        citron:
          'bg-[var(--citron-dim)] text-[var(--citron)] border-[var(--citron-dim)]',
        warning:
          'bg-[rgba(245,158,11,0.12)] text-[#fbbf24] border-[rgba(245,158,11,0.25)]',
        danger:
          'bg-[rgba(239,68,68,0.12)] text-[#f87171] border-[rgba(239,68,68,0.25)]',
        info:
          'bg-[rgba(34,211,238,0.10)] text-[#22d3ee] border-[rgba(34,211,238,0.22)]',
        outline:
          'bg-transparent text-[var(--text-secondary)] border-[var(--border-default)]',
        solid:
          'bg-[var(--accent)] text-[var(--text-inverse)] border-transparent',
      },
      size: {
        sm: 'px-1.5 py-[1px] text-[9px]',
        md: 'px-2 py-0.5 text-[10px]',
        lg: 'px-2.5 py-1 text-[11px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
