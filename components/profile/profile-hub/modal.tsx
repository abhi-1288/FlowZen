"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col`}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        ) : null}
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
