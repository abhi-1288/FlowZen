import { useState } from "react";
import { Calendar, Umbrella, Home, Clock, Hash } from "lucide-react";
import { PolicyModal } from "../modals/policy-modal";

type ModalKey = "notice" | "paid-leave" | "wfh" | "day-hour" | "identity";

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
  identityCodeDigits,
  onIdentityCodeDigitsChange,
  identityCodeStartRange,
  onIdentityCodeStartRangeChange,
  identityCodeEndRange,
  onIdentityCodeEndRangeChange,
  identityCodeNextNumber,
  onIdentityCodeNextNumberChange,
  identityCodeRemaining,
  identityCodeLoaded,
  savingIdentityCode,
  onSaveIdentityCode,
  bulkImportFile,
  onBulkImportFileChange,
  bulkPreview,
  onBulkPreviewClear,
  bulkImportLoading,
  bulkApplying,
  bulkResult,
  onPreviewBulkImport,
  onApplyBulkImport,
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
  identityCodeDigits: number | null;
  onIdentityCodeDigitsChange: (value: number | null) => void;
  identityCodeStartRange: number | null;
  onIdentityCodeStartRangeChange: (value: number | null) => void;
  identityCodeEndRange: number | null;
  onIdentityCodeEndRangeChange: (value: number | null) => void;
  identityCodeNextNumber: number | null;
  onIdentityCodeNextNumberChange: (value: number | null) => void;
  identityCodeRemaining: number | null;
  identityCodeLoaded: boolean;
  savingIdentityCode: boolean;
  onSaveIdentityCode: () => Promise<void>;
  bulkImportFile: File | null;
  onBulkImportFileChange: (file: File | null) => void;
  bulkPreview: {
    preview: {
      row: number;
      userName: string;
      email: string;
      flowzenCode: string;
      originalCode: string;
      status: "ready" | "not-found" | "conflict" | "duplicate-email" | "code-taken" | "invalid-code";
    }[];
    summary: { total: number; ready: number; errors: number };
  } | null;
  onBulkPreviewClear: () => void;
  bulkImportLoading: boolean;
  bulkApplying: boolean;
  bulkResult: { applied: number; errors: number } | null;
  onPreviewBulkImport: () => Promise<void>;
  onApplyBulkImport: () => Promise<void>;
}) {
  const [activeModal, setActiveModal] = useState<ModalKey | null>(null);

  const previewDigits = identityCodeDigits ?? 8;
  const previewStart = identityCodeStartRange ?? 10000000;
  const previewCode = `ACME-${String(previewStart).padStart(previewDigits, "0")}`;

  const cardBase = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-5 border-l-4 border-emerald-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Policy</h3>
        <p className="mt-0.5 text-sm text-slate-500">Configure company-wide policies</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Notice Period */}
        <div className={cardBase}>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <Calendar size={18} className="text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Notice Period</p>
              <p className="mt-0.5 text-xs text-slate-500">{noticePeriodDays} days</p>
            </div>
          </div>
          <button
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setActiveModal("notice")}
            type="button"
          >
            Edit
          </button>
        </div>

        {/* Paid Leave */}
        <div className={cardBase}>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 p-2.5">
              <Umbrella size={18} className="text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Paid Leave Quota</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {paidLeaveDays} day(s) per {paidLeavePeriod}
                {carryForwardLeaveDays ? " · Carry forward" : ""}
              </p>
            </div>
          </div>
          <button
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setActiveModal("paid-leave")}
            type="button"
          >
            Edit
          </button>
        </div>

        {/* WFH */}
        <div className={cardBase}>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-violet-100 p-2.5">
              <Home size={18} className="text-violet-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">WFH Quota</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {wfhDays} day(s) per {wfhPeriod}
                {carryForwardWfhDays ? " · Carry forward" : ""}
              </p>
            </div>
          </div>
          <button
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setActiveModal("wfh")}
            type="button"
          >
            Edit
          </button>
        </div>

        {/* Day-Hour */}
        <div className={cardBase}>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Day-Hour Working</p>
              <p className="mt-0.5 text-xs text-slate-500">{minWorkHours} hours/day min</p>
            </div>
          </div>
          <button
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setActiveModal("day-hour")}
            type="button"
          >
            Edit
          </button>
        </div>

        {/* Identity Code */}
        {identityCodeLoaded ? (
          <div className={`${cardBase} sm:col-span-2`}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-indigo-100 p-2.5">
                <Hash size={18} className="text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Identity Code Settings</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {identityCodeDigits != null
                    ? `${identityCodeDigits} digits · ${identityCodeStartRange ?? "?"} – ${identityCodeEndRange ?? "?"} · Next: ${identityCodeNextNumber ?? "?"}`
                    : "Random codes (legacy)"}
                  {identityCodeRemaining != null ? ` · ${identityCodeRemaining} remaining` : ""}
                </p>
              </div>
            </div>
            <button
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setActiveModal("identity")}
              type="button"
            >
              Edit
            </button>
          </div>
        ) : null}
      </div>

      {/* Notice Period Modal */}
      <PolicyModal
        open={activeModal === "notice"}
        title="Notice Period"
        description="Set the notice period employees must serve before leaving."
        onClose={() => setActiveModal(null)}
        onSave={onSaveNoticePeriod}
        saving={savingNoticePeriod}
      >
        <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="notice-period-modal">Current notice period</label>
        <select
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          id="notice-period-modal"
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
      </PolicyModal>

      {/* Paid Leave Modal */}
      <PolicyModal
        open={activeModal === "paid-leave"}
        title="Paid Leave Quota"
        description="Configure paid leave allowance. Approved paid leaves remain payable in finance salary calculation."
        onClose={() => setActiveModal(null)}
        onSave={onSavePaidLeave}
        saving={savingPaidLeave}
        saveLabel="Save paid leave"
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
            <option value="monthly">Per month</option>
            <option value="yearly">Per year</option>
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-700">Carry forward unused leave</span>
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

        {carryForwardLeaveDays ? (
          <button
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={savingCarryForwardLeave}
            type="button"
            onClick={onSaveCarryForwardLeave}
          >
            {savingCarryForwardLeave ? "Saving..." : "Save carry-forward setting"}
          </button>
        ) : null}
      </PolicyModal>

      {/* WFH Modal */}
      <PolicyModal
        open={activeModal === "wfh"}
        title="WFH Quota"
        description="Set the Work From Home allowance that members can request."
        onClose={() => setActiveModal(null)}
        onSave={onSaveWfhQuota}
        saving={wfhLoading}
      >
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            value={wfhDays}
            onChange={(e) => onWfhDaysChange(Math.max(0, Number(e.target.value)))}
            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-600">day(s) per</span>
          <select
            value={wfhPeriod}
            onChange={(e) => onWfhPeriodChange(e.target.value as "monthly" | "yearly")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="monthly">Month</option>
            <option value="yearly">Year</option>
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-700">Carry forward unused WFH</span>
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

        {carryForwardWfhDays ? (
          <button
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={savingCarryForwardWfh}
            type="button"
            onClick={onSaveCarryForwardWfh}
          >
            {savingCarryForwardWfh ? "Saving..." : "Save carry-forward setting"}
          </button>
        ) : null}
      </PolicyModal>

      {/* Day-Hour Modal */}
      <PolicyModal
        open={activeModal === "day-hour"}
        title="Day-Hour Working"
        description="Set the minimum working hours per day. Affects attendance status and salary calculation."
        onClose={() => setActiveModal(null)}
        onSave={onSaveDayHour}
        saving={savingDayHour}
      >
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="24"
            value={minWorkHours}
            onChange={(e) => onMinWorkHoursChange(Math.max(1, Math.min(24, Number(e.target.value))))}
            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-600">hours per day</span>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Attendance rules: &lt; {Math.floor(minWorkHours / 2)} hrs = absent, &ge; {Math.floor(minWorkHours / 2)} hrs and &lt; {minWorkHours} hrs = half-day, &ge; {minWorkHours} hrs = present
        </p>
      </PolicyModal>

      {/* Identity Code Modal */}
      <PolicyModal
        open={activeModal === "identity"}
        title="Identity Code Settings"
        description="Configure how employee identity codes are generated. Leave all fields empty to use random codes (legacy mode)."
        onClose={() => setActiveModal(null)}
        onSave={onSaveIdentityCode}
        saving={savingIdentityCode}
        saveLabel="Save identity code settings"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="id-digits">Number of digits</label>
            <input
              id="id-digits"
              type="number"
              min={4}
              max={12}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="e.g. 6"
              value={identityCodeDigits ?? ""}
              onChange={(e) => onIdentityCodeDigitsChange(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="id-start">Start range</label>
            <input
              id="id-start"
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="e.g. 400000"
              value={identityCodeStartRange ?? ""}
              onChange={(e) => onIdentityCodeStartRangeChange(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="id-end">End range</label>
            <input
              id="id-end"
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="e.g. 600000"
              value={identityCodeEndRange ?? ""}
              onChange={(e) => onIdentityCodeEndRangeChange(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="id-next">Next number</label>
            <input
              id="id-next"
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Auto-set from start"
              value={identityCodeNextNumber ?? ""}
              onChange={(e) => onIdentityCodeNextNumberChange(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Preview</p>
          <p className="mt-1 font-mono text-sm font-semibold text-indigo-700">{previewCode}</p>
        </div>

        {identityCodeRemaining != null ? (
          <p className="mt-2 text-xs text-slate-500">
            {identityCodeRemaining} codes remaining.
            {identityCodeRemaining <= 50 && identityCodeRemaining > 0 ? (
              <span className="ml-1 font-medium text-amber-600">Low range.</span>
            ) : null}
            {identityCodeRemaining === 0 ? (
              <span className="ml-1 font-medium text-red-600">Range exhausted.</span>
            ) : null}
          </p>
        ) : null}

        {/* Bulk Import */}
        <div className="mt-5 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Bulk Import</p>
          <p className="mt-1 mb-3 text-xs text-slate-500">
            Upload an Excel file with columns: User Name, Email, Flowzen Code, Original Code.
          </p>

          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-slate-800"
              onChange={(e) => {
                onBulkImportFileChange(e.target.files?.[0] ?? null);
                onBulkPreviewClear();
              }}
            />
            {bulkImportFile ? (
              <p className="mt-1.5 text-[11px] text-slate-500">Selected: {bulkImportFile.name}</p>
            ) : null}
          </div>

          {bulkImportFile && !bulkPreview && !bulkResult ? (
            <button
              className="mt-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              disabled={bulkImportLoading}
              type="button"
              onClick={onPreviewBulkImport}
            >
              {bulkImportLoading ? "Parsing..." : "Preview Import"}
            </button>
          ) : null}

          {bulkResult ? (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
              <p className="text-xs font-medium text-emerald-800">
                Done: {bulkResult.applied} updated, {bulkResult.errors} errors.
              </p>
            </div>
          ) : null}

          {bulkPreview ? (
            <div className="mt-2">
              <div className="mb-1.5 flex items-center gap-3">
                <span className="text-[11px] font-medium text-emerald-700">{bulkPreview.summary.ready} ready</span>
                {bulkPreview.summary.errors > 0 ? (
                  <span className="text-[11px] font-medium text-red-700">{bulkPreview.summary.errors} errors</span>
                ) : null}
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-2 py-1.5 font-medium text-slate-600">Row</th>
                      <th className="px-2 py-1.5 font-medium text-slate-600">Email</th>
                      <th className="px-2 py-1.5 font-medium text-slate-600">Current</th>
                      <th className="px-2 py-1.5 font-medium text-slate-600">New</th>
                      <th className="px-2 py-1.5 font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkPreview.preview.map((row) => (
                      <tr key={row.row} className={row.status === "ready" ? "bg-emerald-50/50" : row.status === "not-found" || row.status === "code-taken" ? "bg-red-50/50" : "bg-amber-50/50"}>
                        <td className="px-2 py-1 text-slate-500">{row.row}</td>
                        <td className="px-2 py-1 font-medium text-slate-800">{row.email}</td>
                        <td className="px-2 py-1 font-mono text-slate-600">{row.flowzenCode || "—"}</td>
                        <td className="px-2 py-1 font-mono text-indigo-700">{row.originalCode}</td>
                        <td className="px-2 py-1">
                          <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            row.status === "ready" ? "bg-emerald-100 text-emerald-700" :
                            row.status === "not-found" ? "bg-red-100 text-red-700" :
                            row.status === "code-taken" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {row.status === "ready" ? "Ready" :
                             row.status === "not-found" ? "Not Found" :
                             row.status === "conflict" ? "Mismatch" :
                             row.status === "duplicate-email" ? "Duplicate" :
                             row.status === "code-taken" ? "Taken" :
                             "Invalid"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 flex gap-2">
                {bulkPreview.summary.ready > 0 ? (
                  <button
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    disabled={bulkApplying}
                    type="button"
                    onClick={onApplyBulkImport}
                  >
                    {bulkApplying ? "Applying..." : `Apply ${bulkPreview.summary.ready}`}
                  </button>
                ) : null}
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={onBulkPreviewClear}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </PolicyModal>
    </section>
  );
}
