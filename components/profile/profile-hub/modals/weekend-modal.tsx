import { X, CalendarPlus } from "lucide-react";
import { type ReactNode } from "react";
import {
  dateKey,
  weekendEntryForDate,
  weekendKeysForMonth,
  weekendLabel,
} from "@/lib/weekends";

export type WeekendDateLike = {
  date: string;
  reason?: string;
  kind?: string;
  region?: string;
};

export type WeekendExclusionLike = {
  date: string;
  reason?: string;
  region?: string;
};

export type WfhState = {
  weekendDates: WeekendDateLike[];
  weekendExclusions: WeekendExclusionLike[];
  showWeekendModal: boolean;
  setShowWeekendModal: (v: boolean) => void;
  weekendMonth: string;
  setWeekendMonth: (v: string) => void;
  weekendDays: { saturday: boolean; sunday: boolean };
  setWeekendDays: (v: { saturday: boolean; sunday: boolean }) => void;
  visibleWeekendDates: WeekendDateLike[];
  visibleWeekendExclusions: WeekendExclusionLike[];
  assignWeekends: () => Promise<void>;
  wfhLoading: boolean;
  showDateConfirm: boolean;
  setShowDateConfirm: (v: boolean) => void;
  confirmDateStr: string;
  confirmDateIsWeekend: boolean;
  confirmDateDay: number;
  setConfirmDateDay: (v: number) => void;
  setConfirmDateIsWeekend: (v: boolean) => void;
  setConfirmDateStr: (v: string) => void;
  deleteWeekend: (date: string) => Promise<void>;
  assignWeekendDate: (dateStr: string) => Promise<void>;
  showHolidayWeekendModal: boolean;
  setShowHolidayWeekendModal: (v: boolean) => void;
};

const pad = (value: number) => String(value).padStart(2, "0");

export function WeekendModal({
  state,
  showToast: _showToast,
}: {
  state: WfhState;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const {
    weekendDates, weekendExclusions, showWeekendModal, setShowWeekendModal,
    weekendMonth, setWeekendMonth,
    weekendDays, setWeekendDays,
    visibleWeekendDates, visibleWeekendExclusions, assignWeekends,
    wfhLoading,
    showDateConfirm, setShowDateConfirm,
    confirmDateStr, confirmDateIsWeekend, confirmDateDay,
    setConfirmDateDay, setConfirmDateIsWeekend, setConfirmDateStr,
    deleteWeekend, assignWeekendDate,
    setShowHolidayWeekendModal,
  } = state;

  const [yearText, monthText] = weekendMonth.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const weekendKeys = weekendKeysForMonth(
    {
      weekendEntries: visibleWeekendDates,
      weekendExclusions: visibleWeekendExclusions,
    },
    year,
    monthIndex,
  );
  const extraWeekends = visibleWeekendDates.length;
  const removedWeekends = visibleWeekendExclusions.length;
  const confirmEntry = confirmDateStr
    ? weekendEntryForDate(confirmDateStr, {
        weekendEntries: visibleWeekendDates,
        weekendExclusions: visibleWeekendExclusions,
      })
    : null;

  return (
    <>
      <button
        onClick={() => setShowWeekendModal(true)}
        className="neu-btn neu-btn-primary mt-3 rounded-full px-4 py-2 text-sm font-medium transition"
        type="button"
      >
        Assign Weekend
        {weekendDates.length > 0 && (
          <span className="ml-1.5 rounded-full bg-white/20 dark:bg-zinc-900/20 px-1.5 py-0.5 text-xs text-white">{weekendDates.length}</span>
        )}
      </button>

      {showWeekendModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowWeekendModal(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl neu-card dark:border-zinc-800 dark:bg-[#000000]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--c-border-light)] px-6 py-4 dark:border-zinc-800/50">
              <div>
                <h4 className="text-xl font-semibold">Manage Weekends</h4>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
                  {weekendKeys.size} weekend day{weekendKeys.size === 1 ? "" : "s"} this month
                  {extraWeekends > 0 ? ` · ${extraWeekends} assigned` : ""}
                  {removedWeekends > 0 ? ` · ${removedWeekends} removed` : ""}
                </p>
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] dark:text-zinc-400 dark:hover:bg-zinc-700" type="button" onClick={() => setShowWeekendModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-[var(--c-border-light)] px-6 py-4 dark:border-zinc-800/50">
              <div className="flex flex-wrap items-center gap-3">
                <input className="rounded-lg neu-inset px-3 py-2 text-sm dark:border-zinc-800 dark:bg-[#000000]" type="month" value={weekendMonth} onChange={(event) => setWeekendMonth(event.target.value)} />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                  <input type="checkbox" checked={weekendDays.saturday} onChange={(event) => setWeekendDays({ ...weekendDays, saturday: event.target.checked })} />
                  Saturday
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                  <input type="checkbox" checked={weekendDays.sunday} onChange={(event) => setWeekendDays({ ...weekendDays, sunday: event.target.checked })} />
                  Sunday
                </label>
                <button className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-medium" disabled={wfhLoading} type="button" onClick={() => void assignWeekends()}>Assign</button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                  disabled={wfhLoading}
                  type="button"
                  onClick={() => setShowHolidayWeekendModal(true)}
                >
                  <CalendarPlus size={15} />
                  Assign holiday-weekend
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                Sundays are weekends by default. Tick a weekday to assign it for this month; click a day to make it a working day or restore it.
              </p>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-bold uppercase text-slate-500 py-1 dark:text-zinc-400">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                  const firstDay = new Date(year, monthIndex, 1).getDay();
                  const cells: ReactNode[] = [];
                  for (let i = 0; i < firstDay; i++) { cells.push(<div key={`e${i}`} />); }
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${weekendMonth}-${pad(day)}`;
                    const key = dateKey(dateStr);
                    const isWeekend = weekendKeys.has(key);
                    const entry = weekendEntryForDate(dateStr, {
                      weekendEntries: visibleWeekendDates,
                      weekendExclusions: visibleWeekendExclusions,
                    });
                    const isHoliday = String(entry?.kind ?? "") === "holiday";
                    cells.push(
                      <div
                        key={day}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setConfirmDateStr(dateStr);
                          setConfirmDateIsWeekend(isWeekend);
                          setConfirmDateDay(day);
                          setShowDateConfirm(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setConfirmDateStr(dateStr);
                            setConfirmDateIsWeekend(isWeekend);
                            setConfirmDateDay(day);
                            setShowDateConfirm(true);
                          }
                        }}
                        className={`relative min-h-[80px] cursor-pointer rounded-lg border p-1.5 transition hover:shadow-sm ${isWeekend ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950" : "border-[var(--c-border-light)] bg-[var(--c-bg-slate-100 dark:bg-zinc-800)] hover:border-slate-300 dark:border-zinc-800/50 dark:bg-[#000000]"}`}
                      >
                        <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">{day}</span>
                        {isWeekend && (
                          <div className="mt-1 flex items-center justify-between gap-1 rounded-md bg-indigo-100 px-1.5 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                            <span className="truncate" title={weekendLabel(entry)}>
                              {isHoliday ? "Holiday" : "Weekend"}
                            </span>
                          </div>
                        )}
                        {!isWeekend && visibleWeekendExclusions.some((item) => dateKey(item.date) === key) && (
                          <div className="mt-1 rounded-md bg-amber-50 px-1.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Working
                          </div>
                        )}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>

            {showDateConfirm && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center neu-overlay p-4"
                onClick={(e) => { if (e.target === e.currentTarget) setShowDateConfirm(false); }}
              >
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl dark:bg-[#000000]">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">{confirmDateIsWeekend ? "Remove weekend" : "Set as weekend"}</h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                    {confirmDateIsWeekend
                      ? `Make ${weekendMonth}-${pad(confirmDateDay)} a working day?`
                      : `Set ${weekendMonth}-${pad(confirmDateDay)} as a weekend?`}
                  </p>
                  {confirmEntry && (
                    <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">{weekendLabel(confirmEntry)}</p>
                  )}
                  <div className="mt-5 flex justify-end gap-3">
                    <button className="rounded-full border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700" type="button" onClick={() => setShowDateConfirm(false)}>Cancel</button>
                    <button className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-medium" type="button" disabled={wfhLoading} onClick={() => {
                      setShowDateConfirm(false);
                      if (confirmDateIsWeekend) {
                        void deleteWeekend(confirmDateStr);
                      } else {
                        void assignWeekendDate(confirmDateStr);
                      }
                    }}>
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
