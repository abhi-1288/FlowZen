import type { AnyRecord } from "../shared";
import { Row, SectionHeader } from "../shared";

function ordinal(n: number): string {
  if (n === 0) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

export function PolicyQuotasSection({
  company,
  policyInfo,
  salaryCycle,
  profile,
  session,
}: {
  company: AnyRecord | null;
  policyInfo: { foodAmount: number; travelAccommodationAmount: number; foodOptedOutMembers?: AnyRecord[]; travelOptedOutMembers?: AnyRecord[]; advanceSalaryEnabled?: boolean; pfPercentage?: number; esicPercentage?: number; tdsPercentage?: number } | null;
  salaryCycle: { salaryCycleDay: number; salaryCycleStartDay: number | null; salaryCycleEndDay: number | null } | null;
  profile: AnyRecord | null;
  session: { user?: { id?: string } } | null;
}) {
  const startDay = salaryCycle?.salaryCycleStartDay;
  const endDay = salaryCycle?.salaryCycleEndDay;
  const cycleDay = salaryCycle?.salaryCycleDay ?? 29;
  const displayStartDay = startDay ?? (cycleDay > 1 ? cycleDay : null);
  const displayEndDay = endDay ?? (cycleDay > 1 ? cycleDay - 1 : null);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Policy & Quotas" description="Benefits and entitlements" accent="amber" />
      <dl className="mt-4 space-y-3 text-sm">
        <Row
          label="Salary Cycle Period"
          value={displayStartDay && displayEndDay ? `${displayStartDay}${ordinal(displayStartDay)}\u2013${displayEndDay}${ordinal(displayEndDay)}` : undefined}
        />
        <Row
          label="Advance Salary"
          value={policyInfo ? (policyInfo.advanceSalaryEnabled ? "Enabled" : "Disabled") : undefined}
        />
        <Row
          label="Leave Carry-Forward"
          value={company?.carryForwardLeaveDays ? "Enabled" : "Disabled"}
        />
        <Row
          label="WFH Carry-Forward"
          value={company?.carryForwardWfhDays ? "Enabled" : "Disabled"}
        />
        <Row
          label="Food Accomodation"
          value={policyInfo ? policyInfo.foodOptedOutMembers?.some((m) => String(m._id || m.id || m) === String(profile?.id ?? profile?._id ?? session?.user?.id)) ? "₹0/mo" : `₹${policyInfo.foodAmount.toLocaleString("en-IN")}/mo` : undefined}
        />
        <Row
          label="Travel Accomodation"
          value={policyInfo ? policyInfo.travelOptedOutMembers?.some((m) => String(m._id || m.id || m) === String(profile?.id ?? profile?._id ?? session?.user?.id)) ? "₹0/mo" : `₹${policyInfo.travelAccommodationAmount.toLocaleString("en-IN")}/mo` : undefined}
        />
        <Row label="Notice Period" value={company?.noticePeriodDays ? `${Number(company.noticePeriodDays)} day${Number(company.noticePeriodDays) === 1 ? "" : "s"}` : undefined} />
        <Row label="Paid Leave" value={company ? `${Math.max(0, Number(company.paidLeaveDays ?? 0))} day${Number(company.paidLeaveDays ?? 0) === 1 ? "" : "s"} ${String(company.paidLeavePeriod ?? "monthly")}` : undefined} />
        <Row label="WFH" value={company ? `${Math.max(0, Number(company.wfhDays ?? 0))} day${Number(company.wfhDays ?? 0) === 1 ? "" : "s"} ${String(company.wfhPeriod ?? "monthly")}` : undefined} />
        <Row label="Work-Hours Policy" value={company ? `${Math.max(1, Number(company.minWorkHours ?? 8))} hrs / day` : "No minimum work hours"} />
        {policyInfo ? (
          <>
            <Row label="PF Deduction" value={`${policyInfo.pfPercentage ?? 12}%`} />
            <Row label="ESIC Deduction" value={`${policyInfo.esicPercentage ?? 0.75}%`} />
            <Row label="TDS Deduction" value={`${policyInfo.tdsPercentage ?? 0}%`} />
          </>
        ) : null}
      </dl>
    </section>
  );
}
