import { CalendarOff, ChevronRight, Eraser, Home, LogOut, X } from "lucide-react";
import { ActionButton, AnyRecord } from "../shared";

/**
 * The attendance "Ask" picker: one row per request the member can raise.
 * Every label names the modal it opens ("Request Leave" → the leave form, …)
 * and the description says in one line what the request actually does, so
 * "check-out" (a missing check-out being added) and "record removal" (a wrong
 * record being deleted) can't be mistaken for each other.
 */
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
  onRemoval,
  removalPending = 0,
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
  onRemoval: () => void;
  removalPending?: number;
}) {
  if (!isOpen) return null;

  const options: {
    key: string;
    icon: typeof CalendarOff;
    tone: string;
    title: string;
    description: string;
    disabled: boolean;
    badge?: number;
    onClick: () => void;
  }[] = [];
  if (profile?.role !== "admin") {
    options.push({
      key: "leave",
      icon: CalendarOff,
      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
      title: "Request Leave",
      description: canAskPaidLeave ? "Paid time off for yourself" : "Paid leave quota used up",
      disabled: !canAskPaidLeave,
      onClick: () => {
        if (!canAskPaidLeave) {
          showToast("Paid leave quota is used up. Missed dates will count as absent.", "error");
          return;
        }
        onLeave();
      },
    });
  }
  options.push(
    {
      key: "wfh",
      icon: Home,
      tone: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
      title: "Request WFH",
      description:
        remainingWfhDays > 0
          ? `Work from home — ${remainingWfhDays} day${remainingWfhDays === 1 ? "" : "s"} left`
          : "WFH quota used up",
      disabled: remainingWfhDays <= 0,
      onClick: () => {
        if (remainingWfhDays <= 0) {
          showToast("WFH quota used up.", "error");
          return;
        }
        onWfh();
      },
    },
    {
      key: "checkout",
      icon: LogOut,
      tone: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
      title: "Request Check-out",
      description: "Forgot to check out? Finance adds it for you",
      disabled: false,
      onClick: onCheckout,
    },
    {
      key: "removal",
      icon: Eraser,
      tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
      title: "Request Record Removal",
      description: "Wrong record (e.g. checked in on a day off)? Ask to delete it",
      disabled: false,
      badge: removalPending,
      onClick: onRemoval,
    },
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center neu-overlay p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-slate-900">Ask</h3>
          <ActionButton variant="ghost" className="p-1" onClick={onClose} aria-label="Close">
            <X size={20} />
          </ActionButton>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-zinc-400">Raise a new request.</p>
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.key}
                type="button"
                disabled={option.disabled}
                title={option.disabled ? option.description : undefined}
                onClick={option.onClick}
                className="group flex w-full items-center gap-3 rounded-xl border border-[var(--c-border-light)] bg-white px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:hover:border-indigo-700 dark:hover:bg-zinc-800/60"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${option.tone}`}>
                  <OptionIcon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                      {option.title}
                    </span>
                    {option.badge ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                        {option.badge} pending
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-zinc-400">
                    {option.description}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-indigo-400 dark:text-zinc-600" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The attendance "Requests" picker: one row per request list the member can
 * open. Labels match the list modal titles exactly, and the badge shows how
 * many of the member's own requests are still pending.
 */
export function RequestsModal({
  isOpen,
  onClose,
  pendingLeave,
  pendingWfh,
  checkOutCount,
  removalCount,
  onLeaveClick,
  onWfhClick,
  onCheckoutClick,
  onRemovalClick,
}: {
  isOpen: boolean;
  onClose: () => void;
  pendingLeave: number;
  pendingWfh: number;
  checkOutCount: number;
  removalCount: number;
  onLeaveClick: () => void;
  onWfhClick: () => void;
  onCheckoutClick: () => void;
  onRemovalClick: () => void;
}) {
  if (!isOpen) return null;

  const rows: {
    key: string;
    icon: typeof CalendarOff;
    tone: string;
    title: string;
    description: string;
    count: number;
    onClick: () => void;
  }[] = [
    {
      key: "leave",
      icon: CalendarOff,
      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
      title: "Leave Requests",
      description: "Paid leave you've asked for",
      count: pendingLeave,
      onClick: onLeaveClick,
    },
    {
      key: "wfh",
      icon: Home,
      tone: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
      title: "WFH Requests",
      description: "Work from home you've asked for",
      count: pendingWfh,
      onClick: onWfhClick,
    },
    {
      key: "checkout",
      icon: LogOut,
      tone: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
      title: "Check-out Requests",
      description: "Check-outs you've asked Finance to add",
      count: checkOutCount,
      onClick: onCheckoutClick,
    },
    {
      key: "removal",
      icon: Eraser,
      tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
      title: "Record Removal Requests",
      description: "Records you've asked Finance to remove",
      count: removalCount,
      onClick: onRemovalClick,
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center neu-overlay p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-slate-900">Requests</h3>
          <ActionButton variant="ghost" className="p-1" onClick={onClose} aria-label="Close">
            <X size={20} />
          </ActionButton>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-zinc-400">Your requests and their status.</p>
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const RowIcon = row.icon;
            return (
              <button
                key={row.key}
                type="button"
                onClick={row.onClick}
                className="group flex w-full items-center gap-3 rounded-xl border border-[var(--c-border-light)] bg-white px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:hover:border-indigo-700 dark:hover:bg-zinc-800/60"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${row.tone}`}>
                  <RowIcon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                      {row.title}
                    </span>
                    {row.count > 0 ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                        {row.count} pending
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-zinc-400">
                    {row.description}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-indigo-400 dark:text-zinc-600" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
