import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-utils";

type MonthlyCheckItem = {
  key: string;
  label: string;
  value: number;
};

type MonthlyCheckResponse = {
  month: string;
  counts: { activeDays: number; present: number; leave: number; wfh: number; holidays: number; weekends: number; absent: number };
  items: MonthlyCheckItem[];
};

const monthlyCheckColors: Record<string, string> = {
  present: "bg-emerald-500",
  leave: "bg-amber-500",
  wfh: "bg-sky-500",
  holidays: "bg-fuchsia-500",
  weekends: "bg-slate-400",
  absent: "bg-rose-500",
};

export function MonthlyCheckBox({
  sectionClass,
  showToast,
}: {
  sectionClass: string;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<MonthlyCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const maxValue = useMemo(() => {
    const values = summary?.items.map((item) => item.value) ?? [];
    return Math.max(1, ...values);
  }, [summary]);

  useEffect(() => {
    let ignore = false;
    async function loadMonthlyCheck() {
      try {
        setLoading(true);
        const result = await apiFetch<MonthlyCheckResponse>(
          `/api/profile/monthly-check?month=${encodeURIComponent(month)}`,
        );
        if (!ignore) setSummary(result);
      } catch (err) {
        if (!ignore) {
          showToast(
            err instanceof Error ? err.message : "Unable to load monthly check.",
            "error",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void loadMonthlyCheck();
    return () => { ignore = true; };
  }, [month, showToast]);

  return (
    <section className={sectionClass}>
      <div className="mb-5 border-l-4 border-emerald-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Monthly Check</h3>
        <p className="mt-0.5 text-sm text-slate-500">Compare your attendance, leave, WFH, holidays, weekends, and absences.</p>
      </div>
      <input
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
      />
      <div className="mt-5 space-y-5">
        <div className="space-y-3">
          {(summary?.items ?? []).map((item) => {
            const width = `${Math.max(4, Math.round((item.value / maxValue) * 100))}%`;
            return (
              <div key={item.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="font-semibold text-slate-900">
                    {item.value} day{item.value === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${monthlyCheckColors[item.key] ?? "bg-slate-500"} transition-all`}
                    style={{ width }}
                  />
                </div>
              </div>
            );
          })}
          {!summary && !loading ? (
            <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              Select a month to view your attendance comparison.
            </p>
          ) : null}
          {loading ? (
            <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              Loading monthly check...
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Active days</p>
              <p className="mt-1 text-xs text-slate-500">Counted after your join date.</p>
            </div>
            <p className="text-3xl font-semibold text-slate-950">{summary?.counts.activeDays ?? 0}</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {summary?.items.map((item) => (
              <div className="rounded-md bg-white px-2 py-2" key={`stat-${item.key}`}>
                <p className="text-slate-500">{item.label}</p>
                <p className="font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
