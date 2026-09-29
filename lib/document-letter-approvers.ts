import type { Types } from "mongoose";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { isUserInEffectiveRegion, effectiveRegionApproverClause, DOCUMENT_LETTER_APPROVER_ROLES, type OfficeAddressLike } from "@/lib/company-regions";
import {
  MAX_LETTER_CO_APPROVERS,
  type SignatorySlot,
} from "@/lib/document-letter-signatories";

export {
  SIGNATORY_SLOT_LABELS,
  MAX_LETTER_CO_APPROVERS,
  pendingSignatureSummary,
  signatorySlotLabel,
} from "@/lib/document-letter-signatories";

/**
 * Document letters have one required approver — HR — who is the sole gate: the
 * letter is issued the moment they approve. Everyone else in `signatories` is
 * advisory: they are notified afterwards and may add their signature, but their
 * silence (or a decline) never blocks or reverts issuance.
 *
 * Every co-approver is nominated by the requester. Nothing is ever added
 * automatically — the team owner is only ever offered as a one-click suggestion
 * via `GET /api/hr/document-letter?plan=1`.
 *
 * Every rule about who signs a document letter lives in this module so the
 * request endpoint, the approvals endpoint and the letter view cannot drift.
 */

/** Raised when a nominated co-approver sits outside the requester's region. */
export class RegionMismatchError extends Error {
  readonly region: string;
  readonly name_: string;
  constructor(region: string, nomineeName: string) {
    super(region
      ? `${nomineeName} is not in region ${region}`
      : `${nomineeName} is not in the requester's region`);
    this.name = "RegionMismatchError";
    this.region = region;
    this.name_ = nomineeName;
  }
}

export const DOCUMENT_LETTER_PRIMARY_ROLES = ["human-resource"] as const;

export interface SignatoryPlanEntry {
  user: string;
  slot: SignatorySlot;
  name: string;
  role: string;
}

export interface ApproverPlan {
  primaryId: string;
  signatories: SignatoryPlanEntry[];
}

type RegionCompanyLike = { addresses?: OfficeAddressLike[] | null; address?: string | null };

/** Why the team owner cannot be offered, "" when it can. */
export type TeamOwnerBlockedReason = "" | "out-of-region" | "none";

export interface TeamOwnerSuggestion {
  entry: SignatoryPlanEntry | null;
  blockedReason: TeamOwnerBlockedReason;
}

/**
 * The requester's team owner (Team.manager), used only to power the modal's
 * one-click "Add my team owner" suggestion. This is never added automatically.
 *
 * Unions `User.team` and `User.activeTeams` because the codebase populates them
 * inconsistently — `app/api/attendance/*` reads only `team`, while `lib/it.ts`
 * unions both. Returns nothing when the requester manages the team themselves,
 * since that would be a self-signature.
 *
 * Region-matching only, no cross-region fallback: an earlier version preferred a
 * same-region manager but fell back to any other, which meant the suggestion
 * could offer someone `resolveNomination` was guaranteed to reject. Callers get
 * `blockedReason` so the UI can explain the absence instead.
 */
export async function resolveTeamOwnerSignatory(options: {
  requester: { _id: unknown; team?: unknown; activeTeams?: unknown };
  companyId: Types.ObjectId | string;
  region: string;
  company: RegionCompanyLike | null;
}): Promise<TeamOwnerSuggestion> {
  const { requester, companyId, region, company } = options;

  const teamIds: string[] = [];
  if (requester.team) teamIds.push(String(requester.team));
  if (Array.isArray(requester.activeTeams)) {
    for (const id of requester.activeTeams) {
      const value = String(id ?? "");
      if (value && !teamIds.includes(value)) teamIds.push(value);
    }
  }
  if (teamIds.length === 0) return { entry: null, blockedReason: "none" };

  const teams = await Team.find({ _id: { $in: teamIds }, company: companyId }).select("manager");
  const managerIds: string[] = [];
  for (const team of teams) {
    const id = String((team as { manager?: unknown }).manager ?? "");
    if (id && !managerIds.includes(id)) managerIds.push(id);
  }
  // The requester managing their own team is not a useful second signature.
  const requesterId = String(requester._id ?? "");
  const externalManagerIds = managerIds.filter((id) => id !== requesterId);
  if (externalManagerIds.length === 0) return { entry: null, blockedReason: "none" };

  const managers = await User.find({
    _id: { $in: externalManagerIds },
    company: companyId,
    companyStatus: "approved",
  }).select("name role regionLabel");

  if (managers.length === 0) return { entry: null, blockedReason: "none" };

  // Only offer a manager the submit path will accept. `isUserInEffectiveRegion`
  // is the same predicate `resolveNomination` uses, so the two cannot disagree.
  const chosen = managers.find((m) =>
    isUserInEffectiveRegion(company, region, {
      _id: (m as { _id: unknown })._id,
      regionLabel: (m as { regionLabel?: string }).regionLabel,
    }),
  ) as { _id: unknown; name?: string; role?: string } | undefined;

  if (!chosen) return { entry: null, blockedReason: "out-of-region" };

  return {
    entry: {
      user: String(chosen._id),
      slot: "team-owner",
      name: String(chosen.name ?? ""),
      role: String(chosen.role ?? ""),
    },
    blockedReason: "",
  };
}

/**
 * The permanent required approver (HR), never the requester themselves.
 *
 * Resolution order:
 *   1. another HR in the requester's region
 *   2. an admin in the requester's region (e.g. the requester is the only HR there)
 *   3. any company HR
 *   4. any company admin
 */
export async function resolvePrimaryHrApprover(options: {
  companyId: Types.ObjectId | string;
  requesterId: string;
  regionClause: Record<string, unknown> | null;
}): Promise<string | null> {
  const { companyId, requesterId, regionClause } = options;

  const base = {
    company: companyId,
    companyStatus: "approved",
    _id: { $ne: requesterId },
  };

  const candidates: Record<string, unknown>[] = [];
  if (regionClause) {
    candidates.push({ ...base, role: "human-resource", ...regionClause });
    candidates.push({ ...base, role: "admin", ...regionClause });
  }
  candidates.push({ ...base, role: "human-resource" });
  candidates.push({ ...base, role: "admin" });

  for (const filter of candidates) {
    const found = await User.findOne(filter).select("_id").sort({ createdAt: 1 }).lean();
    if (found) return String((found as { _id: unknown })._id);
  }

  return null;
}

/**
 * Validate one nominated co-approver and turn it into a plan entry.
 *
 * Returns null for anyone who should simply be dropped (unknown user, wrong
 * company, not an approved member, an ineligible role, or a duplicate of an
 * already-nominated person). Throws `RegionMismatchError` when the nominee is
 * outside the requester's region *and* the region actually has eligible
 * approvers — without that second check nobody in a thin region could nominate
 * anyone at all.
 *
 * Region membership uses the *effective* rule, so a member with no stored
 * `regionLabel` counts as being in the main office. That matches what their
 * profile displays and what the requester's own region resolves to, and it is
 * the same rule the picker filters by (`effectiveRegionApproverClause`).
 *
 * The role gate applies to manually picked co-approvers only. The team-owner
 * slot is not role-gated, because a team manager is a legitimate co-signer even
 * when their own role is not an approver role; the team-owner id is instead
 * checked against `resolveTeamOwnerSignatory` in `buildApproverPlan`.
 */
async function resolveNomination(input: {
  userId: string;
  slot: SignatorySlot;
  companyId: Types.ObjectId | string;
  region: string;
  effectiveRegionClause: Record<string, unknown> | null;
  company: RegionCompanyLike | null;
}): Promise<SignatoryPlanEntry | null> {
  const { userId, slot, companyId, region, effectiveRegionClause, company } = input;

  const nominee = await User.findOne({
    _id: userId,
    company: companyId,
    companyStatus: "approved",
  }).select("name role regionLabel");
  if (!nominee) return null;

  const nomineeName = String((nominee as { name?: string }).name ?? "This person");
  const nomineeRole = String((nominee as { role?: string }).role ?? "");
  const isEligibleRole = (DOCUMENT_LETTER_APPROVER_ROLES as readonly string[]).includes(nomineeRole);
  if (slot !== "team-owner" && !isEligibleRole) return null;

  if (
    !isUserInEffectiveRegion(company, region, {
      _id: (nominee as { _id: unknown })._id,
      regionLabel: (nominee as { regionLabel?: string }).regionLabel,
    })
  ) {
    const regionHasCandidate = await User.exists({
      company: companyId,
      companyStatus: "approved",
      role: { $in: [...DOCUMENT_LETTER_APPROVER_ROLES] },
      ...(effectiveRegionClause ?? {}),
    });
    if (regionHasCandidate) {
      throw new RegionMismatchError(region, nomineeName);
    }
  }

  return {
    user: String((nominee as { _id: unknown })._id),
    slot,
    name: nomineeName,
    role: nomineeRole,
  };
}

/**
 * Build the full approver plan for a document letter.
 *
 * The primary is always HR. Co-approvers come only from what the requester
 * nominated: `teamOwnerId` (via the modal's one-click suggestion) first, then
 * `coApproverIds` in the order picked, so signature blocks print in that order.
 * The primary approver, the requester, duplicates and anyone past the cap of
 * `MAX_LETTER_CO_APPROVERS` are all dropped.
 */
export async function buildApproverPlan(options: {
  requester: { _id: unknown; team?: unknown; activeTeams?: unknown };
  companyId: Types.ObjectId | string;
  region: string;
  regionClause: Record<string, unknown> | null;
  company: RegionCompanyLike | null;
  coApproverIds?: string[];
  teamOwnerId?: string;
}): Promise<ApproverPlan> {
  const { requester, companyId, region, regionClause, company, coApproverIds, teamOwnerId } = options;
  const requesterId = String(requester._id ?? "");

  const primaryId = await resolvePrimaryHrApprover({
    companyId,
    requesterId,
    regionClause,
  });
  if (!primaryId) {
    return { primaryId: "", signatories: [] };
  }

  const nominations: Array<{ userId: string; slot: SignatorySlot }> = [];
  // The primary keeps the strict region rule; nominations use the effective one.
  const nominationClause = effectiveRegionApproverClause(company, region);
  const teamOwner = String(teamOwnerId ?? "").trim();
  if (teamOwner) {
    // Only the requester's real, region-valid team owner may be tagged as such,
    // so a forged id cannot borrow the "Team Owner" label. An out-of-region or
    // unknown id is dropped rather than erroring: the modal renders the
    // suggestion disabled in that case, so it cannot legitimately arrive.
    const { entry: actualTeamOwner } = await resolveTeamOwnerSignatory({
      requester,
      companyId,
      region,
      company,
    });
    if (actualTeamOwner && actualTeamOwner.user === teamOwner) {
      nominations.push({ userId: teamOwner, slot: "team-owner" });
    }
  }
  for (const raw of coApproverIds ?? []) {
    const id = String(raw ?? "").trim();
    if (id) nominations.push({ userId: id, slot: "secondary" });
  }

  const collected: SignatoryPlanEntry[] = [];
  const seen = new Set<string>([primaryId, requesterId]);

  for (const nomination of nominations) {
    if (collected.length >= MAX_LETTER_CO_APPROVERS) break;
    if (seen.has(nomination.userId)) continue;
    const entry = await resolveNomination({
      userId: nomination.userId,
      slot: nomination.slot,
      companyId,
      region,
      effectiveRegionClause: nominationClause,
      company,
    });
    if (!entry) continue;
    seen.add(entry.user);
    collected.push(entry);
  }

  return { primaryId, signatories: collected };
}
