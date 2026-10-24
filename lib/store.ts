import { Types } from "mongoose";
import { Company } from "@/models/Company";
import { StoreItem } from "@/models/StoreItem";
import { StoreOrder } from "@/models/StoreOrder";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import {
  effectiveRegionApproverClause,
  effectiveRegionLabelOf,
  isUserInEffectiveRegion,
  type OfficeAddressLike,
} from "@/lib/company-regions";
import { dateInputValue } from "@/lib/date-utils";
import { STORE_APPROVER_ROLES, isStoreApproverRole } from "@/lib/store-constants";

type StoreCompanyLike = {
  addresses?: OfficeAddressLike[] | null;
  address?: string | null;
} | null;

export {
  STORE_MANAGE_ROLES,
  STORE_APPROVER_ROLES,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABELS,
  STORE_STATUS_LABELS,
  STORE_STATUS_COLORS,
  STORE_DELIVERY_STATUSES,
  STORE_DELIVERY_STATUS_LABELS,
  STORE_DELIVERY_STATUS_COLORS,
  STORE_SETTABLE_DELIVERY_STATUSES,
  STORE_FULFILLMENT_METHODS,
  STORE_FULFILLMENT_METHOD_LABELS,
  STORE_TAKEAWAY_STATUSES,
  STORE_TAKEAWAY_STATUS_LABELS,
  STORE_TAKEAWAY_STATUS_COLORS,
  deliveryStatusLabel,
  deliveryStatusColor,
  isSettableDeliveryStatus,
  isStoreDeliveryStatus,
  isStoreFulfillmentMethod,
  fulfillmentMethodLabel,
  takeAwayStatusLabel,
  takeAwayStatusColor,
  canTransitionStoreOrder,
  isStoreManager,
  isStoreApproverRole,
} from "@/lib/store-constants";
export type {
  StoreCategory,
  StoreOrderStatus,
  StoreFulfillmentMethod,
  StoreTakeAwayStatus,
} from "@/lib/store-constants";

function cleanTagPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 3);
}

/**
 * Company tag used in store order/invoice numbers. Taken from the requester's
 * unique identity code (the company segment, e.g. `TML-0007` → `tml`); when the
 * requester has no identity code it falls back to the company name trimmed to
 * three characters.
 */
export function storeOrderCompanyTag(input: {
  identityCode?: string | null;
  identityCodePrefix?: string | null;
  name?: string | null;
}): string {
  const identityCode = String(input.identityCode ?? "").trim();
  if (identityCode.includes("-")) {
    const prefix = cleanTagPart(identityCode.split("-").slice(0, -1).join(""));
    if (prefix) return prefix;
  }

  const configured = cleanTagPart(input.identityCodePrefix);
  if (configured) return configured;

  const fromName = cleanTagPart(input.name);
  return fromName || "stor";
}

/** `YYYYMMDD` in IST — the day the order number belongs to. */
export function storeOrderDateKey(reference: Date = new Date()): string {
  return dateInputValue(reference.toISOString()).replace(/-/g, "");
}

/**
 * New order numbers are `YYYYMMDD-TAG-NNN` and restart at 001 each day. The
 * requester's identity code supplies the tag (the company segment of
 * `companyIdentityCode`); without it the company name trimmed to three chars is
 * used.
 */
export async function nextStoreOrderNumber(
  companyId: Types.ObjectId | string,
  requester?: { companyIdentityCode?: string | null },
): Promise<string> {
  const company = (await Company.findById(companyId)
    .select("name identityCodePrefix")
    .lean()) as { name?: string; identityCodePrefix?: string | null } | null;
  const tag = storeOrderCompanyTag({
    identityCode: requester?.companyIdentityCode,
    identityCodePrefix: company?.identityCodePrefix,
    name: company?.name,
  });
  const dateKey = storeOrderDateKey();
  const prefix = `${dateKey}-${tag}-`;

  const todays = (await StoreOrder.find({
    company: companyId,
    orderNumber: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  })
    .select("orderNumber")
    .lean()) as Array<{ orderNumber?: string }>;

  let lastSerial = 0;
  for (const row of todays) {
    const value = String(row.orderNumber ?? "");
    if (!value.startsWith(prefix)) continue;
    const serial = Number(value.slice(prefix.length));
    if (Number.isFinite(serial) && serial > lastSerial) lastSerial = serial;
  }

  return `${prefix}${String(lastSerial + 1).padStart(3, "0")}`;
}

/**
 * Marks an order fulfilled and issues its invoice. Kept in one place so every
 * completion path (delivery, take-away) stamps the same fields.
 */
export function fulfilStoreOrder(
  order: {
    status: string;
    fulfilledBy?: unknown;
    fulfilledAt?: Date | null;
    invoiceIssuedBy?: unknown;
    invoiceIssuedAt?: Date | null;
  },
  user: { _id: unknown },
  now: Date = new Date(),
) {
  order.status = "fulfilled";
  order.fulfilledBy = user._id;
  order.fulfilledAt = now;
  order.invoiceIssuedBy = user._id;
  order.invoiceIssuedAt = now;
}

export function pushStoreActivity(
  order: { activity?: unknown[] },
  user: { _id: unknown; name?: string },
  action: string,
  detail = "",
) {
  if (!Array.isArray(order.activity)) order.activity = [];
  (order.activity as unknown[]).push({
    user: user._id,
    action,
    detail: detail || action,
  });
}

/** Effective region of the requester/actor for store scoping. */
export async function storeRegionOf(user: {
  company?: unknown;
  regionLabel?: string | null;
}): Promise<{ company: StoreCompanyLike; region: string }> {
  const companyId =
    typeof user.company === "object" && user.company
      ? (user.company as { _id?: unknown })._id
      : user.company;
  const company = (await Company.findById(companyId)
    .select("addresses address")
    .lean()) as StoreCompanyLike;
  return { company, region: effectiveRegionLabelOf(company, user) };
}

export type StoreApproverOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  teamOwner?: boolean;
};

export type StoreApproverPlan = {
  region: string;
  regionFallback: boolean;
  teamOwner: StoreApproverOption | null;
  teamOwnerBlockedReason: "" | "out-of-region" | "none";
  approvers: StoreApproverOption[];
};

/**
 * Builds the approver dropdown for the cart: the requester's team owner first
 * (region-checked, self excluded) plus every approved member holding an
 * approver role — senior security included — in the requester's region.
 * When the region holds no role-eligible approver the list falls back
 * company-wide and `regionFallback` tells the UI to say so; the same rule is
 * reapplied in `validateStoreApprover` so the picker and the validator can
 * never disagree.
 */
export async function resolveStoreApproverOptions(
  requester: {
    _id: unknown;
    company?: unknown;
    team?: unknown;
    activeTeams?: unknown;
    regionLabel?: string | null;
  },
): Promise<StoreApproverPlan> {
  const companyId =
    typeof requester.company === "object" && requester.company
      ? (requester.company as { _id?: unknown })._id
      : requester.company;
  const { company, region } = await storeRegionOf(requester);
  const requesterId = String(requester._id ?? "");

  // ── Team owner ──
  const teamIds: string[] = [];
  if (requester.team) teamIds.push(String(requester.team));
  if (Array.isArray(requester.activeTeams)) {
    for (const id of requester.activeTeams) {
      const value = String(id ?? "");
      if (value && !teamIds.includes(value)) teamIds.push(value);
    }
  }
  let teamOwner: StoreApproverOption | null = null;
  let teamOwnerBlockedReason: StoreApproverPlan["teamOwnerBlockedReason"] = "none";
  if (teamIds.length > 0) {
    const teams = await Team.find({ _id: { $in: teamIds }, company: companyId }).select(
      "manager",
    );
    const managerIds: string[] = [];
    for (const team of teams) {
      const id = String((team as { manager?: unknown }).manager ?? "");
      if (id && id !== requesterId && !managerIds.includes(id)) managerIds.push(id);
    }
    if (managerIds.length > 0) {
      const managers = await User.find({
        _id: { $in: managerIds },
        company: companyId,
        companyStatus: "approved",
      }).select("name email role regionLabel");
      const chosen = managers.find((m) =>
        isUserInEffectiveRegion(company, region, {
          _id: (m as { _id?: unknown })._id,
          regionLabel: (m as { regionLabel?: string }).regionLabel,
        }),
      );
      if (chosen) {
        teamOwner = {
          id: String((chosen as { _id?: unknown })._id),
          name: String((chosen as { name?: string }).name ?? ""),
          email: String((chosen as { email?: string }).email ?? ""),
          role: String((chosen as { role?: string }).role ?? ""),
          teamOwner: true,
        };
      } else {
        teamOwnerBlockedReason = "out-of-region";
      }
    }
  }

  // ── Role-eligible approvers ──
  const base: Record<string, unknown> = {
    company: companyId,
    companyStatus: "approved",
    _id: { $ne: requesterId },
    $or: [
      { role: { $in: [...STORE_APPROVER_ROLES] } },
      { role: "security", isSeniorSecurity: true },
    ],
  };
  const clause = effectiveRegionApproverClause(company, region);
  let regionFallback = false;
  const filter = clause ? { ...base, ...clause } : base;
  let users = await User.find(filter)
    .select("name email role regionLabel isSeniorSecurity")
    .sort({ name: 1 });
  if (users.length === 0 && clause) {
    regionFallback = true;
    users = await User.find(base).select("name email role regionLabel isSeniorSecurity").sort({ name: 1 });
  }

  const approvers: StoreApproverOption[] = [];
  const seen = new Set<string>();
  if (teamOwner && !seen.has(teamOwner.id)) {
    seen.add(teamOwner.id);
    approvers.push(teamOwner);
  }
  for (const u of users) {
    const id = String((u as { _id?: unknown })._id);
    if (seen.has(id)) continue;
    seen.add(id);
    approvers.push({
      id,
      name: String((u as { name?: string }).name ?? ""),
      email: String((u as { email?: string }).email ?? ""),
      role: String((u as { role?: string }).role ?? ""),
    });
  }

  return { region, regionFallback, teamOwner, teamOwnerBlockedReason, approvers };
}

/**
 * Server-side twin of `resolveStoreApproverOptions`: a chosen approver is
 * valid when they are the requester's team owner or hold an approver role,
 * sit in the requester's region — unless the region has no role-eligible
 * approver at all, in which case company-wide candidates are accepted — and
 * are an approved member of the same company who is not the requester.
 */
export async function validateStoreApprover(
  requester: {
    _id: unknown;
    company?: unknown;
    team?: unknown;
    activeTeams?: unknown;
    regionLabel?: string | null;
  },
  approverId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!approverId || !Types.ObjectId.isValid(approverId)) {
    return { ok: false, error: "Pick an approver for this order." };
  }
  if (approverId === String(requester._id ?? "")) {
    return { ok: false, error: "You cannot approve your own order." };
  }

  const companyId =
    typeof requester.company === "object" && requester.company
      ? (requester.company as { _id?: unknown })._id
      : requester.company;

  const approver = (await User.findById(approverId).select(
    "name email role company companyStatus regionLabel isSeniorSecurity team activeTeams",
  )) as any;
  if (!approver) return { ok: false, error: "Approver not found." };
  if (String(approver.company ?? "") !== String(companyId ?? "")) {
    return { ok: false, error: "That approver is not in your company." };
  }
  if (String(approver.companyStatus) !== "approved") {
    return { ok: false, error: "That approver is not an approved member." };
  }

  const { company, region } = await storeRegionOf(requester);
  const inRegion = isUserInEffectiveRegion(company, region, {
    _id: (approver as { _id?: unknown })._id,
    regionLabel: (approver as { regionLabel?: string }).regionLabel,
  });

  const roleOk = isStoreApproverRole(approver.role) ||
    (String(approver.role) === "security" && Boolean((approver as any).isSeniorSecurity));

  if (roleOk) {
    if (inRegion) return { ok: true };
    // Region-empty fallback: no role-eligible approver in the region means the
    // company-wide list was offered, so accept any eligible member.
    const clause = effectiveRegionApproverClause(company, region);
    if (clause) {
      const count = await User.countDocuments({
        company: companyId,
        companyStatus: "approved",
        _id: { $ne: String(requester._id ?? "") },
        $or: [
          { role: { $in: [...STORE_APPROVER_ROLES] } },
          { role: "security", isSeniorSecurity: true },
        ],
        ...clause,
      });
      if (count === 0) return { ok: true };
    }
    return { ok: false, error: "That approver is outside your region." };
  }

  // Not role-eligible — only the team-owner path qualifies.
  const teamIds: string[] = [];
  if (requester.team) teamIds.push(String(requester.team));
  if (Array.isArray(requester.activeTeams)) {
    for (const id of requester.activeTeams) {
      const value = String(id ?? "");
      if (value && !teamIds.includes(value)) teamIds.push(value);
    }
  }
  if (teamIds.length === 0) {
    return { ok: false, error: "That user cannot approve this order." };
  }
  const teams = await Team.find({ _id: { $in: teamIds }, company: companyId }).select("manager");
  const isTeamOwner = teams.some(
    (t) => String((t as { manager?: unknown }).manager ?? "") === approverId,
  );
  if (!isTeamOwner) {
    return { ok: false, error: "That user cannot approve this order." };
  }
  if (!inRegion) {
    return { ok: false, error: "Your team owner is outside your region." };
  }
  return { ok: true };
}

/**
 * Restores held stock for every line of an order — used when a pending order
 * is rejected or cancelled after the hold was taken at creation time.
 */
export async function restoreStoreOrderStock(order: {
  items?: Array<{ item?: unknown; quantity?: number }>;
}): Promise<void> {
  for (const line of order.items ?? []) {
    const itemId = String(line.item ?? "");
    const qty = Math.floor(Number(line.quantity ?? 0));
    if (!itemId || !Types.ObjectId.isValid(itemId) || qty < 1) continue;
    await StoreItem.updateOne({ _id: itemId }, { $inc: { stock: qty } });
  }
}
