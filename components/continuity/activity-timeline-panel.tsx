"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Activity, CalendarDays, CheckCircle2, Clock3, LogIn, LogOut, MoreHorizontal, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { btnSecondary, Card, ErrorNote, formatDate } from "./common";

type AttendanceRecord = { id?: string; _id?: string; date?: string; checkIn?: string; checkOut?: string; status?: string };
type TimelineRow = { hour: string; label: string; detail: string; minutes: number };

function formatTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function localDateKey(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function boundedRange(record?: AttendanceRecord) {
  if (!record?.checkIn) return null;
  const anchor = record.date ? new Date(record.date) : new Date(record.checkIn);
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(anchor);
  dayEnd.setHours(23, 59, 59, 999);
  const rawStart = new Date(record.checkIn).getTime();
  const recordDate = new Date(record.date ?? record.checkIn);
  const now = new Date();
  const isToday = recordDate.toDateString() === now.toDateString();
  const rawEnd = record.checkOut ? new Date(record.checkOut).getTime() : isToday ? now.getTime() : new Date(record.checkIn).getTime();
  return { start: Math.max(rawStart, dayStart.getTime()), end: Math.min(rawEnd, dayEnd.getTime()) };
}

function durationMinutes(record?: AttendanceRecord) {
  const range = boundedRange(record);
  return range ? Math.max(0, Math.round((range.end - range.start) / 60000)) : 0;
}

function durationText(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function buildRows(record?: AttendanceRecord): TimelineRow[] {
  const range = boundedRange(record);
  if (!range) return [];
  const hasDuration = range.end > range.start;
  const isOpen = !record?.checkOut;
  return [{
    hour: formatTime(record?.checkIn),
    label: isOpen ? "Checked in" : "Active session",
    detail: `${formatTime(record?.checkIn)} – ${record?.checkOut ? formatTime(record.checkOut) : hasDuration ? "Now" : "Checkout not recorded"}`,
    minutes: hasDuration ? Math.round((range.end - range.start) / 60000) : 0,
  }];
}

export function ActivityTimelinePanel() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timelinePage, setTimelinePage] = useState(0);
  const pageSize = 15;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ history?: AttendanceRecord[] }>("/api/attendance/checkin", undefined, { toast: false });
      const next = result.history ?? [];
      setRecords(next);
      setSelectedId((current) => current || "today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your activity timeline.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const today = new Date();
  const todayRecord = records.find((record) => localDateKey(record.date) === localDateKey(today));
  const selected = selectedId === "today" ? todayRecord : records.find((record) => String(record.id ?? record._id) === selectedId);
  const activeMinutes = durationMinutes(selected);
  const productivity = Math.min(100, Math.round((activeMinutes / (8 * 60)) * 100));
  const rows = useMemo(() => buildRows(selected), [selected]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = rows.slice(timelinePage * pageSize, (timelinePage + 1) * pageSize);
  const dateLabel = (selected?.date ? new Date(selected.date) : today).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" });
  const employeeLabel = session?.user?.name || "Employee";
  const teamLabel = session?.user?.team ? ` - ${session.user.team}` : "";

  useEffect(() => { setTimelinePage(0); }, [selectedId]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3"><Activity size={22} className="text-teal-600" /><div><h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Activity Timeline</h2><p className="text-xs text-slate-500 dark:text-zinc-400">Employee: {employeeLabel}{teamLabel}</p></div></div>
          <div className="flex items-center gap-2"><select aria-label="Select attendance day" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="today">Today — {today.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</option>{records.map((record) => <option key={String(record.id ?? record._id)} value={String(record.id ?? record._id)}>{formatDate(record.date)}</option>)}</select><button className={btnSecondary} onClick={() => void load()} type="button"><RefreshCw size={13} /> Refresh</button></div>
        </div>
        <div className="grid gap-4 bg-slate-50/60 p-4 dark:bg-zinc-950/50 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0b0b0b]">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300"><CalendarDays size={15} /> {dateLabel}</div>
            {loading ? <div className="h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800" /> : rows.length ? <><div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">{pagedRows.map((row) => <div className="grid grid-cols-[74px_12px_minmax(0,1fr)] items-center gap-3" key={`${row.hour}-${row.detail}`}><span className="text-right text-xs font-medium text-slate-500 dark:text-zinc-400">{row.hour}</span><span className="relative flex h-full min-h-14 justify-center"><span className="absolute inset-y-0 w-px bg-slate-200 dark:bg-zinc-800" /><span className="relative mt-5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-950/50" /></span><div className="flex min-h-14 items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-500 text-white"><LogIn size={15} /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{row.label}</p><p className="text-[11px] opacity-80">{row.detail}</p></div><span className="text-xs font-bold">{row.minutes ? durationText(row.minutes) : "—"}</span><MoreHorizontal size={16} className="opacity-60" /></div></div>)}</div>{pageCount > 1 ? <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-zinc-800"><span className="text-slate-500">Showing {timelinePage * pageSize + 1}-{Math.min((timelinePage + 1) * pageSize, rows.length)} of {rows.length}</span><span className="flex gap-2"><button className={btnSecondary} disabled={timelinePage === 0} onClick={() => setTimelinePage((page) => Math.max(0, page - 1))} type="button">Previous</button><button className={btnSecondary} disabled={timelinePage >= pageCount - 1} onClick={() => setTimelinePage((page) => Math.min(pageCount - 1, page + 1))} type="button">Next</button></span></div> : null}</> : <div className="grid min-h-64 place-items-center text-center text-xs text-slate-500"><div><Clock3 className="mx-auto mb-2 text-slate-400" size={24} /><p>No attendance activity has been recorded for this day.</p></div></div>}
            {selected?.checkOut ? <div className="mt-3 grid grid-cols-[74px_12px_minmax(0,1fr)] items-center gap-3"><span className="text-right text-xs font-medium text-slate-500">{formatTime(selected.checkOut)}</span><span /><div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200"><LogOut size={15} /> Checked out</div></div> : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0b0b0b]"><h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{employeeLabel} - Day Summary</h3><div className="mt-4 space-y-3 text-xs"><SummaryRow label="Total active" value={durationText(activeMinutes)} /><SummaryRow label="Total idle" value="Not tracked" /><SummaryRow label="Total break" value="Not tracked" /></div><div className="mt-5 border-t border-slate-100 pt-4 dark:border-zinc-800"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Productivity score</span><span className="text-sm font-bold text-teal-600">{productivity}%</span></div><div className="mx-auto mt-4 grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#0f9f8a ${productivity}%, #dbe7e5 ${productivity}% 100%)` }}><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center dark:bg-zinc-900"><strong className="text-2xl text-slate-900 dark:text-zinc-100">{productivity}%</strong><span className="text-[10px] text-slate-500">8h target</span></div></div></div><p className="mt-4 flex items-center gap-1.5 text-[11px] text-teal-600"><CheckCircle2 size={13} /> Personal activity only</p></div>
        </div>
      </Card>
      <ErrorNote message={error} />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-slate-500 dark:text-zinc-400">{label}</span><span className="font-semibold text-slate-900 dark:text-zinc-100">{value}</span></div>;
}
