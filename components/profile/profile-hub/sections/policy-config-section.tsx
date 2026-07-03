export function PolicyConfigSection({
  noticePeriodDays,
  onNoticePeriodChange,
  savingNoticePeriod,
  onSaveNoticePeriod,
  paidLeaveDays,
  onPaidLeaveDaysChange,
  paidLeavePeriod,
  onPaidLeavePeriodChange,
  savingPaidLeave,
  onSavePaidLeave,
  carryForwardLeaveDays,
  onCarryForwardLeaveChange,
  savingCarryForwardLeave,
  onSaveCarryForwardLeave,
  wfhDays,
  onWfhDaysChange,
  wfhPeriod,
  onWfhPeriodChange,
  wfhLoading,
  onSaveWfhQuota,
  carryForwardWfhDays,
  onCarryForwardWfhChange,
  savingCarryForwardWfh,
  onSaveCarryForwardWfh,
  minWorkHours,
  onMinWorkHoursChange,
  savingDayHour,
  onSaveDayHour,
}: {
  noticePeriodDays: number;
  onNoticePeriodChange: (value: number) => void;
  savingNoticePeriod: boolean;
  onSaveNoticePeriod: () => Promise<void>;
  paidLeaveDays: number;
  onPaidLeaveDaysChange: (value: number) => void;
  paidLeavePeriod: "monthly" | "yearly";
  onPaidLeavePeriodChange: (value: "monthly" | "yearly") => void;
  savingPaidLeave: boolean;
  onSavePaidLeave: () => Promise<void>;
  carryForwardLeaveDays: boolean;
  onCarryForwardLeaveChange: (value: boolean) => void;
  savingCarryForwardLeave: boolean;
  onSaveCarryForwardLeave: () => Promise<void>;
  wfhDays: number;
  onWfhDaysChange: (value: number) => void;
  wfhPeriod: "monthly" | "yearly";
  onWfhPeriodChange: (value: "monthly" | "yearly") => void;
  wfhLoading: boolean;
  onSaveWfhQuota: () => Promise<void>;
  carryForwardWfhDays: boolean;
  onCarryForwardWfhChange: (value: boolean) => void;
  savingCarryForwardWfh: boolean;
  onSaveCarryForwardWfh: () => Promise<void>;
  minWorkHours: number;
  onMinWorkHoursChange: (value: number) => void;
  savingDayHour: boolean;
  onSaveDayHour: () => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <div className="mb-5 border-l-4 border-emerald-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Policy</h3>
        <p className="mt-0.5 text-sm text-slate-500">Configure company-wide policies</p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="notice-period">Notice period</label>
        <span> current notice period:{noticePeriodDays}</span>
        <select
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          id="notice-period"
          value={noticePeriodDays}
          onChange={(e) => onNoticePeriodChange(Number(e.target.value))}
        >
          <option value={5}>5 days</option>
          <option value={15}>15 days</option>
          <option value={30}>30 days</option>
          <option value={45}>45 days</option>
          <option value={60}>2 months (60 days)</option>
          <option value={90}>3 months (90 days)</option>
        </select>
        <button
          className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={savingNoticePeriod}
          type="button"
          onClick={onSaveNoticePeriod}
        >
          {savingNoticePeriod ? "Saving..." : "Save policy"}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="paid-leave-days">Paid leave quota</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            id="paid-leave-days"
            min={0}
            max={365}
            type="number"
            value={paidLeaveDays}
            onChange={(e) => onPaidLeaveDaysChange(Math.max(0, Number(e.target.value)))}
          />
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={paidLeavePeriod}
            onChange={(e) => onPaidLeavePeriodChange(e.target.value === "yearly" ? "yearly" : "monthly")}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-slate-500">Approved paid leaves remain payable in finance salary calculation.</p>
        <button
          className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={savingPaidLeave}
          type="button"
          onClick={onSavePaidLeave}
        >
          {savingPaidLeave ? "Saving..." : "Save paid leave"}
        </button>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="text-sm text-slate-700">Carry forward unused leave to next period</span>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-medium ${carryForwardLeaveDays ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
              onClick={() => onCarryForwardLeaveChange(true)}
            >On</button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-medium ${!carryForwardLeaveDays ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
              onClick={() => onCarryForwardLeaveChange(false)}
            >Off</button>
          </div>
        </div>
        <button
          className="mt-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={savingCarryForwardLeave}
          type="button"
          onClick={onSaveCarryForwardLeave}
        >
          {savingCarryForwardLeave ? "Saving..." : "Save carry-forward"}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="text-xs font-semibold uppercase text-slate-500">WFH Quota</label>
        <p className="mt-1 mb-3 text-sm text-slate-500">Set the Work From Home allowance that members can request.</p>
        <div className="flex items-center gap-3">
          <input type="number" min="0" value={wfhDays} onChange={(e) => onWfhDaysChange(Math.max(0, Number(e.target.value)))} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <span className="text-sm text-slate-600">day(s) per</span>
          <select value={wfhPeriod} onChange={(e) => onWfhPeriodChange(e.target.value as "monthly" | "yearly")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="monthly">Month</option>
            <option value="yearly">Year</option>
          </select>
          <button onClick={onSaveWfhQuota} disabled={wfhLoading} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition" type="button">
            {wfhLoading ? "Saving..." : "Save"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="text-sm text-slate-700">Carry forward unused WFH to next period</span>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-medium ${carryForwardWfhDays ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
              onClick={() => onCarryForwardWfhChange(true)}
            >On</button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-medium ${!carryForwardWfhDays ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
              onClick={() => onCarryForwardWfhChange(false)}
            >Off</button>
          </div>
        </div>
        <button
          className="mt-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={savingCarryForwardWfh}
          type="button"
          onClick={onSaveCarryForwardWfh}
        >
          {savingCarryForwardWfh ? "Saving..." : "Save carry-forward"}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="text-xs font-semibold uppercase text-slate-500">Day-Hour Working</label>
        <p className="mt-1 mb-3 text-sm text-slate-500">Set the minimum working hours per day. Affects attendance status and salary calculation.</p>
        <div className="flex items-center gap-3">
          <input type="number" min="1" max="24" value={minWorkHours} onChange={(e) => onMinWorkHoursChange(Math.max(1, Math.min(24, Number(e.target.value))))} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <span className="text-sm text-slate-600">hours per day</span>
          <button onClick={onSaveDayHour} disabled={savingDayHour} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition" type="button">
            {savingDayHour ? "Saving..." : "Save"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Attendance rules: &lt; {Math.floor(minWorkHours / 2)} hrs = absent, &ge; {Math.floor(minWorkHours / 2)} hrs and &lt; {minWorkHours} hrs = half-day, &ge; {minWorkHours} hrs = present
        </p>
      </div>
    </section>
  );
}
