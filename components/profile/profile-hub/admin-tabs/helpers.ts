import type { AnyRecord } from "../shared";

export function requestIdOf(request: AnyRecord): string {
  const value = request.id ?? request._id;
  return value ? String(value) : "";
}

export function getDefaultSalaryAmount(request: AnyRecord): string {
  if (String(request.kind ?? "") !== "company") return "";
  const meta = (request.metadata ?? {}) as AnyRecord;
  const offeredCTC = Number(meta.offeredCTC ?? 0);
  return offeredCTC > 0 ? String(offeredCTC) : "";
}

export function getDefaultSalaryPeriod(request: AnyRecord): "monthly" | "yearly" {
  if (String(request.kind ?? "") !== "company") return "monthly";
  const meta = (request.metadata ?? {}) as AnyRecord;
  return String(meta.salaryType ?? "") === "per-annum" ? "yearly" : "monthly";
}

export function quitNoticeInfo(request: AnyRecord) {
  if (String(request.kind) === "quit-company-board-transfer") {
    return { noticeDays: 0, elapsedDays: 0, remainingDays: 0, canApprove: true };
  }
  if (!String(request.kind ?? "").startsWith("quit-")) return null;
  const noticeDays = Number((request.company as AnyRecord | undefined)?.noticePeriodDays ?? 0);
  if (!Number.isFinite(noticeDays) || noticeDays <= 0) {
    return { noticeDays: 0, elapsedDays: 0, remainingDays: 0, canApprove: true };
  }
  const createdAt = request.createdAt ? new Date(String(request.createdAt)) : new Date();
  const elapsedDays = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, noticeDays - elapsedDays);
  return { noticeDays, elapsedDays, remainingDays, canApprove: remainingDays === 0 };
}

export function currencySymbol(currency: string): string {
  const map: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
  return map[currency] ?? "₹";
}

export function formatSalaryWithCurrency(amount: number, currency: string): string {
  return `${currencySymbol(currency)} ${amount.toLocaleString("en-IN")}`;
}
