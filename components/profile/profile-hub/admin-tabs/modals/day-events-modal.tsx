"use client";

import { Calendar, Cake, CalendarCheck, Video, DollarSign, Sun, Briefcase, PartyPopper, AlertTriangle, X } from "lucide-react";

type DayEvent = {
  date: Date;
  title: string;
  type: "birthday" | "leave" | "meeting" | "payroll" | "holiday" | "interview" | "event" | "deadline";
};

const EVENT_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  holiday:  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-200", icon: <Sun size={16} /> },
  birthday: { bg: "bg-pink-100",    text: "text-pink-700",    border: "border-pink-200",    icon: <Cake size={16} /> },
  leave:    { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   icon: <CalendarCheck size={16} /> },
  payroll:  { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   icon: <DollarSign size={16} /> },
  meeting:  { bg: "bg-[var(--color-primary-bg)]",    text: "text-[var(--color-primary-dark)]",    border: "border-[var(--color-primary-bg)]",    icon: <Video size={16} /> },
  interview:{ bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-200",  icon: <Briefcase size={16} /> },
  event:    { bg: "bg-indigo-100",  text: "text-indigo-700",  border: "border-indigo-200",  icon: <PartyPopper size={16} /> },
  deadline: { bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200",     icon: <AlertTriangle size={16} /> },
};

export function DayEventsModal({
  date,
  events,
  onClose,
}: {
  date: Date;
  events: DayEvent[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600" />
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-500">No events on this day.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {events.map((event, idx) => {
              const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.event;
              return (
                <div key={idx} className={`rounded-xl border ${style.border} ${style.bg}/50 p-4`}>
                  <div className="flex items-center gap-2">
                    <span className={`${style.text}`}>{style.icon}</span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
                      {event.type === "holiday" ? "Holiday" :
                       event.type === "birthday" ? "Birthday" :
                       event.type === "leave" ? "Leave" :
                       event.type === "payroll" ? "Payroll" :
                       event.type === "meeting" ? "Meeting" :
                       event.type === "interview" ? "Interview" :
                       event.type === "event" ? "Event" :
                       event.type === "deadline" ? "Deadline" : "Event"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{event.title}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
