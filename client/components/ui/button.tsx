'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-0)] disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,192,139,0.55)]',
        secondary:
          'bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-4)] hover:border-[var(--border-strong)]',
        ghost:
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]',
        outline:
          'border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]',
        danger:
          'bg-[#ef4444] text-white hover:bg-[#dc2626] shadow-[0_8px_24px_-12px_rgba(239,68,68,0.55)]',
        citron:
          'bg-[var(--citron)] text-[#060D1A] hover:opacity-90 font-semibold shadow-[0_8px_24px_-12px_rgba(212,255,0,0.65)]',
        link:
          'text-[var(--accent)] hover:underline underline-offset-4 px-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2.5 text-[11px] rounded-md',
        sm: 'h-8 px-3 text-[12px]',
        md: 'h-9 px-4',
        lg: 'h-10 px-5 text-[14px]',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp: any = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
