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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."];

type CalendarEvent = {
  date: Date;
  title: string;
  type: "birthday" | "leave" | "meeting" | "payroll" | "holiday" | "interview" | "event" | "deadline";
};

const EVENT_PRIORITY: CalendarEvent["type"][] = ["holiday", "birthday", "leave", "payroll", "meeting", "interview", "event", "deadline"];

const EVENT_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  holiday:  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-200", label: "Holiday" },
  birthday: { bg: "bg-pink-100",    text: "text-pink-700",    border: "border-pink-200",    label: "Birthday" },
  leave:    { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   label: "Leave" },
  payroll:  { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   label: "Payroll" },
  meeting:  { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-200",    label: "Meeting" },
  interview:{ bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-200",  label: "Interview" },
  event:    { bg: "bg-indigo-100",  text: "text-indigo-700",  border: "border-indigo-200",  label: "Event" },
  deadline: { bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200",     label: "Deadline" },
};

export function CompanyCalendarTab() {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => today.getMonth());
  const [year, setYear] = useState(() => today.getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const profileData = await apiFetch<AnyRecord>("/api/profile").catch(() => null);
        const holidaysRes = await apiFetch<AnyRecord>("/api/attendance/holidays").catch(() => null);
        const leaveRes = await apiFetch<AnyRecord>("/api/attendance/leave").catch(() => null);

        const memberRes = (profileData as any)?.user ?? null;
        const hrMembers: AnyRecord[] = (profileData as any)?.insights?.hr?.members ?? [];
        const allEvents: CalendarEvent[] = [];
        const holidayList: AnyRecord[] = (holidaysRes as any)?.holidays ?? [];
        const leaveList: AnyRecord[] = (leaveRes as any)?.requests ?? [];

        for (const h of holidayList) {
          const start = new Date(String(h.startDate));
          const end = new Date(String(h.endDate));
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            allEvents.push({ date: new Date(d), title: String(h.title ?? "Holiday"), type: "holiday" });
          }
        }

        for (const l of leaveList) {
          const startDate = new Date(String(l.startDate));
          const endDate = new Date(String(l.endDate ?? l.startDate));
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            allEvents.push({ date: new Date(d), title: `Leave: ${String(l.reason ?? "")}`, type: "leave" });
          }
        }

        if (memberRes) {
          if (memberRes.dob) {
            const bday = new Date(String(memberRes.dob));
            allEvents.push({
              date: new Date(year, bday.getMonth(), bday.getDate()),
              title: `Birthday: ${String(memberRes.name ?? "")}`,
              type: "birthday",
            });
          }
          for (const m of hrMembers) {
            if (m.dob) {
              const bday = new Date(String(m.dob));
              allEvents.push({
                date: new Date(year, bday.getMonth(), bday.getDate()),
                title: `Birthday: ${String(m.name ?? "")}`,
                type: "birthday",
              });
            }
          }
        }

        allEvents.push({
          date: new Date(year, month, 1),
          title: "Payroll Date",
          type: "payroll",
        });

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
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Calendar size={18} className="text-indigo-600" />
          Company Calendar
        </h2>
        <p className="mb-4 text-xs text-slate-500">All departments can subscribe to this calendar.</p>

        {/* ── Month Navigation ── */}
        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
            <ActionButton onClick={prevMonth} variant="secondary" className="h-10 w-12">
              <ChevronLeft size={20} />
            </ActionButton>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <div className="border-r border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600">
                {MONTHS[month]}
              </div>
              <div className="bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-900">
                {year}
              </div>
            </div>
            <ActionButton onClick={nextMonth} variant="secondary" className="h-10 w-12">
              <ChevronRight size={20} />
            </ActionButton>
          </div>
        </div>

        {/* ── Calendar Grid ── */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <div className="grid grid-cols-7 gap-3">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className={`flex flex-col gap-3 rounded-2xl p-2 pb-6 transition-all ${
                  i === 0
                    ? "bg-rose-50/50 text-rose-600 border border-rose-100/50"
                    : "bg-emerald-50/50 text-emerald-600 border border-emerald-100/50"
                }`}
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
                      <div
                        key={rowIndex}
                        className={`relative grid h-10 w-full place-items-center rounded-xl text-xs font-bold sm:h-14 sm:text-sm transition-all ${
                          day
                            ? primaryType
                              ? `${style?.bg} ${style?.text} ${style?.border} border shadow-sm`
                              : isToday
                                ? "bg-white text-rose-600 border border-rose-200 shadow-sm"
                                : "bg-white shadow-sm border border-slate-100 text-slate-700"
                            : "opacity-0"
                        } ${isToday && !primaryType ? "ring-2 ring-inset ring-rose-300" : ""}`}
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
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs font-semibold text-slate-600 bg-slate-50 py-3 px-6 rounded-full w-fit mx-auto border border-slate-200">
          {Object.entries(EVENT_STYLES).filter(([key]) => (groupedEvents[key] ?? []).length > 0).map(([key, s]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`h-3.5 w-3.5 rounded-full ${s.bg} border ${s.border}`}></span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(EVENT_STYLES).map(([key, s]) => {
          const count = (groupedEvents[key] ?? []).length;
          if (!count) return null;
          return (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
