import { Types } from "mongoose";
import { ATSInterview } from "@/models/ATSInterview";

/**
 * FlowZen-hosted video rooms are capped per company per calendar month. The
 * cap protects the free-tier realtime signalling concurrency allowance, so it
 * only counts interviews that actually open a FlowZen room — Zoom, Google Meet
 * and in-person interviews never consume quota.
 */
export const FLOWZEN_MONTHLY_LIMIT = 50;

export function monthWindow(reference: Date = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export type FlowZenQuota = {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
  resetsAt: string;
};

function toCompanyId(company: unknown) {
  if (company instanceof Types.ObjectId) return company;
  if (typeof company === "string" && Types.ObjectId.isValid(company)) return new Types.ObjectId(company);
  return null;
}

export async function getFlowZenQuota(company: unknown, reference: Date = new Date()): Promise<FlowZenQuota> {
  const companyId = toCompanyId(company);
  if (!companyId) {
    return { used: 0, limit: FLOWZEN_MONTHLY_LIMIT, remaining: FLOWZEN_MONTHLY_LIMIT, exhausted: false, resetsAt: monthWindow(reference).end.toISOString() };
  }

  const { start, end } = monthWindow(reference);
  const used = await ATSInterview.countDocuments({
    company: companyId,
    videoProvider: "flowzen",
    createdAt: { $gte: start, $lt: end },
  });

  const remaining = Math.max(0, FLOWZEN_MONTHLY_LIMIT - used);
  return {
    used,
    limit: FLOWZEN_MONTHLY_LIMIT,
    remaining,
    exhausted: remaining <= 0,
    resetsAt: end.toISOString(),
  };
}

/**
 * Returns a rejection when the company has no FlowZen rooms left this month.
 * `additional` lets bulk scheduling check a whole batch up front.
 */
export async function assertFlowZenQuota(
  company: unknown,
  additional = 1,
  reference: Date = new Date()
): Promise<{ ok: true; quota: FlowZenQuota } | { ok: false; error: string; quota: FlowZenQuota }> {
  const quota = await getFlowZenQuota(company, reference);

  if (quota.remaining < additional) {
    const when = new Date(quota.resetsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
    return {
      ok: false,
      quota,
      error:
        quota.remaining <= 0
          ? `You have used all ${quota.limit} FlowZen video rooms for this month. Your allowance resets on ${when}. You can still schedule Zoom, Google Meet or in-person interviews.`
          : `Only ${quota.remaining} FlowZen video room${quota.remaining === 1 ? "" : "s"} remaining this month, but ${additional} were requested. Your allowance resets on ${when}. You can still schedule Zoom, Google Meet or in-person interviews.`,
    };
  }

  return { ok: true, quota };
}
