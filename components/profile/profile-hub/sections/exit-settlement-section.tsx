"use client";

import { useEffect, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";

type SettlementData = {
  enabled: boolean;
  hourDays: number;
  dayDays: number;
  monthDays: number;
  noticeRule?: Record<string, boolean>;
};

export function ExitSettlementSection({
  canEdit,
  showToast,
}: {
  canEdit: boolean;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [data, setData] = useState<SettlementData | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [hourDays, setHourDays] = useState(1);
  const [dayDays, setDayDays] = useState(2);
  const [monthDays, setMonthDays] = useState(10);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ settlement: SettlementData }>("/api/hr/policy")
      .then((res) => {
        if (!active) return;
        const s = res.settlement;
        setData(s);
        setEnabled(s.enabled !== false);
        setHourDays(s.hourDays ?? 1);
        setDayDays(s.dayDays ?? 2);
        setMonthDays(s.monthDays ?? 10);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({
          settlementEnabled: enabled,
          settlementHourDays: Math.max(0, Number(hourDays)),
          settlementDayDays: Math.max(0, Number(dayDays)),
          settlementMonthDays: Math.max(0, Number(monthDays)),
        }),
      });
      showToast("Exit & final settlement policy updated.", "success");
      setSaving(false);
      setLoading(false);
    } catch (err) {
      setSaving(false);
      setLoading(false);
      showToast(
        err instanceof Error ? err.message : "Unable to update settlement policy.",
        "error",
      );
    }
  }

  const noticeRule = data?.noticeRule ?? {};

  const noticeLabels: Record<string, string> = {
    "part-time": "Part-time",
    internship: "Internship",
    contract: "Contract",
    permanent: "Permanent",
    "full-time": "Full-time",
  };

  return (
    <section className="rounded-xl neu-card p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-rose-100 p-2.5">
            <LogOut size={18} className="text-rose-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Exit & Final Settlement
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Auto-generate a final settlement salary when a member&apos;s tenure ends.
            </p>
          </div>
        </div>
        {canEdit ? (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 ${
              enabled ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full neu-card ring-0 transition duration-200 ease-in-out mt-0.5 ${
                enabled ? "translate-x-4 ml-0.5" : "translate-x-0 ml-0.5"
              }`}
            />
          </button>
        ) : (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl neu-card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Hourly</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={30}
              disabled={!canEdit}
              className="w-20 rounded-lg neu-inset px-3 py-2 text-sm disabled:opacity-50"
              value={hourDays}
              onChange={(e) => setHourDays(Math.max(0, Number(e.target.value)))}
            />
            <span className="text-sm text-slate-600">day(s)</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Settlement gap for per-hour employees.
          </p>
        </div>

        <div className="rounded-xl neu-card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Daily</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={30}
              disabled={!canEdit}
              className="w-20 rounded-lg neu-inset px-3 py-2 text-sm disabled:opacity-50"
              value={dayDays}
              onChange={(e) => setDayDays(Math.max(0, Number(e.target.value)))}
            />
            <span className="text-sm text-slate-600">day(s)</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Settlement gap for per-day employees.
          </p>
        </div>

        <div className="rounded-xl neu-card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Monthly & above
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={90}
              disabled={!canEdit}
              className="w-20 rounded-lg neu-inset px-3 py-2 text-sm disabled:opacity-50"
              value={monthDays}
              onChange={(e) => setMonthDays(Math.max(0, Number(e.target.value)))}
            />
            <span className="text-sm text-slate-600">day(s)</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Settlement gap for per-month / per-annum employees.
          </p>
        </div>
      </div>

      {Object.keys(noticeRule).length > 0 ? (
        <div className="mt-4 rounded-lg bg-[var(--c-bg-muted)] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <ShieldCheck size={14} className="text-slate-500" />
            Notice rule
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Serves notice period (if serving notice, the safe-fallback gap is not
            relied on for monthly+ members):
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(noticeRule).map(([type, serves]) =>
              noticeLabels[type] ? (
                <span
                  key={type}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    serves
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {noticeLabels[type]}: {serves ? "serves notice" : "no notice"}
                </span>
              ) : null,
            )}
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-5 flex justify-end">
          <button
            className="neu-btn neu-btn-primary rounded-full px-5 py-2 text-sm font-medium"
            disabled={saving || loading}
            type="button"
            onClick={() => {
              setLoading(true);
              void save();
            }}
          >
            {saving ? "Saving..." : "Save settlement policy"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
