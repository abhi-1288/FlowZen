import type { AnyRecord } from "../shared";
import { WfhAssignModal } from "../wfh-assign-modal";
import { ManageWfhDatesModal } from "../manage-wfh-dates-modal";
import { ManageWeekendDatesModal } from "../manage-weekend-dates-modal";
import { WeekendModal } from "../modals/weekend-modal";
import type { WfhState } from "../modals/weekend-modal";
import { HolidayWeekendModal } from "../modals/holiday-weekend-modal";

export type WfhAdminState = WfhState & {
  showWfhAssignModal: boolean;
  setShowWfhAssignModal: (v: boolean) => void;
  showManageWfhModal: boolean;
  setShowManageWfhModal: (v: boolean) => void;
  wfhDates: { date: string; reason: string }[];
  setWfhDates: (v: { date: string; reason: string }[]) => void;
  loadWfh: () => Promise<void>;
  wfhMode: "all-day" | "wfh-only";
  setWfhMode: (v: "all-day" | "wfh-only") => void;
  updateWfhMode: (mode: "all-day" | "wfh-only") => Promise<void>;
  showManageWeekendModal: boolean;
  setShowManageWeekendModal: (v: boolean) => void;
  weekendDates: { date: string; reason?: string; kind?: string; region?: string }[];
  deleteWeekend: (date: string) => Promise<void>;
  updateWeekendCheckIn: () => Promise<void>;
  weekendCheckInEnabled: boolean;
  setWeekendCheckInEnabled: (v: boolean) => void;
  wfhLoading: boolean;
  assignHolidayWeekend: (
    startDate: string,
    endDate: string,
    reason: string,
  ) => Promise<void>;
};

export function WfhAdminSection({
  state,
  company,
  showToast,
}: {
  state: WfhAdminState;
  company: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const {
    showWfhAssignModal, setShowWfhAssignModal,
    showManageWfhModal, setShowManageWfhModal,
    wfhDates, setWfhDates, loadWfh,
    wfhMode, setWfhMode,
    updateWfhMode, wfhLoading,
    showManageWeekendModal, setShowManageWeekendModal,
    weekendDates, deleteWeekend, updateWeekendCheckIn,
    weekendCheckInEnabled, setWeekendCheckInEnabled,
    showHolidayWeekendModal, setShowHolidayWeekendModal,
    assignHolidayWeekend,
    ...weekendState
  } = state;

  return (
    <>
      <section className="rounded-xl neu-card p-5 dark:border-zinc-800 dark:bg-[#000000]">
        <div className="mb-5 border-l-4 border-sky-500 pl-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Work From Home Settings</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">Assign company-wide WFH dates and configure check-in behavior.</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg neu-inset p-4 dark:border-zinc-800 dark:bg-zinc-700">
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-400">Company WFH Dates</label>
            <p className="mt-1 mb-3 text-sm text-slate-500 dark:text-zinc-400">Assign or remove company-wide WFH days.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowWfhAssignModal(true)}
                className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-medium transition" type="button">
                Assign WFH Dates
              </button>
              <button onClick={() => { void loadWfh(); setShowManageWfhModal(true); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] transition dark:text-zinc-300 dark:hover:bg-zinc-700" type="button">
                Manage WFH Dates
                {wfhDates.length > 0 && <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-white">{wfhDates.length}</span>}
              </button>
            </div>
          </div>

          <div className="rounded-lg neu-inset p-4 sm:col-span-2 dark:border-zinc-800 dark:bg-zinc-700">
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-400">Manual Weekends</label>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">View and manage company weekend dates.</p>
            <div className="flex flex-wrap items-center gap-2">
              <WeekendModal
                state={{
                  ...weekendState,
                  weekendDates,
                  deleteWeekend,
                  wfhLoading,
                  showHolidayWeekendModal,
                  setShowHolidayWeekendModal,
                }}
                showToast={showToast}
              />
              <button
                onClick={() => { void loadWfh(); setShowManageWeekendModal(true); }}
                className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] transition dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                type="button"
              >
                Manage Weekend Dates
                {weekendDates.length > 0 && <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-white dark:bg-zinc-900">{weekendDates.length}</span>}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-400">Check-in behavior</label>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Choose when the check-in button should be enabled.</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <input id="mode-all" name="wfh-mode" type="radio" checked={wfhMode === "all-day"} onChange={() => setWfhMode("all-day")} />
                <label htmlFor="mode-all" className="text-sm">Enable check-in all days</label>
              </div>
              <div className="flex items-center gap-2">
                <input id="mode-wfh" name="wfh-mode" type="radio" checked={wfhMode === "wfh-only"} onChange={() => setWfhMode("wfh-only")} />
                <label htmlFor="mode-wfh" className="text-sm">Enable check-in only on WFH days</label>
              </div>
              <div className="mt-2">
                <button onClick={() => updateWfhMode(wfhMode)} disabled={wfhLoading}
                  className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-medium" type="button">
                  Save check-in policy
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showWfhAssignModal && (
        <WfhAssignModal onClose={() => setShowWfhAssignModal(false)}
          onRefresh={(dates) => { setWfhDates(dates); void loadWfh(); }} showToast={showToast} />
      )}
      {showManageWfhModal && (
        <ManageWfhDatesModal wfhDates={wfhDates} onClose={() => setShowManageWfhModal(false)}
          onRefresh={() => void loadWfh()} showToast={showToast} />
      )}
      {showManageWeekendModal && (
        <ManageWeekendDatesModal
          weekendDates={weekendDates}
          weekendCheckInEnabled={weekendCheckInEnabled}
          setWeekendCheckInEnabled={setWeekendCheckInEnabled}
          onSaveCheckIn={updateWeekendCheckIn}
          onDelete={deleteWeekend}
          loading={wfhLoading}
          onClose={() => setShowManageWeekendModal(false)}
        />
      )}
      {showHolidayWeekendModal && (
        <HolidayWeekendModal
          onClose={() => setShowHolidayWeekendModal(false)}
          onAssign={assignHolidayWeekend}
          loading={wfhLoading}
        />
      )}
    </>
  );
}
