import type { AnyRecord } from "../../shared";
import { Card, SectionHeader } from "../../shared";

export function SalarySlipSection({
  mySlips,
  slipsLoading,
  month,
}: {
  mySlips: AnyRecord[];
  slipsLoading: boolean;
  month: string;
}) {
  return (
    <Card>
      <SectionHeader
        title={<span className="flex items-center gap-2 text-base font-semibold text-slate-900">My Salary Slip</span>}
        description={month ? `Salary slip for ${new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` : "Select a month to view your salary slip"}
        accent="emerald"
      />
      <div className="mt-4">
        {slipsLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (() => {
          const slip = mySlips.find(
            (s) => String(s.month ?? "") === month && String(s.status ?? "") === "paid"
          );
          if (!slip) {
            return (
              <p className="text-sm text-slate-500">
                No salary slip available for this month yet.
              </p>
            );
          }
          const slipId = String(slip._id ?? slip.id ?? "");
          return (
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                </p>
                <p className="text-xs text-slate-500">
                  {slip.paidAt
                    ? `Paid on ${new Date(String(slip.paidAt)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                    : ""}
                </p>
              </div>
              <a
                href={`/salary-slip/${slipId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                View Slip
              </a>
            </div>
          );
        })()}
      </div>
    </Card>
  );
}
