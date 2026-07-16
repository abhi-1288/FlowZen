import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord } from "../shared";

export function CalendarTab() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [history, setHistory] = useState<AnyRecord[]>([]);
  const [requests, setRequests] = useState<AnyRecord[]>([]);
  const [leavePolicy, setLeavePolicy] = useState<AnyRecord | null>(null);
  const [holidays, setHolidays] = useState<AnyRecord[]>([]);
  const [minWorkHours, setMinWorkHours] = useState(8);

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days: any[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  const numWeeks = Math.ceil(days.length / 7);

  const normalizeDate = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const getDateForDay = (day: number | null) => {
    if (!day) return null;
    return normalizeDate(new Date(year, month, day));
  };

  const todayDate = normalizeDate(new Date());

  const isToday = (day: number | null) => {
    if (!day) return false;
    return (
      day === todayDate.getDate() &&
      month === todayDate.getMonth() &&
      year === todayDate.getFullYear()
    );
  };

  const getAttendanceStatus = (day: number | null): 'present' | 'half-day' | 'absent' | null => {
    if (!day) return null;
    const date = getDateForDay(day);
    if (!date) return null;
    const entry = history.find((e: any) => {
      const entryDate = normalizeDate(new Date(e.date));
      return entryDate.getTime() === date.getTime();
    });
    if (!entry) return null;
    if (!entry.checkIn || !entry.checkOut) return 'present';
    const diff = new Date(String(entry.checkOut)).getTime() - new Date(String(entry.checkIn)).getTime();
    const hrs = diff / 3600000;
    const threshold = minWorkHours / 2;
    if (hrs < threshold) return 'absent';
    if (hrs < minWorkHours) return 'half-day';
    return 'present';
  };

  const isPastDay = (day: number | null) => {
    const date = getDateForDay(day);
    if (!date) return false;
    return date.getTime() < todayDate.getTime();
  };

  const isWeekend = (day: number | null) => {
    const date = getDateForDay(day);
    if (!date) return false;
    return date.getDay() === 0;
  };

  useEffect(() => {
    apiFetch<{ history: AnyRecord[] }>("/api/attendance/checkin").then((res) => {
      setHistory(res.history);
      setMinWorkHours((res as any).minWorkHours ?? 8);
    }).catch(() => {});
    apiFetch<{ requests: AnyRecord[] }>("/api/attendance/leave").then((res) => {
      setRequests(res.requests);
      setLeavePolicy((res as { leavePolicy?: AnyRecord | null }).leavePolicy ?? null);
    }).catch(() => {});
    apiFetch<{ holidays: AnyRecord[] }>("/api/attendance/holidays").then((res) => {
      setHolidays(res.holidays);
    }).catch(() => {});
  }, []);

  const isCheckedIn = (day: number | null) => {
    const status = getAttendanceStatus(day);
    return status === 'present' || status === 'half-day';
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="rounded-lg p-2 hover:bg-slate-100 transition"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-bold text-slate-900">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="rounded-lg p-2 hover:bg-slate-100 transition"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(7, 1fr)` }}
      >
        {["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."].map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 py-2"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: numWeeks * 7 }).map((_, idx) => {
          const day = days[idx];
          const isWeekendDay = isWeekend(day);
          const isPast = isPastDay(day);
          const status = getAttendanceStatus(day);
          const today = isToday(day);
          const checkedIn = isCheckedIn(day);
          return (
            <div
              key={idx}
              onClick={() => {
                if (day) {
                  setSelectedDate(getDateForDay(day));
                }
              }}
              className={`relative flex flex-col items-center justify-center rounded-xl p-1.5 text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                today
                  ? "bg-slate-900 text-white shadow-lg ring-2 ring-slate-900"
                  : checkedIn
                    ? "bg-emerald-50 text-emerald-700"
                    : isPast && !isWeekendDay && !status
                      ? "bg-rose-50 text-rose-500"
                      : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-[10px]">{day ?? ""}</span>
              {checkedIn && !today && (
                <CheckCircle2 size={12} className="absolute -top-0.5 -right-0.5 text-emerald-500" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
