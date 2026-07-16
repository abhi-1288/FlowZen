import type { AnyRecord } from "../shared";
import { WfhAssignModal } from "../wfh-assign-modal";
import { ManageWfhDatesModal } from "../manage-wfh-dates-modal";
import { WeekendModal } from "../modals/weekend-modal";
import type { WfhState } from "../modals/weekend-modal";

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
  wfhLoading: boolean;
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
    ...weekendState
  } = state;

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#000000]">
        <div className="mb-5 border-l-4 border-sky-500 pl-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Work From Home Settings</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">Assign company-wide WFH dates and configure check-in behavior.</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-700">
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-400">Company WFH Dates</label>
            <p className="mt-1 mb-3 text-sm text-slate-500 dark:text-zinc-400">Assign or remove company-wide WFH days.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowWfhAssignModal(true)}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition" type="button">
                Assign WFH Dates
              </button>
              <button onClick={() => { void loadWfh(); setShowManageWfhModal(true); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition dark:text-zinc-300 dark:hover:bg-zinc-700" type="button">
                Manage WFH Dates
                {wfhDates.length > 0 && <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-white">{wfhDates.length}</span>}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2 dark:border-zinc-800 dark:bg-zinc-700">
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-400">Manual Weekends</label>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">View and manage company weekend dates.</p>
            <WeekendModal state={{ ...weekendState, wfhLoading }} showToast={showToast} />
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
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="button">
                  Save mode
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
    </>
  );
}
