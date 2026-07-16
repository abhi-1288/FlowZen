import type { ReactNode } from "react";

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  confirmWord,
  inputValue,
  onInputChange,
  loading,
  onConfirm,
  onCancel,
  children,
  noInput,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  confirmWord?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  noInput?: boolean;
}) {
  if (!open) return null;

  const confirmed = noInput || inputValue === confirmWord;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#000000]">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">{title}</h3>
        {description ? (
          <div className="mt-2 text-sm text-slate-600 dark:text-zinc-400">{description}</div>
        ) : null}
        {children}
        {!noInput && confirmWord ? (
          <input
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 dark:border-zinc-800 dark:bg-[#000000]"
            placeholder={`Type ${confirmWord}`}
            value={inputValue ?? ""}
            onChange={(e) => onInputChange?.(e.target.value)}
          />
        ) : null}
        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-zinc-800" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!confirmed || loading}
            onClick={onConfirm}
          >
            {loading ? "Processing..." : confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
