import type { ReactNode } from "react";

export function PolicyModal({
  open,
  title,
  description,
  onClose,
  onSave,
  saving,
  saveLabel,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#000000]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{description}</p>
            ) : null}
          </div>
          <button
            className="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-5">{children}</div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-zinc-800/50">
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            onClick={onSave}
            type="button"
          >
            {saving ? "Saving..." : saveLabel ?? "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
