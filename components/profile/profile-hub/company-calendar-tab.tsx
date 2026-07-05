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
import type { AnyRecord } from "./shared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarEvent = {
  date: Date;
  title: string;
  type: "birthday" | "leave" | "meeting" | "payroll" | "holiday" | "interview" | "event" | "deadline";
};

export function CompanyCalendarTab() {
  const [today] = useState(() => new Date());
  const [currentMonth, setCurrentMonth] = useState(() => today.getMonth());
  const [currentYear, setCurrentYear] = useState(() => today.getFullYear());
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
              date: new Date(currentYear, bday.getMonth(), bday.getDate()),
              title: `Birthday: ${String(memberRes.name ?? "")}`,
              type: "birthday",
            });
          }
          for (const m of hrMembers) {
            if (m.dob) {
              const bday = new Date(String(m.dob));
              allEvents.push({
                date: new Date(currentYear, bday.getMonth(), bday.getDate()),
                title: `Birthday: ${String(m.name ?? "")}`,
                type: "birthday",
              });
            }
          }
        }

        allEvents.push({
          date: new Date(currentYear, currentMonth, 1),
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
  }, [currentYear, currentMonth]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  function getEventsForDay(day: number) {
    return events.filter((e) => {
      const d = e.date;
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }

  const eventTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
    holiday: { icon: Sun, label: "Holiday", color: "text-orange-600", bg: "bg-orange-100" },
    birthday: { icon: Cake, label: "Birthday", color: "text-pink-600", bg: "bg-pink-100" },
    leave: { icon: CalendarCheck, label: "Leave", color: "text-amber-600", bg: "bg-amber-100" },
    meeting: { icon: Video, label: "Meeting", color: "text-blue-600", bg: "bg-blue-100" },
    payroll: { icon: DollarSign, label: "Payroll", color: "text-green-600", bg: "bg-green-100" },
    interview: { icon: Briefcase, label: "Interview", color: "text-purple-600", bg: "bg-purple-100" },
    event: { icon: PartyPopper, label: "Event", color: "text-indigo-600", bg: "bg-indigo-100" },
    deadline: { icon: AlertTriangle, label: "Deadline", color: "text-red-600", bg: "bg-red-100" },
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const groupedEvents = events.filter((e) => {
    const d = e.date;
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = e.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Calendar size={18} className="text-indigo-600" />
          Company Calendar
        </h2>
        <p className="mb-4 text-xs text-slate-500">All departments can subscribe to this calendar.</p>

        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ChevronLeft size={16} />
          </button>
          <h3 className="text-sm font-bold text-slate-900">{MONTHS[currentMonth]} {currentYear}</h3>
          <button onClick={nextMonth} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px rounded-lg border border-slate-200 bg-slate-200">
          {DAYS.map((d) => (
            <div key={d} className="bg-slate-50 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-white px-2 py-3" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const isToday = `${currentYear}-${currentMonth}-${day}` === todayStr;
            return (
              <div
                key={day}
                className={`min-h-[72px] bg-white px-1.5 py-1.5 ${isToday ? "ring-2 ring-inset ring-indigo-400" : ""}`}
              >
                <p className={`mb-0.5 text-[11px] font-medium ${isToday ? "text-indigo-700" : "text-slate-700"}`}>{day}</p>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev, ei) => {
                    const cfg = eventTypeConfig[ev.type];
                    return (
                      <div
                        key={ei}
                        className={`truncate rounded px-1 py-[1px] text-[8px] font-medium ${cfg?.bg ?? "bg-slate-100"} ${cfg?.color ?? "text-slate-600"}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 ? (
                    <p className="text-[8px] font-medium text-slate-400 px-1">+{dayEvents.length - 3} more</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(eventTypeConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = (groupedEvents[key] ?? []).length;
          return (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg ${cfg.bg} p-2.5`}>
                  <Icon size={18} className={cfg.color} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 capitalize">{cfg.label}</p>
                  <p className="text-xs text-slate-500">{count} this month</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
        </div>
      ) : null}
    </div>
  );
}
