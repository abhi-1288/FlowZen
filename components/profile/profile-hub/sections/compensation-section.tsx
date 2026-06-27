import type { AnyRecord } from "../shared";
import { Row, SectionHeader } from "../shared";

export function CompensationSection({
  inApprovedCompany,
  effectiveBaseSalary,
  insights,
  role,
  salaryRequesting,
  onRequestSalary,
}: {
  inApprovedCompany: boolean;
  effectiveBaseSalary: number;
  insights: AnyRecord | null;
  role: string;
  salaryRequesting: boolean;
  onRequestSalary: () => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Compensation" description="Salary details" accent="rose" />
      <dl className="mt-4 space-y-3 text-sm">
        {inApprovedCompany && effectiveBaseSalary > 0 ? (
          <>
            <Row label="Base Salary (Monthly)" value={`₹${effectiveBaseSalary.toLocaleString("en-IN")}`} />
            <Row label="Base Salary (Yearly)" value={`₹${(effectiveBaseSalary * 12).toLocaleString("en-IN")}`} />
          </>
        ) : null}
      </dl>
      {inApprovedCompany && !insights?.hasSalary ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-700">Salary not assigned yet?</p>
          <p className="mt-1 text-xs text-slate-500">
            {role === "human-resource" ? "Request admin to set up your salary record." : role === "admin" ? "Request another admin or HR to set up your salary record." : "Request the HR who enrolled you to set up your salary."}
          </p>
          <button
            className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={salaryRequesting || Boolean(insights?.pendingSalaryRequest)}
            onClick={onRequestSalary}
            type="button"
          >
            {insights?.pendingSalaryRequest ? "Salary request pending" : salaryRequesting ? "Requesting..." : role === "human-resource" ? "Request salary from admin" : role === "admin" ? "Request salary from admin/HR" : "Request salary from HR"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
