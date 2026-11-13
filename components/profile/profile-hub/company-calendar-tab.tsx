"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Cake,
  CalendarCheck,
  Video,
  DollarSign,
  Sun,
  Briefcase,
  PartyPopper,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton } from "./shared";
import type { AnyRecord } from "./shared";
import { DayEventsModal } from "./admin-tabs/modals/day-events-modal";
import { EventListModal } from "./admin-tabs/modals/event-list-modal";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."];

type CalendarEvent = {
  date: Date;
  title: string;
  type: "birthday" | "joining" | "anniversary" | "leaving" | "holiday" | "weekend" | "leave" | "wfh" | "meeting" | "payroll";
  region?: string;
};

const EVENT_PRIORITY: CalendarEvent["type"][] = ["holiday", "birthday", "leaving", "anniversary", "joining", "weekend", "wfh", "leave", "payroll", "meeting"];

const EVENT_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  holiday:  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-200", label: "Holiday" },
  birthday: { bg: "bg-pink-100",    text: "text-pink-700",    border: "border-pink-200",    label: "Birthday" },
  joining:  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", label: "Joining" },
  anniversary:{ bg: "bg-amber-100", text: "text-amber-700",   border: "border-amber-200",   label: "Anniversary" },
  leaving:  { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-200",    label: "Leaving" },
  weekend:  { bg: "bg-slate-100",   text: "text-slate-700",   border: "border-slate-200",   label: "Weekend" },
  wfh:      { bg: "bg-teal-100",    text: "text-teal-700",    border: "border-teal-200",    label: "WFH" },
  leave:    { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   label: "Leave" },
  payroll:  { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   label: "Payroll" },
  meeting:  { bg: "bg-[var(--color-primary-bg)]",    text: "text-[var(--color-primary-dark)]",    border: "border-[var(--color-primary-bg)]",    label: "Meeting" },
};

export function CompanyCalendarTab() {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => today.getMonth());
  const [year, setYear] = useState(() => today.getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await apiFetch<AnyRecord>(`/api/company/calendar?year=${year}&month=${month}`).catch(() => null);
        const list: AnyRecord[] = (res as any)?.events ?? [];
        const allEvents: CalendarEvent[] = list.map((e: AnyRecord) => ({
          date: new Date(String(e.date) + "T00:00:00"),
          title: String(e.title ?? ""),
          type: String(e.type ?? "event") as CalendarEvent["type"],
          region: String(e.region ?? "").trim(),
        }));
        setEvents(allEvents);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const days: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const numWeeks = Math.ceil(days.length / 7);

  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  function getEventsForDay(day: number) {
    return events.filter((e) => {
      const d = e.date;
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  }

  function getPrimaryEventType(day: number): string | null {
    const dayEvents = getEventsForDay(day);
    if (!dayEvents.length) return null;
    for (const t of EVENT_PRIORITY) {
      if (dayEvents.some((e) => e.type === t)) return t;
    }
    return dayEvents[0].type;
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const groupedEvents = events.filter((e) => {
    const d = e.date;
    return d.getMonth() === month && d.getFullYear() === year;
  }).reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = e.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl neu-card p-5 dark:border-zinc-800 dark:bg-[#000000]">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Calendar size={18} className="text-indigo-600" />
          Company Calendar
        </h2>
        <p className="mb-4 text-xs text-slate-500">All departments can subscribe to this calendar.</p>

        {/* -- Month Navigation -- */}
        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
            <ActionButton onClick={prevMonth} variant="secondary" className="h-10 w-12">
              <ChevronLeft size={20} />
            </ActionButton>
            <div className="flex items-center overflow-hidden rounded-xl border border-[var(--c-border-light)] shadow-sm dark:border-zinc-800">
              <div className="border-r border-[var(--c-border-light)] bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 dark:border-zinc-800 dark:bg-zinc-700 dark:text-zinc-300">
                {MONTHS[month]}
              </div>
              <div className="bg-white dark:bg-zinc-900 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-900 dark:bg-[#000000] dark:text-zinc-100">
                {year}
              </div>
            </div>
            <ActionButton onClick={nextMonth} variant="secondary" className="h-10 w-12">
              <ChevronRight size={20} />
            </ActionButton>
          </div>
        </div>

        {/* -- Calendar Grid -- */}
        <div className="rounded-2xl neu-inset/50 p-4 dark:border-zinc-800 dark:bg-[#000000]">
          <div className="grid grid-cols-7 gap-3">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className={`flex flex-col gap-3 rounded-2xl p-2 pb-6 transition-all ${ i === 0 ? "bg-rose-50/50 text-rose-600 border border-rose-100/50 dark:bg-rose-950/30 dark:border-rose-900/50" : "bg-emerald-50/50 text-emerald-600 border border-emerald-100/50 dark:bg-emerald-950/30 dark:border-emerald-900/50" }`}
              >
                <span className="text-center text-[10px] font-black uppercase tracking-tighter sm:text-xs">
                  {wd}
                </span>
                <div className="space-y-2">
                  {Array.from({ length: numWeeks }).map((_, rowIndex) => {
                    const dayIndex = rowIndex * 7 + i;
                    const day = days[dayIndex];
                    if (day === undefined) return null;

                    const isToday = day === todayDate && month === todayMonth && year === todayYear;
                    const primaryType = day ? getPrimaryEventType(day) : null;
                    const style = primaryType ? EVENT_STYLES[primaryType] : null;
                    const hasEvents = day ? getEventsForDay(day).length > 0 : false;

                    return (
                      <button
                        key={rowIndex}
                        disabled={!day}
                        onClick={() => {
                          if (day) {
                            setSelectedDate(new Date(year, month, day));
                          }
                        }}
                        className={`relative grid h-10 w-full place-items-center rounded-xl text-xs font-bold sm:h-14 sm:text-sm transition-all ${ day ? primaryType ? `${style?.bg} ${style?.text} ${style?.border} border shadow-sm` : isToday ? "bg-[var(--c-bg-slate-100 dark:bg-zinc-800)] text-rose-600 border border-rose-200 shadow-sm dark:bg-zinc-700 dark:border-rose-900" : "neu-card border border-[var(--c-border-light)] text-slate-700 hover:border-slate-300 dark:bg-zinc-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600" : "opacity-0" } ${isToday && !primaryType ? "ring-2 ring-inset ring-rose-300" : ""} ${day ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {day}
                        {day && hasEvents && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {getEventsForDay(day).slice(0, 2).map((_, ei) => (
                              <span key={ei} className={`h-1 w-1 rounded-full ${style?.bg ?? "bg-slate-300"}`} />
                            ))}
                            {getEventsForDay(day).length > 2 && (
                              <span className="text-[6px] font-bold text-slate-400 leading-none">+</span>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* -- Legend -- */}
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs font-semibold text-slate-600 bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] py-3 px-6 rounded-full w-fit mx-auto border border-[var(--c-border-light)] dark:bg-[#000000] dark:border-zinc-800 dark:text-zinc-300">
          {Object.entries(EVENT_STYLES).filter(([key]) => (groupedEvents[key] ?? []).length > 0).map(([key, s]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`h-3.5 w-3.5 rounded-full ${s.bg} border ${s.border}`}></span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* -- Summary Cards -- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(EVENT_STYLES).map(([key, s]) => {
          const count = (groupedEvents[key] ?? []).length;
          if (!count) return null;
          return (
            <button
              key={key}
              onClick={() => setSelectedType(key)}
              className="rounded-xl neu-card p-4 transition-all hover:border-slate-300 text-left w-full dark:border-zinc-800 dark:bg-[#000000] dark:hover:border-zinc-600"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg ${s.bg} p-2.5`}>
                  {key === "holiday"   && <Sun size={18} className={s.text} />}
                  {key === "birthday"  && <Cake size={18} className={s.text} />}
                  {key === "leave"     && <CalendarCheck size={18} className={s.text} />}
                  {key === "payroll"   && <DollarSign size={18} className={s.text} />}
                  {key === "meeting"   && <Video size={18} className={s.text} />}
                  {key === "interview" && <Briefcase size={18} className={s.text} />}
                  {key === "event"     && <PartyPopper size={18} className={s.text} />}
                  {key === "deadline"  && <AlertTriangle size={18} className={s.text} />}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 capitalize">{s.label}</p>
                  <p className="text-xs text-slate-500">{count} this month</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <DayEventsModal
          date={selectedDate}
          events={getEventsForDay(selectedDate.getDate())}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {selectedType && (
        <EventListModal
          type={selectedType}
          events={groupedEvents[selectedType] ?? []}
          onClose={() => setSelectedType(null)}
          onViewDay={(date) => {
            setSelectedType(null);
            setSelectedDate(date);
          }}
        />
      )}
    </div>
  );
}
