"use client";

import { FormEvent } from "react";
import { X } from "lucide-react";
import { useBoardStore } from "@/store/board-store";

function Dialog({
  title,
  children,
  panelClassName,
  bodyClassName
}: {
  title: string;
  children: React.ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
}) {
  const setModal = useBoardStore((state) => state.setModal);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <section className={`w-full max-w-lg rounded-lg bg-white shadow-soft ${panelClassName ?? ""}`}>
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)} type="button">
            <X size={18} />
          </button>
        </header>
        <div className={bodyClassName}>{children}</div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="min-h-28 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function Submit({ label, disabled, loading }: { label: string; disabled?: boolean; loading?: boolean }) {
  return (
    <button className="flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={disabled || loading}>
      {loading && <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
      {label}
    </button>
  );
}

export { Dialog, Field, TextArea, Submit };
