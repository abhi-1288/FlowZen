import type { Types } from "mongoose";
import { Company } from "@/models/Company";
import { ProcurementRequest } from "@/models/ProcurementRequest";
import { User } from "@/models/User";
import {
  effectiveRegionApproverClause,
  effectiveRegionLabelOf,
} from "@/lib/company-regions";
import { financeMemberScope, type FinanceMemberScope } from "@/lib/finance-scope";

/**
 * Server-authoritative source of truth for purchase-request routing.
 *
 * Every company purchase (laptop, desktop, software, electronics, internet,
 * email, office supplies) is raised from one form in `/profile/it`. Which desk
 * processes it is derived here from the requester's role — never from the
 * client — so a hand-crafted POST cannot route a request around the rules:
 *
 *   - `it-admin` / `it-administration` buy for the company themselves, so
 *     their purchases go straight to finance.
 *   - everyone else (project-manager, qa-tester, HR, admin, finance, employee,
 *     others, security) goes through IT first.
 *
 * Travel is deliberately not a purchase category — it is always a finance
 * request (see `app/api/finance/route.ts`).
 */

export const PROCUREMENT_CATEGORIES = [
  "laptop",
  "desktop",
  "software",
  "electronics",
  "internet-service",
  "email-service",
  "office-resources",
] as const;

export type ProcurementCategory = (typeof PROCUREMENT_CATEGORIES)[number];

/** Roles whose purchases are finance's to action directly. */
export const PROCUREMENT_FINANCE_ROLES = ["it-admin", "it-administration"] as const;

/** Roles that review the IT leg before finance sees the request. */
export const PROCUREMENT_IT_ROLES = ["it-admin", "it-administration"] as const;

export type ProcurementRoute = "it" | "finance";

export function isProcurementCategory(value: unknown): value is ProcurementCategory {
  return (PROCUREMENT_CATEGORIES as readonly string[]).includes(String(value));
}

export function isProcurementFinanceRole(role: unknown): boolean {
  return (PROCUREMENT_FINANCE_ROLES as readonly string[]).includes(String(role));
}

/**
 * The single routing decision. IT staff can never reach the IT leg, which is
 * what makes "it-admin requests go to finance only" enforceable rather than
 * merely a UI default.
 */
export function resolveProcurementRoute(requesterRole: unknown): ProcurementRoute {
  return isProcurementFinanceRole(requesterRole) ? "finance" : "it";
}

export const PROCUREMENT_CATEGORY_LABELS: Record<ProcurementCategory, string> = {
  laptop: "Laptop",
  desktop: "Desktop",
  software: "Software",
  electronics: "Electronic item",
  "internet-service": "Internet service",
  "email-service": "Email service",
  "office-resources": "Office resources",
};

export type ProcurementStatus =
  | "PENDING_IT"
  | "ASSIGNED_IT"
  | "IT_APPROVED"
  | "ACCEPTED_FIN"
  | "DISBURSED"
  | "REJECTED_IT"
  | "REJECTED_FIN"
  | "CANCELLED";

/** Open = still moving through IT review. Mirrors the IT ticket "Open" group. */
export const OPEN_PROCUREMENT_STATUSES: ProcurementStatus[] = [
  "PENDING_IT",
  "ASSIGNED_IT",
];

/** Awaiting = IT said yes, finance still has to accept and disburse. */
export const AWAITING_PROCUREMENT_STATUSES: ProcurementStatus[] = [
  "IT_APPROVED",
  "ACCEPTED_FIN",
];

/**
 * Allowed status transitions — enforced on the backend so neither the board's
 * drag-and-drop nor a direct PATCH can skip the IT→finance hand-off. Same
 * shape as `ALLOWED_TRANSITIONS` in `lib/it.ts`.
 */
const ALLOWED_TRANSITIONS: Record<ProcurementStatus, ProcurementStatus[]> = {
  PENDING_IT: ["ASSIGNED_IT", "IT_APPROVED", "REJECTED_IT", "CANCELLED"],
  ASSIGNED_IT: ["ASSIGNED_IT", "IT_APPROVED", "REJECTED_IT", "CANCELLED"],
  IT_APPROVED: ["ACCEPTED_FIN", "REJECTED_FIN"],
  ACCEPTED_FIN: ["DISBURSED", "REJECTED_FIN"],
  DISBURSED: [],
  REJECTED_IT: [],
  REJECTED_FIN: [],
  CANCELLED: [],
};

export function canTransitionProcurement(from: string, to: string): boolean {
  const fromKey = String(from).toUpperCase() as ProcurementStatus;
  const toKey = String(to).toUpperCase() as ProcurementStatus;
  if (fromKey === toKey) return true;
  return (ALLOWED_TRANSITIONS[fromKey] ?? []).includes(toKey);
}

/** Statuses in which the requester may still withdraw their own request. */
export function canCancelProcurement(status: string): boolean {
  const key = String(status).toUpperCase() as ProcurementStatus;
  return (ALLOWED_TRANSITIONS[key] ?? []).includes("CANCELLED");
}

// ---------------------------------------------------------------------------
// Regional boundary
// ---------------------------------------------------------------------------
//
// Reuses the finance scope verbatim (`financeMemberScope`), so purchase
// requests honour the same rules as salaries: the actor's own effective
// region, main-office fallback for unset `regionLabel`, company-wide when the
// company has no regions, and company-wide again when the region happens to
// hold no approved members. Scoping is applied to `requester` ids rather than
// the stored `regionLabel` snapshot so reassigning a member between regions
// moves their requests with them.

/** The region and member ids a request may be read/written against. */
export async function procurementScope(actor: {
  company: any;
  regionLabel?: string | null;
}): Promise<FinanceMemberScope> {
  return financeMemberScope(actor);
}

/** Query filter restricting a `User` lookup to the actor's region. */
export function procurementMemberUserFilter(
  scope: FinanceMemberScope,
): Record<string, unknown> {
  return scope.memberIds ? { _id: { $in: scope.memberIds } } : {};
}

/** Query filter restricting a `ProcurementRequest` lookup to the actor's region. */
export function procurementRequestFilter(
  scope: FinanceMemberScope,
): Record<string, unknown> {
  return scope.memberIds ? { requester: { $in: scope.memberIds } } : {};
}

/**
 * Validate a proposed assignee for the given route. Returns an error message
 * when the user is missing, not an approved company member, in the wrong role
 * for the route, or outside the actor's region.
 */
export async function validateProcurementAssignee(params: {
  actor: { company: any; regionLabel?: string | null };
  scope: FinanceMemberScope;
  userId: string;
  route: ProcurementRoute;
  label: string;
}): Promise<string | null> {
  const { actor, scope, route, label } = params;
  const userId = String(params.userId ?? "");
  if (!userId) return `Please assign a ${label} to handle this request.`;

  const roles: readonly string[] = route === "it" ? PROCUREMENT_IT_ROLES : ["finance"];

  // Prefer the requester's own region; fall back to company-wide only when that
  // region holds nobody, mirroring `regionIsEmpty` in the finance helpers.
  const inRegion = await User.findOne({
    _id: userId,
    company: actor.company,
    companyStatus: "approved",
    role: { $in: [...roles] },
    ...procurementMemberUserFilter(scope),
  })
    .select("_id")
    .lean();
  if (inRegion) return null;

  const exists = await User.findOne({
    _id: userId,
    company: actor.company,
    companyStatus: "approved",
    role: { $in: [...roles] },
  })
    .select("_id")
    .lean();
  if (!exists) {
    return scope.region
      ? `No ${label} is available in ${scope.region} or elsewhere in this company.`
      : `Selected ${label} not found in this company.`;
  }

  return `That ${label} is outside your region (${scope.region}). Pick one in your own region.`;
}

/**
 * Oldest approved finance user for the finance leg, preferring the requester's
 * region. `requesterRegionClause` is built from the stored snapshot so the
 * requester's own region is honoured even when the *actor* is elsewhere.
 */
export async function findFinanceUserForProcurement(
  companyId: Types.ObjectId | string,
  requesterRegionLabel: string | null | undefined,
  excludeUserId?: string,
): Promise<string | null> {
  const base: Record<string, unknown> = {
    company: companyId,
    role: "finance",
    companyStatus: "approved",
  };
  if (excludeUserId) base._id = { $ne: excludeUserId };

  const company = (await Company.findById(companyId)
    .select("addresses address")
    .lean()) as any;
  const region = effectiveRegionLabelOf(company, { regionLabel: requesterRegionLabel });
  const clause = effectiveRegionApproverClause(company, region);

  if (clause) {
    const inRegion = (await User.findOne({ ...base, ...clause })
      .select("_id")
      .sort({ createdAt: 1 })
      .lean()) as { _id?: unknown } | null;
    if (inRegion) return String(inRegion._id);
  }

  const anywhere = (await User.findOne(base)
    .select("_id")
    .sort({ createdAt: 1 })
    .lean()) as { _id?: unknown } | null;
  return anywhere ? String(anywhere._id) : null;
}

export async function nextProcurementNumber(
  companyId: Types.ObjectId | string,
): Promise<string> {
  const last = (await ProcurementRequest.findOne({ company: companyId })
    .sort({ createdAt: -1 })
    .select("requestNumber")
    .lean()) as { requestNumber?: string } | null;
  let lastNumber = 0;
  if (last?.requestNumber) {
    const match = String(last.requestNumber).match(/(\d+)$/);
    if (match) lastNumber = Number(match[1]);
  }
  const next = Math.max(lastNumber + 1, 1001);
  return `PR-${next}`;
}

export function pushProcurementActivity(
  req: any,
  user: { _id: unknown; name?: string },
  action: string,
  detail = "",
) {
  if (!Array.isArray(req.activity)) req.activity = [];
  req.activity.push({
    user: user._id,
    action,
    detail: detail || action,
  });
}

/** `1,234` / `1,234.50` — used in notifications and activity lines. */
export function formatAmount(amount: unknown, currency: unknown): string {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  const code = String(currency ?? "INR").trim().toUpperCase() || "INR";
  return `${safe.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${code}`;
}
