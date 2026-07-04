"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Bell } from "lucide-react";

type ToastItem = {
  id: number;
  title: string;
  body?: string;
  time?: string;
};

type ToastContextType = {
  showNotificationToast: (title: string, body?: string) => void;
};

const ToastContext = createContext<ToastContextType>({
  showNotificationToast: () => {},
});

export function useNotificationToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showNotificationToast = useCallback((title: string, body?: string) => {
    const id = Date.now() + Math.random();
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setToasts((prev) => [...prev, { id, title, body, time }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showNotificationToast }}>
      {children}
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
    </ToastContext.Provider>
  );
}
