'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

/* ── Toast Context ──────────────────────────────────────────────────── */

interface ToastValue {
  addToast: (message: string, type?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
}

interface ToastItem {
  id: string;
  message: string;
  type: string;
}

const ToastContext = createContext<ToastValue | null>(null);

/* ── Toast Icons by type ────────────────────────────────────────────── */

const TOAST_CONFIG = {
  success: {
    Icon: CheckCircle2,
    bg: 'bg-tx-green/15',
    border: 'border-tx-green/25',
    text: 'text-tx-green',
    iconColor: 'text-tx-green',
  },
  error: {
    Icon: AlertCircle,
    bg: 'bg-tx-red/15',
    border: 'border-tx-red/25',
    text: 'text-tx-red',
    iconColor: 'text-tx-red',
  },
  info: {
    Icon: Info,
    bg: 'bg-tx-blue/15',
    border: 'border-tx-blue/25',
    text: 'text-tx-blue',
    iconColor: 'text-tx-blue',
  },
};

/* ── Single Toast Item ──────────────────────────────────────────────── */

function ToastItem({ id, message, type = 'info', onDismiss }: { id: string; message: string; type?: string; onDismiss: (id: string) => void }) {
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  const { Icon } = config;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md ${config.bg} ${config.border}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${config.iconColor}`} />
      <span className={`text-[13px] font-medium ${config.text} flex-1`}>{message}</span>
      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5 text-tx-tt" />
      </button>
    </motion.div>
  );
}

/* ── Toast Provider ──────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: string = 'info', duration: number = 4000): string => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<ToastValue>(() => ({ addToast, dismissToast }), [addToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container — top-right, stacked */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 400 }}>
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem {...toast} onDismiss={dismissToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/* ── useToast Hook ───────────────────────────────────────────────────── */

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback if used outside provider (shouldn't happen with proper setup)
    return {
      addToast: () => {},
      dismissToast: () => {},
    };
  }
  return ctx;
}
