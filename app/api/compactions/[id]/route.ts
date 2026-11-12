import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  updateEmployeeCompaction,
  userIsCompanyAdmin,
  userOwnsTeam,
} from "@/lib/compaction-service";
import { TaskCompaction } from "@/models/TaskCompaction";
import { CompactionTodo } from "@/models/CompactionTodo";
import { CompactionDelivery } from "@/models/CompactionDelivery";
import { CompactionRevision } from "@/models/CompactionRevision";

type Params = { params: Promise<{ id: string }> };

async function loadCompaction(id: string) {
  return TaskCompaction.findById(id)
    .populate("employee", "name email avatarUrl companyIdentityCode")
    .populate("teamOwner", "name email avatarUrl")
    .populate("team", "name");
}

async function canView(userId: string, compaction: Record<string, any>) {
  if (String(compaction.employee?._id ?? compaction.employee) === userId) return true;
  if (String(compaction.teamOwner?._id ?? compaction.teamOwner) === userId) return true;
  if (compaction.team && (await userOwnsTeam(userId, String(compaction.team?._id ?? compaction.team)))) {
    return true;
  }
  return userIsCompanyAdmin(userId, String(compaction.company));
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid compaction id.");

  await connectDb();
  const compaction = await loadCompaction(id);
  if (!compaction) return jsonError("Compaction not found.", 404);
  if (!(await canView(userId, compaction as any))) {
    return jsonError("Compaction not found.", 404);
  }

  const [todos, deliveries, revisions] = await Promise.all([
    CompactionTodo.find({ compaction: id })
      .populate("assigneeId", "name email")
      .populate("originalOwnerId", "name email")
      .sort({ category: 1, createdAt: 1 }),
    CompactionDelivery.find({ compaction: id })
      .populate("recipient", "name email role")
      .sort({ createdAt: 1 }),
    CompactionRevision.find({ compaction: id })
      .populate("changedBy", "name")
      .sort({ createdAt: -1 }),
  ]);

  return NextResponse.json({
    compaction: serializeDoc(compaction),
    todos: serializeDocs(todos),
    deliveries: serializeDocs(deliveries),
    revisions: serializeDocs(revisions),
    permissions: {
      canEdit:
        String(compaction.employee?._id ?? compaction.employee) === userId &&
        ["pending_generation", "draft_ready", "draft", "awaiting_confirmation", "correction_requested", "delivery_failed"].includes(
          String(compaction.status),
        ),
      canReview:
        String(compaction.teamOwner?._id ?? compaction.teamOwner) === userId ||
        (await userIsCompanyAdmin(userId, String(compaction.company))),
      canRetryDelivery: await canView(userId, compaction as any),
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid compaction id.");

  const body = await request.json().catch(() => ({}));
  await connectDb();
  const compaction = await TaskCompaction.findById(id);
  if (!compaction) return jsonError("Compaction not found.", 404);
  if (String(compaction.employee) !== userId) {
    return jsonError("Only the employee can edit this compaction.", 403);
  }

  try {
    const updated = await updateEmployeeCompaction({
      compactionId: id,
      employeeId: userId,
      content: body.content,
      summary: body.summary,
      reasonForContinuing: body.reasonForContinuing,
      changeReason: String(body.changeReason ?? "Employee edited draft").slice(0, 500),
    });

    await recordAudit({
      action: "compaction.updated",
      actionLabel: "Employee compaction updated",
      company: compaction.company ? String(compaction.company) : null,
      actor: { id: userId },
      entityType: "TaskCompaction",
      entityId: id,
    });

    return NextResponse.json({ compaction: serializeDoc(updated as any) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The compaction could not be updated.", 409);
  }
}
