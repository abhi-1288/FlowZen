import { ProjectBudget } from "@/models";
import type { CommandCenterContext } from "./context";

/**
 * Ready-to-spread Mongo filters for the models the command center reads.
 *
 * Every one of these is `{}` when no boundary applies, so a builder can spread
 * it into any filter unconditionally and a company with no region configured
 * keeps byte-for-byte the query it had before. When a boundary *does* apply the
 * filter narrows to the viewer's members, their boards, or their region.
 *
 * The point of this module is that the rules live in one place. The command
 * center touches ~25 models and it would be very easy for the finance variant
 * to scope salaries one way, expenses another, and invoices a third — the exact
 * drift `lib/region-scope.ts` exists to prevent between `/api/finance` and
 * `/api/procurement`.
 *
 * Three shapes of "belongs to this region" are needed:
 *   - the record names a member (`requester`, `employee`, `user`, `requester`)
 *     -> filter on the member id;
 *   - the record hangs off a board (`ProjectBudget`, `Task`, `ClientInvoice`)
 *     -> filter on the board id;
 *   - the record snapshots its region (`Holiday`, `ATSCandidate`, and the ATS
 *     job/offer snapshots) -> filter on the region label.
 */
export interface CommandCenterFilters {
  /** `{field: {$in: memberIds}}` while regional, `{}` otherwise. */
  byMember: (field: string) => Record<string, unknown>;
  /** `{_id: {$in: memberIds}}` while regional, `{}` otherwise. For `User` queries. */
  byUser: () => Record<string, unknown>;
  /**
   * Like `byMember` but against every member of the company rather than the
   * scoped subset. Needed for `Attendance`, which has no `company` column, so
   * "this company" can only be expressed as a set of user ids.
   */
  byVisibleMember: (field: string) => Record<string, unknown>;
  /** `{board: {$in: boardIds}}` while regional, `{}` otherwise. */
  byBoard: () => Record<string, unknown>;
  /** Invoices belong to a board, or failing that to whoever raised them. */
  invoice: () => Record<string, unknown>;
  /** Bills belong to a budget, which belongs to a board. Memoised. */
  bill: () => Promise<Record<string, unknown>>;
  /** A record carrying its own region label, e.g. `ATSCandidate.regionLabel`. */
  byRegionLabel: (field?: string) => Record<string, unknown>;
  /**
   * Global records plus this region's own — the convention `Holiday.region`
   * already uses, where `""` means "every region".
   */
  globalOrRegion: (field: string) => Record<string, unknown>;
}

export function buildFilters(ctx: CommandCenterContext): CommandCenterFilters {
  const { memberIds, visibleMemberIds, boardIds, region, isMainOffice } = ctx;

  // Resolved on first use: most variants never read bills, and the personal
  // variant cannot read them at all.
  let billPromise: Promise<Record<string, unknown>> | null = null;
  const bill = () => {
    if (!billPromise) billPromise = resolveBillFilter(ctx);
    return billPromise;
  };

  return {
    byMember: (field) => (memberIds ? { [field]: { $in: memberIds } } : {}),
    byUser: () => (memberIds ? { _id: { $in: memberIds } } : {}),
    byVisibleMember: (field) => ({ [field]: { $in: visibleMemberIds } }),
    byBoard: () => (boardIds ? { board: { $in: boardIds } } : {}),
    invoice: () => {
      if (!boardIds) return {};
      return {
        $or: [
          { board: { $in: boardIds } },
          // An invoice raised without a board is attributed to its creator.
          { board: null, generatedBy: { $in: visibleMemberIds } },
        ],
      };
    },
    bill,
    byRegionLabel: (field = "regionLabel") => {
      if (region === "") return {};
      if (isMainOffice) {
        return {
          $or: [
            { [field]: region },
            { [field]: { $in: ["", null] } },
            { [field]: { $exists: false } },
          ],
        };
      }
      return { [field]: region };
    },
    globalOrRegion: (field) => {
      if (region === "") return {};
      return { $or: [{ [field]: { $in: ["", null] } }, { [field]: region }] };
    },
  };
}

async function resolveBillFilter(ctx: CommandCenterContext): Promise<Record<string, unknown>> {
  const { companyId, boardIds } = ctx;
  if (!boardIds) return {};
  if (!companyId) return { budget: { $in: [] } };

  const budgets = await ProjectBudget.find({ company: companyId, board: { $in: boardIds } })
    .select("_id")
    .lean();
  return { budget: { $in: budgets.map((b) => b._id) } };
}
