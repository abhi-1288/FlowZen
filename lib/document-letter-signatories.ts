/**
 * Client-safe constants for document-letter co-approvers. Kept free of any
 * server/model imports so the request modal, approvals tab and letter view can
 * all share it — the resolution logic lives in `lib/document-letter-approvers.ts`.
 *
 * Co-approvers are always nominated by the requester. Nothing is ever added
 * automatically; the team owner is merely offered as a one-click suggestion.
 *
 * A nomination grants signing rights immediately, not on issuance: a
 * co-approver may sign or decline a letter that is still awaiting HR approval.
 */
export const SIGNATORY_SLOTS = ["team-owner", "secondary"] as const;
export type SignatorySlot = (typeof SIGNATORY_SLOTS)[number];

/** Hard ceiling on co-approvers per letter, enforced by both client and server. */
export const MAX_LETTER_CO_APPROVERS = 3;

export const SIGNATORY_SLOT_LABELS: Record<SignatorySlot, string> = {
  "team-owner": "Team Owner",
  secondary: "Co-approver",
};

export function signatorySlotLabel(slot: unknown): string {
  return SIGNATORY_SLOT_LABELS[slot as SignatorySlot] ?? SIGNATORY_SLOT_LABELS.secondary;
}

type SignatoryLike = { name?: unknown; status?: unknown };

/**
 * "Asha, Neha" for list rows. Deliberately names the people rather than the
 * slots: every co-approver is optional, so repeating the slot label ("Co-approver,
 * Co-approver") carries no information.
 */
export function pendingSignatureSummary(signatories: unknown): string {
  if (!Array.isArray(signatories)) return "";
  const waiting = (signatories as SignatoryLike[]).filter(
    (entry) => String(entry?.status ?? "pending") === "pending",
  );
  if (waiting.length === 0) return "";
  const names = waiting
    .map((entry) => String(entry?.name ?? "").trim())
    .filter((name) => name.length > 0);
  if (names.length === 0) {
    return `${waiting.length} awaiting signature${waiting.length === 1 ? "" : "s"}`;
  }
  return names.join(", ");
}

export interface SignatoryCompletion {
  total: number;
  pending: number;
  signed: number;
  declined: number;
  /**
   * True once every nominated signatory has responded. A decline counts as
   * responded: co-approvers are advisory, so a declined signature leaves the
   * issued letter perfectly valid and must not read as "still waiting".
   *
   * Requires at least one signatory, otherwise a letter that was never shared
   * would be vacuously "complete" and the requester would be notified about
   * nothing.
   */
  complete: boolean;
}

/**
 * Tally of a letter's signatures. Separate from `pendingSignatureSummary`, whose
 * "" means both "nothing pending" and "not a list", so it cannot express
 * completion. Status is normalised the same way, treating a missing status as
 * still pending, which is the schema default.
 */
export function signatoryCompletion(signatories: unknown): SignatoryCompletion {
  const list = Array.isArray(signatories) ? (signatories as SignatoryLike[]) : [];
  let pending = 0;
  let signed = 0;
  let declined = 0;
  for (const entry of list) {
    const status = String(entry?.status ?? "pending");
    if (status === "signed") signed += 1;
    else if (status === "declined") declined += 1;
    else pending += 1;
  }
  return {
    total: list.length,
    pending,
    signed,
    declined,
    complete: list.length > 0 && pending === 0,
  };
}
