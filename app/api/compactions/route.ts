import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  createEowDraft,
  generateEmployeeCompactionDraft,
  getEmployeeContext,
  userIsCompanyAdmin,
  userOwnsTeam,
} from "@/lib/compaction-service";
import {
  EMPLOYEE_COMPACTION_STATUSES,
  isCompactionType,
} from "@/lib/work-constants";
import { TaskCompaction } from "@/models/TaskCompaction";
import { User } from "@/models/User";

const STATUS_LABELS: Record<string, string> = {
  exists: "A compaction for this period already exists.",
  empty: "There is no work to report for this period, so no compaction was created.",
  checkout_required: "You must complete your official attendance checkout before generating this compaction.",
  board_not_accessible: "You do not have access to the selected board.",
  no_company: "Your account is not linked to a company.",
  user_not_found: "User not found.",
};

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const context = await getEmployeeContext(userId);
  if (!context) return jsonError("User not found.", 404);

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "mine";
  const type = url.searchParams.get("type") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const employeeId = url.searchParams.get("employeeId") ?? "";
  const boardId = url.searchParams.get("boardId") ?? "";
  const dateFrom = url.searchParams.get("dateFrom") ?? "";
  const dateTo = url.searchParams.get("dateTo") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 300);
  // The panel renders Mine / Team / Received tabs and wants an "unconfirmed"
  // badge on each one, so ask for counts across every scope in a single call.
  const wantTabCounts = url.searchParams.get("tabCounts") === "1";

  // Shared base: company + type/board/date filters, before any scope clause.
  const baseFilter: Record<string, unknown> = {
    company: context.company?._id ?? null,
  };
  if (isCompactionType(type)) baseFilter.compactionType = type;
  if (boardId && isObjectId(boardId)) baseFilter.board = boardId;
  if (dateFrom || dateTo) {
    baseFilter.reportingDate = {
      ...(dateFrom ? { $gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { $lte: new Date(dateTo) } : {}),
    };
  }

  const filter: Record<string, unknown> = { ...baseFilter };
  if (status && EMPLOYEE_COMPACTION_STATUSES.includes(status as any)) filter.status = status;

  // Scope clauses, reused for both the row list and the tab badge counts.
  const receivedClause = () => ({
    $or: [
      { teamOwner: userId },
      { status: { $in: ["submitted", "delivered_to_team_owner", "email_sent", "email_pending", "delivery_failed"] } },
    ],
  });
  const isAdmin = scope === "received" || wantTabCounts || (scope === "employee" && employeeId && employeeId !== userId)
    ? await userIsCompanyAdmin(userId, String(context.company?._id ?? ""))
    : false;

  if (scope === "received") {
    if (!isAdmin) return jsonError("Only company admins can view the team inbox.", 403);
    Object.assign(filter, receivedClause());
  } else if (scope === "team") {
    filter.teamOwner = userId;
  } else if (scope === "employee" && isObjectId(employeeId)) {
    if (employeeId !== userId && !isAdmin) {
      // A Team Owner may inspect their own team's reports; resolve the target's
      // team server-side rather than trusting any client-supplied role.
      const target = await User.findOne({
        _id: employeeId,
        company: context.company?._id ?? null,
      }).select("team");
      const ownsTargetTeam = target?.team
        ? await userOwnsTeam(userId, String(target.team))
        : false;
      if (!ownsTargetTeam) {
        return jsonError("You cannot view this employee's compactions.", 403);
      }
    }
    filter.employee = employeeId;
  } else {
    filter.employee = userId;
  }

  // Badge counts for the Mine / Team / Received tabs. "Unconfirmed" means the
  // report is still waiting on someone: either the employee has not confirmed
  // their own draft, or it has been delivered but the reviewer has not marked
  // it reviewed yet.
  let tabCounts: Record<string, number> | null = null;
  if (wantTabCounts) {
    const UNCONFIRMED = [
      "awaiting_confirmation",
      "submitted",
      "delivered_to_team_owner",
      "email_pending",
      "email_sent",
    ];
    const unconfirmedCount = (scopeFilter: Record<string, unknown>) =>
      TaskCompaction.countDocuments({
        ...baseFilter,
        ...scopeFilter,
        status: { $in: UNCONFIRMED },
        reviewStatus: { $ne: "reviewed" },
      });

    tabCounts = {
      mine: await unconfirmedCount({ employee: userId }),
      team: await unconfirmedCount({ teamOwner: userId }),
      received: isAdmin ? await unconfirmedCount(receivedClause()) : 0,
    };
  }

  const compactions = await TaskCompaction.find(filter)
    .populate("employee", "name email avatarUrl")
    .populate("teamOwner", "name email avatarUrl")
    .populate("team", "name")
    .populate("board", "title")
    .sort({ reportingDate: -1, createdAt: -1 })
    .limit(limit);

  return NextResponse.json({
    compactions: serializeDocs(compactions),
    ...(tabCounts ? { tabCounts } : {}),
    counts: {
      available: scope === "received" ? await TaskCompaction.countDocuments(filter) : undefined,
      awaitingConfirmation: await TaskCompaction.countDocuments({
        ...filter,
        status: "awaiting_confirmation",
      }),
      submitted: await TaskCompaction.countDocuments({
        ...filter,
        status: { $in: ["submitted", "delivered_to_team_owner", "email_sent"] },
      }),
      deliveryFailed: await TaskCompaction.countDocuments({ ...filter, status: "delivery_failed" }),
      correctionRequested: await TaskCompaction.countDocuments({
        ...filter,
        status: "correction_requested",
      }),
      actionRequired: await TaskCompaction.countDocuments(
        scope === "received"
          ? { ...filter, reviewStatus: { $in: ["pending", "correction_requested"] } }
          : { ...filter, status: { $in: ["awaiting_confirmation", "correction_requested", "delivery_failed"] } },
      ),
    },
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  const type = String(body.type ?? "EOD").toUpperCase();
  if (!isCompactionType(type)) return jsonError("Compaction type must be EOD or EOW.");

  const targetEmployee = isObjectId(String(body.employeeId ?? ""))
    ? String(body.employeeId)
    : userId;

  await connectDb();
  const context = await getEmployeeContext(userId);
  if (!context) return jsonError("User not found.", 404);
  if (!context.company) return jsonError("Your account is not linked to a company.", 409);

  if (targetEmployee !== userId) {
    const allowed = await userIsCompanyAdmin(userId, String(context.company._id));
    if (!allowed) return jsonError("Only a company admin can generate another employee's compaction.", 403);
    const target = await User.findOne({ _id: targetEmployee, company: context.company._id }).select("_id");
    if (!target) return jsonError("Employee is not part of your company.", 404);
  }

  const reportingDate = body.reportingDate ? new Date(String(body.reportingDate)) : new Date();
  if (Number.isNaN(reportingDate.getTime())) return jsonError("Invalid reporting date.");
  const workSessionStart = body.workSessionStart ? new Date(String(body.workSessionStart)) : null;
  const workSessionEnd = body.workSessionEnd ? new Date(String(body.workSessionEnd)) : null;
  const boardId = body.boardId ? String(body.boardId) : null;
  const source = targetEmployee === userId ? "manual" : "recovery";

  try {
    const result =
      type === "EOW"
        ? await createEowDraft({
            employeeId: targetEmployee,
            reportingDate,
            workSessionStart,
            workSessionEnd,
            allowMultipleSessions: Boolean(body.allowMultipleSessions),
            boardId,
          })
        : await generateEmployeeCompactionDraft({
            employeeId: targetEmployee,
            type: "EOD",
            reportingDate,
            source,
            allowMultipleSessions: Boolean(body.allowMultipleSessions),
            createdBy: userId,
            boardId,
          });

    if (!result.compaction) {
      return NextResponse.json(
        {
          compaction: null,
          created: false,
          reason: result.reason ?? "empty",
          message: STATUS_LABELS[result.reason ?? "empty"] ?? "No compaction was generated.",
        },
        { status: result.reason === "checkout_required" || result.reason === "no_company" ? 409 : 200 },
      );
    }

    await recordAudit({
      action: "compaction.draft.requested",
      actionLabel: `${type} compaction draft requested`,
      company: context.company._id,
      actor: { id: userId, name: context.name, role: String(context.user.role ?? "") },
      entityType: "TaskCompaction",
      entityId: String(result.compaction._id),
      metadata: { created: result.created, reason: result.reason ?? null },
    });

    return NextResponse.json(
      { compaction: serializeDocs([result.compaction] as any)[0], created: result.created, reason: result.reason ?? null },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The compaction could not be generated.";
    return jsonError(message, 400);
  }
}
