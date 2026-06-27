import { X } from "lucide-react";
import { type ReactNode } from "react";

export type WfhState = {
  weekendDates: { date: string; reason?: string }[];
  showWeekendModal: boolean;
  setShowWeekendModal: (v: boolean) => void;
  weekendMonth: string;
  setWeekendMonth: (v: string) => void;
  weekendDays: { saturday: boolean; sunday: boolean };
  setWeekendDays: (v: { saturday: boolean; sunday: boolean }) => void;
  visibleWeekendDates: { date: string; reason?: string }[];
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
  excludeDefaultSunday: (dateStr: string) => Promise<void>;
  assignWeekendDate: (dateStr: string) => Promise<void>;
};

export function WeekendModal({
  state,
  showToast: _showToast,
}: {
  state: WfhState;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const {
    weekendDates, showWeekendModal, setShowWeekendModal,
    weekendMonth, setWeekendMonth,
    weekendDays, setWeekendDays,
    visibleWeekendDates, assignWeekends,
    wfhLoading,
    showDateConfirm, setShowDateConfirm,
    confirmDateStr, confirmDateIsWeekend, confirmDateDay,
    setConfirmDateDay, setConfirmDateIsWeekend, setConfirmDateStr,
    deleteWeekend, excludeDefaultSunday, assignWeekendDate,
  } = state;

  return (
    <>
      <button
        onClick={() => setShowWeekendModal(true)}
        className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
        type="button"
      >
        Manage Weekend
        {weekendDates.length > 0 && (
          <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs text-white">{weekendDates.length}</span>
        )}
      </button>

      {showWeekendModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowWeekendModal(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h4 className="text-xl font-semibold">Manage Weekends</h4>
                <p className="mt-0.5 text-sm text-slate-500">{weekendDates.length} weekend{weekendDates.length === 1 ? "" : "s"} assigned</p>
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" type="button" onClick={() => setShowWeekendModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <input className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" type="month" value={weekendMonth} onChange={(event) => setWeekendMonth(event.target.value)} />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={weekendDays.saturday} onChange={(event) => setWeekendDays({ ...weekendDays, saturday: event.target.checked })} />
                  Saturday
                </label>
                <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50" disabled={wfhLoading} type="button" onClick={() => void assignWeekends()}>Assign</button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-bold uppercase text-slate-500 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const [y, m] = weekendMonth.split("-");
                  const year = Number(y);
                  const month = Number(m) - 1;
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const firstDay = new Date(year, month, 1).getDay();
                  const hasManualWeekends = visibleWeekendDates.length > 0;
                  const cells: ReactNode[] = [];
                  for (let i = 0; i < firstDay; i++) { cells.push(<div key={`e${i}`} />); }
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${weekendMonth}-${String(day).padStart(2, "0")}`;
                    const wd = visibleWeekendDates.find((item) => String(item.date).startsWith(dateStr));
                    const isDefaultSunday = !hasManualWeekends && new Date(year, month, day).getDay() === 0;
                    const isWeekend = !!(wd || isDefaultSunday);
                    cells.push(
                      <div
                        key={day}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          const utcStr = `${weekendMonth}-${String(day).padStart(2, "0")}T00:00:00.000Z`;
                          setConfirmDateStr(utcStr);
                          setConfirmDateIsWeekend(isWeekend);
                          setConfirmDateDay(day);
                          setShowDateConfirm(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const utcStr = `${weekendMonth}-${String(day).padStart(2, "0")}T00:00:00.000Z`; setConfirmDateStr(utcStr); setConfirmDateIsWeekend(isWeekend); setConfirmDateDay(day); setShowDateConfirm(true); }
                        }}
                        className={`relative min-h-[80px] cursor-pointer rounded-lg border p-1.5 transition hover:shadow-sm ${isWeekend ? "border-indigo-200 bg-indigo-50" : "border-slate-100 bg-white hover:border-slate-300"}`}
                      >
                        <span className="text-xs font-semibold text-slate-600">{day}</span>
                        {isWeekend && <div className="mt-1 flex items-center justify-between gap-1 rounded-md bg-indigo-100 px-1.5 py-1 text-[11px] font-medium text-indigo-700"><span>Weekend</span></div>}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>

            {showDateConfirm && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
                onClick={(e) => { if (e.target === e.currentTarget) setShowDateConfirm(false); }}
              >
                <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                  <h4 className="text-lg font-semibold text-slate-900">{confirmDateIsWeekend ? "Remove weekend" : "Set as weekend"}</h4>
                  <p className="mt-2 text-sm text-slate-600">{confirmDateIsWeekend ? `Remove weekend for ${weekendMonth}-${String(confirmDateDay).padStart(2, "0")}?` : `Set ${weekendMonth}-${String(confirmDateDay).padStart(2, "0")} as a weekend?`}</p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="button" onClick={() => setShowDateConfirm(false)}>Cancel</button>
                    <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50" type="button" disabled={wfhLoading} onClick={() => {
                      setShowDateConfirm(false);
                      if (confirmDateIsWeekend) {
                        const wd = visibleWeekendDates.find((item) => String(item.date).startsWith(confirmDateStr.slice(0, 10)));
                        if (wd) { void deleteWeekend(wd.date); } else { void excludeDefaultSunday(confirmDateStr); }
                      } else { void assignWeekendDate(confirmDateStr); }
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
