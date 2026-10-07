import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SERVICE_UNAVAILABLE_EVENT } from '../api/client';

export type ToastKind = 'error' | 'info' | 'success';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const showToast = useCallback((message: string, kind: ToastKind = 'error') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, 5000);
    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    const handleServiceUnavailable = () => {
      showToast('Service temporarily unavailable, please try again.', 'error');
    };
    window.addEventListener(SERVICE_UNAVAILABLE_EVENT, handleServiceUnavailable);
    return () => window.removeEventListener(SERVICE_UNAVAILABLE_EVENT, handleServiceUnavailable);
  }, [showToast]);

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
