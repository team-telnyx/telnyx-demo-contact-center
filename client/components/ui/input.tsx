'use client';

import * as React from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', leftIcon, rightIcon, ...props }, ref) => {
    const base = cn(
      'flex h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors',
      'focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
      leftIcon && 'pl-9',
      rightIcon && 'pr-9',
      className,
    );
    if (leftIcon || rightIcon) {
      return (
        <div className="relative w-full">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {leftIcon}
            </div>
          )}
          <input ref={ref} type={type} className={base} {...props} />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }
    return <input ref={ref} type={type} className={base} {...props} />;
  },
);
Input.displayName = 'Input';

export { Input };
