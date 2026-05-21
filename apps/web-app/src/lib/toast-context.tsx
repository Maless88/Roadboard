'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';


export type ToastVariant = 'success' | 'error' | 'info';


export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}


interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}


const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;
let counter = 0;


export function ToastProvider({ children }: { children: React.ReactNode }) {

  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {

    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);

    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {

    const id = `toast-${++counter}`;
    setToasts((prev) => [...prev, { id, message, variant }]);

    const timer = setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    timers.current.set(id, timer);
  }, [dismiss]);

  useEffect(() => {

    const map = timers.current;

    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismiss }}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}


function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '22rem',
        width: '100%',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}


const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; color: string }> = {
  success: {
    bg: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    color: '#86efac',
  },
  error: {
    bg: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.30)',
    color: '#fca5a5',
  },
  info: {
    bg: 'rgba(99,102,241,0.10)',
    border: '1px solid rgba(99,102,241,0.30)',
    color: '#a5b4fc',
  },
};


function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {

  const s = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="alert"
      style={{
        background: s.bg,
        border: s.border,
        color: s.color,
        borderRadius: '0.625rem',
        padding: '0.75rem 1rem',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        animation: 'toast-slide-in 0.18s ease',
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          opacity: 0.6,
          fontSize: '1rem',
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}


export function useToast(): ToastContextValue {

  const ctx = useContext(ToastContext);

  if (!ctx) throw new Error('useToast must be used within ToastProvider');

  return ctx;
}
