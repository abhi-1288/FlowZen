"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";
import {
  type ItTicket,
  type ItTicketStatus,
  IT_STATUS_LABELS,
  IT_STATUS_COLORS,
  IT_PRIORITY_LABELS,
  IT_PRIORITY_COLORS,
} from "./it-types";

const WORKFLOW_GUIDE: {
  status: ItTicketStatus;
  label: string;
  meaning: string;
  itActions: string[];
  requesterActions: string[];
}[] = [
  {
    status: "PENDING",
    label: IT_STATUS_LABELS.PENDING,
    meaning: "New ticket, awaiting triage by IT",
    itActions: ["Assign to team member"],
    requesterActions: ["Withdraw ticket"],
  },
  {
    status: "ASSIGNED",
    label: IT_STATUS_LABELS.ASSIGNED,
    meaning: "Given to an IT member, not yet started",
    itActions: ["Start work", "Resolve", "Request info", "Cancel"],
    requesterActions: ["Withdraw ticket"],
  },
  {
    status: "QUEUED",
    label: IT_STATUS_LABELS.QUEUED,
    meaning: "In the IT work queue",
    itActions: ["Start work", "Resolve", "Cancel"],
    requesterActions: ["Withdraw ticket"],
  },
  {
    status: "IN_PROGRESS",
    label: IT_STATUS_LABELS.IN_PROGRESS,
    meaning: "Actively being worked on",
    itActions: ["Request info", "Resolve", "Cancel"],
    requesterActions: ["Withdraw ticket"],
  },
  {
    status: "WAITING_FOR_USER",
    label: IT_STATUS_LABELS.WAITING_FOR_USER,
    meaning: "IT needs more information from you",
    itActions: [],
    requesterActions: ["Reply", "Withdraw ticket"],
  },
  {
    status: "AWAITING_CONFIRMATION",
    label: IT_STATUS_LABELS.AWAITING_CONFIRMATION,
    meaning: "Resolved — waiting for you to confirm",
    itActions: [],
    requesterActions: ["Confirm resolved", "Report not resolved"],
  },
  {
    status: "RESOLVED",
    label: IT_STATUS_LABELS.RESOLVED,
    meaning: "Issue resolved and confirmed",
    itActions: ["Reopen if needed"],
    requesterActions: [],
  },
  {
    status: "CANCELLED",
    label: IT_STATUS_LABELS.CANCELLED,
    meaning: "Ticket cancelled",
    itActions: [],
    requesterActions: [],
  },
];

const COLUMN_ORDER: ItTicketStatus[] = [
  "PENDING",
  "ASSIGNED",
  "QUEUED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "AWAITING_CONFIRMATION",
  "RESOLVED",
  "CANCELLED",
];

function WorkflowGuidePopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 w-[540px] max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-[#111]"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          Ticket Workflow Guide
        </h3>
        <button
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
          onClick={onClose}
          type="button"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2">
        {WORKFLOW_GUIDE.map((step) => (
          <div
            className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
            key={step.status}
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${IT_STATUS_COLORS[step.status]}`}
              >
                {step.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              {step.meaning}
            </p>
            {(step.itActions.length > 0 || step.requesterActions.length > 0) && (
              <div className="mt-2 grid grid-cols-2 gap-3 text-[11px]">
                {step.itActions.length > 0 && (
                  <div>
                    <p className="font-medium text-slate-500 dark:text-zinc-500">
                      IT can:
                    </p>
                    <ul className="mt-0.5 list-disc pl-3 text-slate-600 dark:text-zinc-400">
                      {step.itActions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {step.requesterActions.length > 0 && (
                  <div>
                    <p className="font-medium text-slate-500 dark:text-zinc-500">
                      Requester can:
                    </p>
                    <ul className="mt-0.5 list-disc pl-3 text-slate-600 dark:text-zinc-400">
                      {step.requesterActions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ItKanbanBoard({
  tickets,
  onSelectTicket,
}: {
  tickets: ItTicket[];
  onSelectTicket: (t: ItTicket) => void;
  canAssign: boolean;
}) {
  const [showGuide, setShowGuide] = useState(false);
  const grouped = useMemo(() => {
    const map: Record<ItTicketStatus, ItTicket[]> = {
      PENDING: [],
      ASSIGNED: [],
      QUEUED: [],
      IN_PROGRESS: [],
      WAITING_FOR_USER: [],
      AWAITING_CONFIRMATION: [],
      RESOLVED: [],
      CANCELLED: [],
    };
    for (const t of tickets) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tickets]);

  return (
    <div className="task-scrollbar flex flex-1 flex-col overflow-x-auto p-4 sm:p-6">
      <div className="relative mb-4 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} across {COLUMN_ORDER.length} stages
        </p>
        <div className="relative">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            onClick={() => setShowGuide((p) => !p)}
            type="button"
          >
            <Info size={13} />
            Workflow Guide
          </button>
          {showGuide && <WorkflowGuidePopover onClose={() => setShowGuide(false)} />}
        </div>
      </div>
      <div className="flex flex-1 gap-4">
        {COLUMN_ORDER.map((status) => {
        const col = grouped[status];
        return (
          <section
            key={status}
            className="flex max-h-full w-72 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-100/80 dark:border-zinc-800 dark:bg-[#000000]"
          >
            <header className="flex items-center justify-between gap-2 px-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {IT_STATUS_LABELS[status]}
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-zinc-700 dark:text-zinc-300">
                  {col.length}
                </span>
              </div>
            </header>

            <div className="task-scrollbar min-h-24 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
              {col.map((ticket) => (
                <button
                  key={ticket.id}
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-[#000000]"
                  onClick={() => onSelectTicket(ticket)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-slate-900 dark:text-zinc-100">
                      {ticket.title}
                    </h4>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500 dark:bg-zinc-700 dark:text-zinc-400">
                      {ticket.ticketNumber}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    {ticket.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${IT_PRIORITY_COLORS[ticket.priority]}`}
                    >
                      {IT_PRIORITY_LABELS[ticket.priority]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-zinc-700 dark:text-zinc-400">
                      {ticket.category.replace(/_/g, " ")}
                    </span>
                  </div>
                </button>
              ))}
              {col.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-700/70 dark:text-zinc-400">
                  No tickets
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}
