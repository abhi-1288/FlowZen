import { ActionButton } from "../../shared";
import type { RejectTarget } from "../types";

const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-black/40";
const modalClass = "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl";

export function RejectModal({
  rejectTarget,
  rejectReason,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  rejectTarget: RejectTarget | null;
  rejectReason: string;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!rejectTarget) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h4 className="text-lg font-semibold">Rejection reason</h4>
        <textarea
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2"
          rows={3}
          placeholder="Why are you rejecting this request?"
          value={rejectReason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onCancel}>Cancel</ActionButton>
          <button
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={!rejectReason.trim()}
            onClick={onConfirm}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
