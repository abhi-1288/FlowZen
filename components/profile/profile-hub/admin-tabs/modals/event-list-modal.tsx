"use client";

import { X, Calendar } from "lucide-react";

type CalendarEvent = {
  date: Date;
  title: string;
  type: string;
};

const EVENT_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  holiday:  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-200", label: "Holiday" },
  birthday: { bg: "bg-pink-100",    text: "text-pink-700",    border: "border-pink-200",    label: "Birthday" },
  leave:    { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   label: "Leave" },
  payroll:  { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   label: "Payroll" },
  meeting:  { bg: "bg-[var(--color-primary-bg)]",    text: "text-[var(--color-primary-dark)]",    border: "border-[var(--color-primary-bg)]",    label: "Meeting" },
  interview:{ bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-200",  label: "Interview" },
  event:    { bg: "bg-indigo-100",  text: "text-indigo-700",  border: "border-indigo-200",  label: "Event" },
  deadline: { bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200",     label: "Deadline" },
};

export function EventListModal({
  type,
  events,
  onClose,
  onViewDay,
}: {
  type: string;
  events: CalendarEvent[];
  onClose: () => void;
  onViewDay: (date: Date) => void;
}) {
  const style = EVENT_STYLES[type] ?? EVENT_STYLES.event;

  const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className={`rounded-lg ${style.bg} p-1.5 ${style.text}`}>
              <Calendar size={16} />
            </span>
            {style.label}s this month
          </h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-500">No {style.label.toLowerCase()} events this month.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {sorted.map((event, idx) => (
              <button
                key={idx}
                onClick={() => onViewDay(event.date)}
                className={`w-full text-left rounded-xl border ${style.border} ${style.bg}/50 p-4 transition-all hover:shadow-md cursor-pointer`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <span className={`text-xs font-bold ${style.text} shrink-0 ml-2`}>
                    {event.date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
