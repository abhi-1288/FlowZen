import { X } from "lucide-react";
import { ActionButton } from "../../shared";

const overlayClass = "fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4";
const modalClass = "w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#000000]";

export function FireModal({
  member,
  fireConfirmText,
  firingFor,
  onTextChange,
  onCancel,
  onConfirm,
}: {
  member: { id?: string; name?: string } | null;
  fireConfirmText: string;
  firingFor: string | null;
  onTextChange: (text: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!member) return null;

  const memberId = String(member.id ?? "");
  const isFiring = firingFor === memberId;
  const canConfirm = fireConfirmText.trim().toUpperCase() === "FIRE";

  return (
    <div className={overlayClass} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={modalClass} role="dialog" aria-modal="true" aria-labelledby="fire-modal-title">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-zinc-800/50">
          <div>
            <h4 className="text-sm font-semibold text-rose-700" id="fire-modal-title">Fire member</h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              This will remove the member from the company, teams, and boards.
            </p>
          </div>
          <button
            aria-label="Close"
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 text-slate-500 hover:text-slate-700 hover:bg-slate-50 h-10 w-10 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-700"
            type="button"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:bg-rose-950">
            <p className="text-sm font-semibold text-rose-800">
              You are about to fire{" "}
              <span className="font-extrabold">{String(member.name ?? "Member")}</span>
            </p>
            <p className="mt-1 text-sm text-rose-700">
              Type <span className="font-bold">FIRE</span> to confirm.
            </p>
          </div>
          <input
            className="mt-4 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-[#000000]"
            placeholder="Type FIRE to confirm"
            value={fireConfirmText}
            onChange={(e) => onTextChange(e.target.value)}
          />
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <ActionButton variant="secondary" type="button" onClick={onCancel}>Cancel</ActionButton>
            <button
              className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isFiring || !canConfirm}
              type="button"
              onClick={onConfirm}
            >
              {isFiring ? "Removing…" : "Confirm fire"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
