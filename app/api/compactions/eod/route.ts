import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  generateEmployeeCompactionDraft,
  getEmployeeContext,
  userIsCompanyAdmin,
} from "@/lib/compaction-service";
import {
  dateKeyInTimeZone,
  resolveTimeZone,
  startOfDayInTimeZone,
} from "@/lib/compaction";
import { Attendance } from "@/models/Attendance";
import { TaskCompaction } from "@/models/TaskCompaction";
import { BoardTodo } from "@/models/BoardTodo";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const context = await getEmployeeContext(userId);
  if (!context) return jsonError("User not found.", 404);

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId") ?? userId;
  if (employeeId !== userId) {
    const allowed = await userIsCompanyAdmin(userId, String(context.company?._id ?? ""));
    if (!allowed) return jsonError("You cannot view this employee's EOD status.", 403);
  }

  const target = employeeId === userId ? context : await getEmployeeContext(employeeId);
  if (!target) return jsonError("Employee not found.", 404);

  const timeZone = resolveTimeZone(target.company?.timeZone ?? context.timeZone);
  const now = new Date();
  const dayStart = startOfDayInTimeZone(now, timeZone);
  const dayKey = dateKeyInTimeZone(now, timeZone);

  const [attendance, compaction, activeTodos, activeBoardTasks] = await Promise.all([
    Attendance.findOne({
      user: employeeId,
      date: { $gte: dayStart, $lte: new Date(dayStart.getTime() + 86_400_000 - 1) },
    }).select("checkIn checkOut status"),
    TaskCompaction.findOne({
      employee: employeeId,
      compactionType: "EOD",
      reportingDateKey: dayKey,
    }).select("_id status submittedAt deliveredToTeamOwnerAt emailSentAt summary"),
    BoardTodo.countDocuments({
      assigneeId: employeeId,
      status: { $nin: ["completed", "approved"] },
    }),
    Task.find({
      takenBy: employeeId,
      $or: [{ company: target.company?._id ?? context.company?._id }, { company: null }],
    })
      .populate("column", "title")
      .select("column")
      .then((tasks) =>
        tasks.filter((task: any) =>
          !["done", "expired-due"].includes(String(task.column?.title ?? "").toLowerCase()),
        ).length,
      ),
  ]);
  const openWorkCount = activeTodos + activeBoardTasks;

  const hasCheckout = Boolean(attendance?.checkOut);
  const needsConfirmation = String(compaction?.status ?? "") === "awaiting_confirmation";

  return NextResponse.json({
    timeZone,
    dayKey,
    attendance: attendance
      ? {
          checkIn: attendance.checkIn ?? null,
          checkOut: attendance.checkOut ?? null,
          status: attendance.status,
        }
      : null,
    hasCheckout,
    // A draft is only auto-generated after an official checkout. When the hook
    // failed (or the employee checked out before the feature shipped), this flag
    // tells the client the recovery endpoint is safe to call.
    canGenerateRecovery:
      hasCheckout && !compaction && openWorkCount > 0,
    activeTodoCount: openWorkCount,
    draft: compaction
      ? {
          id: String(compaction._id),
          status: compaction.status,
          submittedAt: compaction.submittedAt ?? null,
          deliveredToTeamOwnerAt: compaction.deliveredToTeamOwnerAt ?? null,
          emailSentAt: compaction.emailSentAt ?? null,
        }
      : null,
    hasReport: Boolean(compaction),
    needsConfirmation,
    reminder:
      needsConfirmation && hasCheckout
        ? "Your EOD compaction is waiting for confirmation. Review and submit it so your Team Owner receives it."
        : "",
    states: {
      not_started: !hasCheckout,
      pending_generation: hasCheckout && !compaction && openWorkCount > 0,
      awaiting_confirmation: needsConfirmation,
      submitted: ["submitted", "delivered_to_team_owner", "email_sent"].includes(
        String(compaction?.status ?? ""),
      ),
      delivery_failed: String(compaction?.status ?? "") === "delivery_failed",
      correction_requested: String(compaction?.status ?? "") === "correction_requested",
    },
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));

  const employeeId = body.employeeId ? String(body.employeeId) : userId;
  await connectDb();
  const context = await getEmployeeContext(userId);
  if (!context) return jsonError("User not found.", 404);
  if (!context.company) return jsonError("Your account is not linked to a company.", 409);
  if (employeeId !== userId) {
    const allowed = await userIsCompanyAdmin(userId, String(context.company._id));
    if (!allowed) return jsonError("Only a company admin can recover another employee's EOD.", 403);
    const target = await User.findOne({ _id: employeeId, company: context.company._id }).select("_id");
    if (!target) return jsonError("Employee is not part of your company.", 404);
  }

  const reportingDate = body.reportingDate ? new Date(String(body.reportingDate)) : new Date();
  if (Number.isNaN(reportingDate.getTime())) return jsonError("Invalid reporting date.");

  try {
    const result = await generateEmployeeCompactionDraft({
      employeeId,
      type: "EOD",
      reportingDate,
      source: "recovery",
      createdBy: userId,
      // Recovery may only reconstruct a report for a day where the employee
      // actually completed an official checkout, matching the automatic path.
      requireCheckout: true,
    });

    if (!result.compaction) {
      return NextResponse.json(
        {
          compaction: null,
          created: false,
          reason: result.reason ?? "empty",
          message:
            result.reason === "empty"
              ? "There is no work item to include in today's EOD report."
              : result.reason === "checkout_required"
                ? "No completed attendance checkout was found for this date."
                : "The EOD compaction could not be recovered.",
        },
        { status: 200 },
      );
    }

    await recordAudit({
      action: "compaction.eod_recovered",
      actionLabel: "EOD compaction recovered",
      company: context.company._id,
      actor: { id: userId, name: context.name, role: String(context.user.role ?? "") },
      entityType: "TaskCompaction",
      entityId: String(result.compaction._id),
      metadata: { employeeId, created: result.created },
    });

    return NextResponse.json(
      {
        compaction: serializeDocs([result.compaction] as any)[0],
        created: result.created,
        reason: result.reason ?? null,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "EOD recovery failed.", 400);
  }
}
