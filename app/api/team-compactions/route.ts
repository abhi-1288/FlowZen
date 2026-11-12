import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import {
  createTeamCompactionDraft,
  getEmployeeContext,
  getTeamOwnerTeams,
  userIsCompanyAdmin,
} from "@/lib/compaction-service";
import { TEAM_COMPACTION_STATUSES } from "@/lib/work-constants";
import { TeamCompaction } from "@/models/TeamCompaction";
import { CompactionDelivery } from "@/models/CompactionDelivery";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const context = await getEmployeeContext(userId);
  if (!context) return jsonError("User not found.", 404);

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "owned";
  const status = url.searchParams.get("status") ?? "";
  const teamId = url.searchParams.get("teamId") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 300);

  const companyId = String(context.company?._id ?? "");
  const isAdmin = companyId ? await userIsCompanyAdmin(userId, companyId) : false;
  const teams = await getTeamOwnerTeams(userId);
  const managedTeamIds = teams.filter((team) => companyId && String(team.company) === companyId).map((team) => String(team._id));

  const filter: Record<string, unknown> = {};
  if (companyId) filter.company = companyId;
  if (status && TEAM_COMPACTION_STATUSES.includes(status as any)) filter.status = status;
  if (teamId && isObjectId(teamId)) filter.team = teamId;

  if (scope === "owned") {
    filter.teamOwner = userId;
  } else if (scope === "received") {
    if (isAdmin) {
      filter.status = {
        $in: ["submitted_to_admin", "delivered", "email_sent", "under_admin_review", "acknowledged", "correction_requested"],
      };
    } else {
      const delivered = await CompactionDelivery.find({
        recipient: userId,
        teamCompaction: { $ne: null },
        deliveryChannel: "in_app",
      }).select("teamCompaction");
      const ids = delivered.map((row: any) => row.teamCompaction).filter(Boolean);
      if (!ids.length) {
        return NextResponse.json({
          compactions: [],
          teams: teams.map((team) => ({ id: String(team._id), name: String(team.name ?? "") })),
          counts: emptyCounts(),
        });
      }
      filter._id = { $in: ids };
    }
  } else if (scope === "team") {
    if (isAdmin) {
      // no extra filter
    } else if (managedTeamIds.length) {
      filter.team = { $in: managedTeamIds };
    } else {
      filter.teamOwner = userId;
    }
  } else {
    filter.teamOwner = userId;
  }

  const compactions = await TeamCompaction.find(filter)
    .populate("team", "name")
    .populate("teamOwner", "name email avatarUrl")
    .sort({ reportingPeriodStart: -1, createdAt: -1 })
    .limit(limit);

  return NextResponse.json({
    compactions: serializeDocs(compactions),
    teams: teams.map((team) => ({ id: String(team._id), name: String(team.name ?? "") })),
    counts: {
      available: scope === "received" ? await TeamCompaction.countDocuments(filter) : undefined,
      draft: await TeamCompaction.countDocuments({ ...filter, status: "draft" }),
      awaitingConfirmation: await TeamCompaction.countDocuments({
        ...filter,
        status: "awaiting_team_owner_confirmation",
      }),
      submitted: await TeamCompaction.countDocuments({
        ...filter,
        status: { $in: ["submitted_to_admin", "delivered", "email_sent"] },
      }),
      correctionRequested: await TeamCompaction.countDocuments({
        ...filter,
        status: "correction_requested",
      }),
      acknowledged: await TeamCompaction.countDocuments({ ...filter, status: "acknowledged" }),
      actionRequired: await TeamCompaction.countDocuments(
        scope === "received"
          ? { ...filter, "adminReview.status": { $in: ["not_started", "under_review", "correction_requested"] } }
          : { ...filter, status: { $in: ["awaiting_team_owner_confirmation", "correction_requested"] } },
      ),
    },
  });
}

function emptyCounts() {
  return {
    available: 0,
    draft: 0,
    awaitingConfirmation: 0,
    submitted: 0,
    correctionRequested: 0,
    acknowledged: 0,
  };
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  const teamId = String(body.teamId ?? body.team ?? "");
  if (!isObjectId(teamId)) return jsonError("A valid team is required.");

  await connectDb();
  const teams = await getTeamOwnerTeams(userId);
  const context = await getEmployeeContext(userId);
  if (!context?.company) return jsonError("Your account is not linked to a company.", 409);
  const isAdmin = await userIsCompanyAdmin(userId, String(context.company._id));
  if (!teams.some((team) => String(team._id) === teamId) && !isAdmin) {
    return jsonError("Only the Team Owner can build this report.", 403);
  }

  const periodStart = body.periodStart ? new Date(String(body.periodStart)) : undefined;
  const periodEnd = body.periodEnd ? new Date(String(body.periodEnd)) : undefined;
  if ((periodStart && Number.isNaN(periodStart.getTime())) || (periodEnd && Number.isNaN(periodEnd.getTime()))) {
    return jsonError("Invalid reporting period.");
  }
  if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
    return jsonError("Provide both the period start and end.");
  }

  const exclusions = Array.isArray(body.exclusions)
    ? body.exclusions
        .map((item: Record<string, unknown>) => ({
          id: String(item.id ?? item.employeeCompactionId ?? ""),
          reason: String(item.reason ?? "").slice(0, 2000),
        }))
        .filter((item: { id: string }) => isObjectId(item.id))
    : [];

  try {
    const compaction = await createTeamCompactionDraft({
      teamOwnerId: userId,
      teamId,
      periodStart,
      periodEnd,
      sourceCompactionIds: Array.isArray(body.sourceCompactionIds)
        ? body.sourceCompactionIds.filter((id: unknown) => typeof id === "string" && isObjectId(id))
        : undefined,
      exclusions,
    });
    return NextResponse.json({ compaction: serializeDoc(compaction as any) }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The team compaction could not be created.", 409);
  }
}
