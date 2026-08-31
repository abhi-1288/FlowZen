import type { AnyRecord } from "../shared";
import { displayNested, formatRole, formatRoleWithCustom } from "../shared";

export function getSalaryRole(salary: AnyRecord, memberRoleMap: Map<string, string>): string {
  const empId = String((salary.employee as AnyRecord)?._id ?? (salary.employee as AnyRecord)?.id ?? "");
  return memberRoleMap.get(empId) || displayNested(salary.employee, "role", "employee");
}

export function toggleRoleInSet(prev: Set<string>, role: string): Set<string> {
  const next = new Set(prev);
  if (next.has(role)) next.delete(role);
  else next.add(role);
  return next;
}

export function isExpiredDeadline(deadline: Date | null): boolean {
  return deadline !== null && (Date.now() - deadline.getTime()) > 25 * 24 * 60 * 60 * 1000;
}

export function parseDeadline(budget: AnyRecord): Date | null {
  return budget.deadline ? new Date(String(budget.deadline)) : null;
}

export function pickMemberRole(members: AnyRecord[], memberId: string): string {
  const member = members.find((m) => String(m.id) === memberId);
  if (!member) return "-";
  return formatRoleWithCustom(String(member.role), member.customRole, Boolean((member as any).isSeniorSecurity));
}

export function getMemberName(members: AnyRecord[], memberId: string): string {
  const member = members.find((m) => String(m.id) === memberId);
  return member ? String(member.name) : "-";
}

export function getSalaryPeriodForMonth(
  month: string,
  cycle: {
    salaryCycleDay?: number;
    salaryCycleStartDay?: number | null;
    salaryCycleEndDay?: number | null;
  },
): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDayOfCurrent = new Date(y, m, 0).getDate();
  const prevMonthStr =
    m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const [py, pm] = prevMonthStr.split("-").map(Number);
  const lastDayOfPrev = new Date(py, pm, 0).getDate();

  if (cycle.salaryCycleStartDay && cycle.salaryCycleEndDay) {
    const s = Math.min(cycle.salaryCycleStartDay, lastDayOfPrev);
    const e = Math.min(cycle.salaryCycleEndDay, lastDayOfCurrent);
    return {
      start: `${prevMonthStr}-${String(s).padStart(2, "0")}`,
      end: `${month}-${String(e).padStart(2, "0")}`,
    };
  }

  const cycleDay = Math.min(cycle.salaryCycleDay ?? 29, lastDayOfCurrent);
  if (cycleDay === 1) {
    return {
      start: `${prevMonthStr}-01`,
      end: `${prevMonthStr}-${String(lastDayOfPrev).padStart(2, "0")}`,
    };
  }

  return {
    start: `${prevMonthStr}-${String(Math.min(cycleDay, lastDayOfPrev)).padStart(2, "0")}`,
    end: `${month}-${String(cycleDay - 1).padStart(2, "0")}`,
  };
}

export { formatRole, formatRoleWithCustom, displayNested };
