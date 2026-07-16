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
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#000000]">
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
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#000000]">
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Salary not assigned yet?</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {role === "human-resource" ? "Request admin to set up your salary record." : role === "admin" ? "Request another admin or HR to set up your salary record." : "Request the HR who enrolled you to set up your salary."}
          </p>
          <button
            className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
