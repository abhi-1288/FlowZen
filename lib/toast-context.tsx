"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, AlertTriangle } from "lucide-react";

type ToastItem = {
  id: number;
  title: string;
  body?: string;
  time?: string;
};

type ToastContextType = {
  showNotificationToast: (title: string, body?: string) => void;
  showErrorToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextType>({
  showNotificationToast: () => {},
  showErrorToast: () => {},
});

export function useNotificationToast() {
  return useContext(ToastContext);
}

// Non-React emitter so non-component code (e.g. apiFetch) can raise error toasts.
const errorToastListeners = new Set<(message: string) => void>();
export function emitErrorToast(message: string) {
  errorToastListeners.forEach((listener) => listener(message));
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [errorToasts, setErrorToasts] = useState<{ id: string; message: string; at: number }[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showNotificationToast = useCallback((title: string, body?: string) => {
    const id = Date.now() + Math.random();
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setToasts((prev) => [...prev, { id, title, body, time }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const showErrorToast = useCallback((message: string) => {
    const now = Date.now();
    setErrorToasts((prev) => {
      if (prev.some((t) => t.message === message && now - t.at < 800)) return prev;
      const id = `${now}-${Math.random()}`;
      setTimeout(() => setErrorToasts((p) => p.filter((t) => t.id !== id)), 5000);
      return [...prev, { id, message, at: now }].slice(-3);
    });
  }, []);

  useEffect(() => {
    const listener = (message: string) => showErrorToast(message);
    errorToastListeners.add(listener);
    return () => {
      errorToastListeners.delete(listener);
    };
  }, [showErrorToast]);

  return (
    <ToastContext.Provider value={{ showNotificationToast, showErrorToast }}>
      {children}

      {/* Notification toasts — bottom-right */}
      <div className="fixed bottom-8 right-4 z-[200] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-2xl bg-slate-950 px-5 py-4 shadow-2xl ring-1 ring-slate-700 text-white"
          >
            <div className="flex items-start gap-3">
              <Bell size={18} className="mt-0.5 shrink-0 text-sky-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight text-white">{toast.title}</p>
                {toast.body ? (
                  <p className="mt-1 text-xs text-slate-200 leading-relaxed line-clamp-2">{toast.body}</p>
                ) : null}
                {toast.time ? (
                  <p className="mt-1.5 text-right text-[10px] text-slate-400 font-medium">{toast.time}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Error toasts — bottom-center, portaled above all modals */}
      {typeof document !== "undefined"
        ? createPortal(
            <div className="fixed bottom-8 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2 w-full max-w-md px-4 pointer-events-none">
              {errorToasts.map((toast) => (
                <div
                  key={toast.id}
                  className="pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300 w-full rounded-2xl bg-rose-600 px-5 py-4 shadow-2xl ring-1 ring-rose-700/60 text-white dark:bg-rose-500 dark:ring-rose-300/50"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-white" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight text-white">Something went wrong</p>
                      <p className="mt-1 text-xs text-white/90 leading-relaxed">{toast.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
