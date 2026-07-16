import { X } from "lucide-react";
import { ActionButton, AnyRecord } from "../shared";

export function AskModal({
  isOpen,
  onClose,
  showToast,
  canAskPaidLeave,
  remainingWfhDays,
  profile,
  onLeave,
  onWfh,
  onCheckout,
}: {
  isOpen: boolean;
  onClose: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
  canAskPaidLeave: boolean;
  remainingWfhDays: number;
  profile: AnyRecord | null;
  onLeave: () => void;
  onWfh: () => void;
  onCheckout: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Ask</h3>
          <ActionButton variant="ghost" className="p-1" onClick={onClose} aria-label="Close">
            <X size={20} />
          </ActionButton>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            {profile?.role !== "admin" && (
              <ActionButton
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  if (!canAskPaidLeave) {
                    showToast("Paid leave quota is used up. Missed dates will count as absent.", "error");
                    return;
                  }
                  onLeave();
                }}
                disabled={!canAskPaidLeave}
                title={!canAskPaidLeave ? "Paid leave quota used up." : "Request paid leave."}
              >
                Leave
              </ActionButton>
            )}
            <ActionButton
              variant="secondary"
              className="flex-1"
              onClick={() => {
                if (remainingWfhDays <= 0) {
                  showToast("WFH quota used up.", "error");
                  return;
                }
                onWfh();
              }}
              disabled={remainingWfhDays <= 0}
              title={remainingWfhDays <= 0 ? "WFH quota used up." : "Request WFH."}
            >
              WFH
            </ActionButton>
          </div>
          <ActionButton
            variant="secondary"
            className="w-full"
            onClick={onCheckout}
          >
            Check-out
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function RequestsModal({
  isOpen,
  onClose,
  pendingLeave,
  pendingWfh,
  checkOutCount,
  onLeaveClick,
  onWfhClick,
  onCheckoutClick,
}: {
  isOpen: boolean;
  onClose: () => void;
  pendingLeave: number;
  pendingWfh: number;
  checkOutCount: number;
  onLeaveClick: () => void;
  onWfhClick: () => void;
  onCheckoutClick: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Requests</h3>
          <ActionButton variant="ghost" className="p-1" onClick={onClose} aria-label="Close">
            <X size={20} />
          </ActionButton>
        </div>
        <div className="flex flex-col gap-3">
          <ActionButton
            variant="secondary"
            className="w-full"
            onClick={onLeaveClick}
          >
            {`Leave${pendingLeave ? ` (${pendingLeave})` : ""}`}
          </ActionButton>
          <ActionButton
            variant="secondary"
            className="w-full"
            onClick={onWfhClick}
          >
            {`WFH${pendingWfh ? ` (${pendingWfh})` : ""}`}
          </ActionButton>
          <ActionButton
            variant="secondary"
            className="w-full"
            onClick={onCheckoutClick}
          >
            {`Check-out${checkOutCount ? ` (${checkOutCount})` : ""}`}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
