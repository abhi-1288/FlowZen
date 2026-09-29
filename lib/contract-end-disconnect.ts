import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { Company } from "@/models/Company";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { FinanceSalary } from "@/models/FinanceSalary";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { recordIdentityCodeRelease } from "@/lib/company-identity";
import { generateFinalSettlement, getSettlementGapDays } from "@/app/api/finance/helpers";
import { effectiveRegionLabelOf, isUserInEffectiveRegion } from "@/lib/company-regions";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function findSettlementForEndDate(companyId: any, userId: any, endMonth: string) {
  return FinanceSalary.findOne({
    company: companyId,
    employee: userId,
    month: endMonth,
    kind: "settlement",
  }).select("_id status");
}

/** Roles that must be told when a member's employment period ends. */
const EXIT_NOTICE_ROLES = ["human-resource", "admin", "finance"] as const;

type ExitNoticeStage = "expired" | "disconnected";

function formatNoticeDate(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "start date not recorded";
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The HR/admin/finance members of `companyId` who can see this exit.
 *
 * Normally that is the member's own region. A region with nobody in those three
 * roles would otherwise make the exit invisible, so we widen to the whole
 * company rather than silently notifying nobody.
 */
async function exitNoticeRecipients(
  companyId: any,
  company: unknown,
  region: string,
  excludeUserId: unknown,
) {
  const candidates = await User.find({
    company: companyId,
    companyStatus: "approved",
    role: { $in: [...EXIT_NOTICE_ROLES] },
  })
    .select("_id name role regionLabel")
    .lean();

  const everyone = candidates.filter((u: any) => String(u._id) !== String(excludeUserId));
  if (region) {
    type CompanyArg = Parameters<typeof isUserInEffectiveRegion>[0];
    const inRegion = everyone.filter((u: any) =>
      isUserInEffectiveRegion(company as CompanyArg, region, u),
    );
    if (inRegion.length) return { recipients: inRegion, scopedToRegion: true };
  }
  return { recipients: everyone, scopedToRegion: false };
}

/**
 * Tell the member's regional HR/admin/finance that the employment period has
 * expired. Runs twice across a member's exit: once when the period itself ends
 * (while they are still a member, inside the settlement gap) and once when they
 * are actually disconnected.
 */
async function notifyExitNotices(options: {
  companyId: any;
  company: unknown;
  companyName: string;
  memberId: unknown;
  memberName: string;
  memberRole: string;
  memberRegion: string;
  employmentType: string;
  joined: Date | null;
  ended: Date;
  stage: ExitNoticeStage;
}): Promise<number> {
  const {
    companyId, company, companyName, memberId, memberName, memberRole,
    memberRegion, employmentType, joined, ended, stage,
  } = options;

  const { recipients } = await exitNoticeRecipients(companyId, company, memberRegion, memberId);
  if (!recipients.length) return 0;

  const roleLabel = memberRole.replace(/-/g, " ") || "unknown role";
  const title = stage === "expired" ? "Employment period expired" : "Member disconnected";
  const tail =
    stage === "expired"
      ? "They remain a member until the final settlement gap closes."
      : "They have been disconnected from the company.";
  const message = `${memberName} (${roleLabel}, ${memberRegion}) has completed their employment period at ${companyName}. Employment type: ${employmentType}. Period: ${formatNoticeDate(joined)} — ${formatNoticeDate(ended)}. ${tail}`;

  await Notification.create(
    recipients.map((r: any) => ({
      user: r._id,
      company: companyId,
      type: "system",
      title,
      message,
      body: message,
    })),
  );
  for (const r of recipients as any[]) {
    emitNotification(String(r._id));
  }
  return recipients.length;
}

async function cleanupBoardsForUser(userId: any) {
  const boards = await Board.find({ "members.user": userId });
  for (const board of boards) {
    const originalCount = board.members.length;
    board.members = (board.members as any[]).filter(
      (member) => String(member.user) !== String(userId),
    );
    if (board.members.length !== originalCount) {
      await board.save();
    }
  }
  await Board.updateMany(
    { "members.assignedTo": userId },
    { $set: { "members.$[m].assignedTo": null } },
    { arrayFilters: [{ "m.assignedTo": userId }] },
  );
}

export async function runContractEndDisconnect(): Promise<{ generated: string[]; warned: string[]; disconnected: string[] }> {
  await connectDb();

  const now = startOfDay(new Date());

  // `regionLabel` and `employmentType` are load-bearing for the exit notices
  // below, and `companyJoined` is the period start they quote.
  const members = await User.find({
    company: { $ne: null },
    companyStatus: "approved",
    employmentEndDate: { $ne: null, $lte: now },
  }).select(
    "name role company regionLabel employmentType companyJoined employmentEndDate durationMonths durationDays durationHours durationYears activeTeams team membershipHistory salaryType employmentExpiryNotifiedAt",
  );

  const generated: string[] = [];
  const warned: string[] = [];
  const disconnected: string[] = [];

  for (const member of members as any[]) {
    if (!member.employmentEndDate) continue;
    if (!member.company) continue;

    const endDate = new Date(member.employmentEndDate);
    const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
    const companyId = member.company;

    // `addresses` is needed to resolve regions, so load the company before the
    // phase split and reuse it for both notices.
    const company = await Company.findById(companyId).select("name owner addresses");

    // PHASE 2 nulls these out, so snapshot everything the notices need while it
    // is still populated.
    const memberName = String(member.name ?? "A member");
    const memberRole = String(member.role ?? "");
    const memberRegion = effectiveRegionLabelOf(company as Parameters<typeof effectiveRegionLabelOf>[0], member);
    const employmentType = String(member.employmentType ?? "").trim() || "Not set";
    const joined = member.companyJoined ? new Date(member.companyJoined) : null;
    const noticeBase = {
      companyId,
      company,
      companyName: String(company?.name ?? "the company"),
      memberId: member._id,
      memberName,
      memberRole,
      memberRegion: memberRegion || "Main office",
      employmentType,
      joined,
      ended: endDate,
    };

    // PHASE 0: the employment period itself has lapsed. Warn the member's
    // regional HR/admin/finance once, independently of the settlement policy —
    // the period is over even when settlements are switched off. Guarded by
    // `employmentExpiryNotifiedAt` because the cron re-runs daily for the whole
    // settlement gap.
    if (now >= startOfDay(endDate) && !member.employmentExpiryNotifiedAt) {
      const sent = await notifyExitNotices({ ...noticeBase, stage: "expired" });
      member.employmentExpiryNotifiedAt = new Date();
      await member.save();
      if (sent) warned.push(String(member._id));
    }

    const policy = await CompanyPolicy.findOne({ company: companyId });
    const settlementEnabled = policy?.settlementEnabled !== false;
    const gapDays = getSettlementGapDays(String(member.salaryType ?? "per-annum"), policy || {});

    const cutoff = addDays(endDate, gapDays);

    // PHASE 1: While inside the settlement gap, auto-generate the final
    // settlement salary (once) so admin can approve + finance can mark paid.
    if (settlementEnabled && now < cutoff) {
      const existingSettlement = await findSettlementForEndDate(companyId, member._id, endMonth);
      if (!existingSettlement) {
        const reason =
          String(member.salaryType ?? "") === "per-hour"
            ? "hourly-contract-expired"
            : String(member.salaryType ?? "") === "per-day"
              ? "daily-contract-expired"
              : "tenure-expired";
        const result = await generateFinalSettlement({
          company: companyId,
          userId: String(member._id),
          member,
          policy: policy || {},
          reason,
        });
        if (result.created) {
          generated.push(String(member._id));
        }
      }
      continue;
    }

    // PHASE 2: Settlement gap elapsed -> disconnect from the company.
    if (now < cutoff) continue;

    if (!member.membershipHistory) member.membershipHistory = [];

    // Managed teams (same rules as fire / quit-company approval).
    if (["project-manager", "qa-tester"].includes(String(member.role))) {
      const managedTeams = await Team.find({ manager: member._id }).select("_id");
      const managedTeamIds = managedTeams.map((t) => t._id);
      if (managedTeamIds.length) {
        await User.updateMany(
          { team: { $in: managedTeamIds } },
          { $set: { team: null, teamStatus: "none" }, $pull: { activeTeams: { $in: managedTeamIds } } },
        );
        await Team.deleteMany({ manager: member._id });
      }
    }

    await cleanupBoardsForUser(member._id);

    const allTeamIds = [
      ...(Array.isArray(member.activeTeams) ? member.activeTeams : []),
      ...(member.team ? [member.team] : []),
    ].filter(Boolean);
    if (allTeamIds.length) {
      await Team.updateMany({ _id: { $in: allTeamIds } }, { $pull: { employees: member._id } });
    }

    await JoinRequest.deleteMany({ requester: member._id, status: "pending" });

    member.membershipHistory.push({
      company: companyId,
      action: "contract-expired",
      at: new Date(),
    });

    member.team = null;
    member.activeTeams = [];
    member.teamJoined = null;
    member.teamStatus = "none";
    member.company = null;
    member.companyJoined = null;
    member.companyStatus = "none";
    member.baseSalary = 0;
    member.hourlyRate = 0;
    member.dailyRate = 0;
    const releasedCode = String(member.companyIdentityCode ?? "");
    member.companyIdentityCode = undefined;
    await recordIdentityCodeRelease(companyId, releasedCode, new Date());
    await member.save();

    await Company.updateOne({ _id: companyId }, { $pull: { members: member._id } });

    await Notification.create({
      user: member._id,
      company: companyId,
      type: "system",
      title: "Employment ended",
      message: `Your employment with ${String(company?.name ?? "the company")} has ended and you have been disconnected from the company.`,
      body: `Your employment with ${String(company?.name ?? "the company")} has ended and you have been disconnected from the company.`,
    });
    emitNotification(String(member._id));

    // Second notice: confirm the exit to the member's regional HR/admin/finance.
    // No idempotency marker needed — `company` is now null, so this member no
    // longer matches the query at the top of this function.
    await notifyExitNotices({ ...noticeBase, stage: "disconnected" });

    disconnected.push(String(member._id));
  }

  return { generated, warned, disconnected };
}