import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company, Team, User } from "@/models";
import { regionLabelsOf, type OfficeAddressLike } from "@/lib/company-regions";
import { resolveMemberViewerScope } from "@/lib/member-viewer-scope";
import { resolveRegionPolicy } from "@/lib/region-scope";

/**
 * The members page's own data source, scoped by region.
 *
 * This is deliberately a separate route rather than a `?region=` on
 * `/api/profile`. `insights.hr.members` is read by five consumers — the members
 * tab, the HR dashboard's headcount and name lookups, the policy tab, the
 * profile tabs and the company-team section — so narrowing it there would
 * silently shrink four of them along with the one being asked about. The members
 * page is the only surface that wants a region switcher, so it gets its own
 * endpoint and leaves `/api/profile` alone.
 *
 * The switch rules come from `lib/member-viewer-scope.ts`, the same module the
 * command center uses, so a head cannot see 12 engineers on the dashboard and 9
 * here.
 */

/**
 * Roles allowed to open the members page at all.
 *
 * `security` is deliberately absent: the client gate admits only a *senior*
 * security officer, so listing the role outright here would let any junior
 * security user read the whole company roster by calling this endpoint
 * directly. The senior case is handled by the `isSeniorSecurity` check below.
 */
const ALLOWED_ROLES = new Set(["human-resource", "admin", "finance"]);

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role regionLabel companyStatus isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (String(actor.companyStatus) !== "approved") return jsonError("Company not approved.", 403);
  if (!actor.company) return jsonError("You are not part of a company yet.", 403);

  // Senior security reaches the members page but is not a `role` value of its
  // own, so it is checked separately rather than widened into ALLOWED_ROLES.
  const isSeniorSecurity = String(actor.role) === "security" && Boolean(actor.isSeniorSecurity);
  if (!ALLOWED_ROLES.has(String(actor.role)) && !isSeniorSecurity) {
    return jsonError("Forbidden.", 403);
  }

  const companyId = actor.company;
  const requestedRegion = new URL(request.url).searchParams.get("region");

  try {
    const company = (await Company.findById(companyId)
      .select("owner addresses address")
      .lean()) as {
      owner?: unknown;
      addresses?: OfficeAddressLike[] | null;
      address?: string | null;
    } | null;

    // No `globalOnlyRoles` argument: the members page and the command center
    // deliberately share one rule, so a leader's reach is identical in both
    // places. Owner and region heads may switch; everyone else is pinned to
    // their own region, HR and finance included.
    const viewer = await resolveMemberViewerScope(
      company,
      {
        _id: actor._id,
        company: companyId,
        regionLabel: actor.regionLabel,
        role: String(actor.role),
      },
      requestedRegion,
    );

    // `memberIds` is `null` for a company-wide viewer and an array otherwise —
    // including an empty one, which is a region that genuinely holds nobody and
    // must read as zero rather than widening to the whole company.
    const scopeClause = viewer.memberIds ? { _id: { $in: viewer.memberIds } } : {};

    const [members, teams, policy] = await Promise.all([
      User.find({ company: companyId, companyStatus: "approved", ...scopeClause })
        .select(
          "name email role customRole isSeniorSecurity team teamStatus activeTeams membershipHistory companyJoined employmentEndDate employmentType durationMonths durationDays durationHours durationYears salaryType baseSalary hourlyRate dailyRate salaryCurrency companyIdentityCode regionLabel phone dob address emergencyContact bloodGroup pfNumber pfDeductionAmount esicNumber esicDeductionAmount tdsDeductionAmount pfExempted esicExempted tdsExempted",
        )
        .populate("membershipHistory.inviter", "name role")
        .sort({ role: 1, name: 1 }),
      Team.find({ company: companyId }).select("name manager employees"),
      resolveRegionPolicy(companyId, actor.regionLabel),
    ]);

    const teamNamesByMember = new Map<string, string[]>();
    for (const team of teams) {
      const teamName = String(team.name ?? "");
      const memberIds = new Set<string>(
        (Array.isArray(team.employees) ? team.employees : []).map((m: any) => String(m?._id ?? m)),
      );
      const managerId = String((team.manager as any)?._id ?? team.manager ?? "");
      if (managerId) memberIds.add(managerId);
      for (const memberId of memberIds) {
        const names = teamNamesByMember.get(memberId) ?? [];
        names.push(teamName);
        teamNamesByMember.set(memberId, names);
      }
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const joinedThisMonth = members.filter(
      (member: any) => member.companyJoined && new Date(member.companyJoined) >= startOfThisMonth,
    ).length;
    const leftThisMonth = await User.countDocuments({
      membershipHistory: {
        $elemMatch: {
          company: companyId,
          action: { $in: ["removed-company", "left-company", "contract-expired"] },
          at: { $gte: startOfThisMonth },
        },
      },
      ...(viewer.memberIds ? { _id: { $in: viewer.memberIds } } : {}),
    });

    return NextResponse.json({
      members: members.map((member: any) => {
        const teamNames = teamNamesByMember.get(String(member._id)) ?? [];
        const history = Array.isArray(member.membershipHistory) ? member.membershipHistory : [];
        const lastJoin = [...history]
          .reverse()
          .find((entry: any) => String(entry?.action ?? "") === "joined-company");
        const inviter =
          lastJoin && lastJoin.inviter && typeof lastJoin.inviter === "object" && "name" in lastJoin.inviter
            ? {
                name: String((lastJoin.inviter as any).name ?? ""),
                role: String((lastJoin.inviter as any).role ?? ""),
              }
            : null;
        const lastDeparture = [...history]
          .reverse()
          .find(
            (entry: any) =>
              String(entry?.action ?? "") === "removed-company" ||
              String(entry?.action ?? "") === "left-company",
          );
        return {
          id: String(member._id),
          name: member.name ?? "",
          email: member.email ?? "",
          role: member.role ?? "employee",
          customRole: member.customRole ?? "",
          isSeniorSecurity: Boolean(member.isSeniorSecurity ?? false),
          baseSalary: Math.max(0, Number(member.baseSalary ?? 0)),
          salaryCurrency: String(member.salaryCurrency ?? "INR"),
          teamStatus: member.teamStatus ?? "none",
          teams: teamNames,
          hasTeam: teamNames.length > 0,
          joinedBy: inviter,
          createdAt: member.createdAt,
          companyJoined: member.companyJoined,
          leavingDate: lastDeparture?.at ?? null,
          // Deliberately the raw stored value, with no fallback to the first
          // office. `/api/profile` falls back so a blank label still renders
          // something, but that would file unassigned staff under office one and
          // make the per-region grouping quietly lie. A blank here is grouped
          // and labelled "Unassigned" instead, which is the honest reading.
          regionLabel: String(member.regionLabel ?? ""),
          phone: String(member.phone ?? ""),
          dob: member.dob ?? null,
          address: String(member.address ?? ""),
          emergencyContact: String(member.emergencyContact ?? ""),
          bloodGroup: String(member.bloodGroup ?? ""),
          employmentType: String(member.employmentType ?? ""),
          employmentEndDate: member.employmentEndDate ?? null,
          durationMonths: member.durationMonths ?? null,
          durationDays: member.durationDays ?? null,
          durationHours: member.durationHours ?? null,
          durationYears: member.durationYears ?? null,
          tdsDeductionAmount: Math.max(0, Number(member.tdsDeductionAmount ?? 0)),
          companyIdentityCode: String(member.companyIdentityCode ?? ""),
          pfNumber: String(member.pfNumber ?? ""),
          pfDeductionAmount: Math.max(0, Number(member.pfDeductionAmount ?? 0)),
          esicNumber: String(member.esicNumber ?? ""),
          esicDeductionAmount: Math.max(0, Number(member.esicDeductionAmount ?? 0)),
          pfExempted: Boolean(member.pfExempted ?? false),
          esicExempted: Boolean(member.esicExempted ?? false),
          tdsExempted: Boolean(member.tdsExempted ?? false),
        };
      }),
      totalMembers: members.length,
      roleCounts: members.reduce((counts: Record<string, number>, member: any) => {
        const role = String(member.role ?? "employee");
        counts[role] = (counts[role] ?? 0) + 1;
        return counts;
      }, {}),
      companyPfPct: Number(policy?.pfPercentage ?? 12),
      companyEsicPct: Number(policy?.esicPercentage ?? 0.75),
      companyTdsPct: Number(policy?.tdsPercentage ?? 0),
      joinedThisMonth,
      leftThisMonth,

      // Scope the list is actually on, so the client can label it truthfully
      // rather than showing the region that was asked for.
      region: viewer.region,
      regionLabel: viewer.regionLabel,
      regionScope: viewer.regionScope,
      regionFallback: viewer.regionFallback,
      regionForced: viewer.regionForced,
      canSwitchRegion: viewer.canSwitchRegion,
      allowGlobalRegion: viewer.allowGlobalRegion,
      regionOptions: viewer.regionOptions,

      // Every office, for the "assign region" picker. That list must not shrink
      // to the offices the viewer can switch between, or a head could never
      // move a member into an office they are not currently looking at.
      allRegions: regionLabelsOf(company),
    });
  } catch (error) {
    console.error("[hr/members] failed", error);
    return jsonError("Could not load company members.", 500);
  }
}
