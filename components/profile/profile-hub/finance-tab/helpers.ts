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

export { formatRole, formatRoleWithCustom, displayNested };
