import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  updateTeamCompaction,
  userIsCompanyAdmin,
} from "@/lib/compaction-service";
import { TeamCompaction } from "@/models/TeamCompaction";
import { TeamCompactionSource } from "@/models/TeamCompactionSource";
import { CompactionDelivery } from "@/models/CompactionDelivery";
import { CompactionRevision } from "@/models/CompactionRevision";
import { CompactionTodo } from "@/models/CompactionTodo";

type Params = { params: Promise<{ id: string }> };

async function canView(userId: string, compaction: Record<string, any>) {
  if (String(compaction.teamOwner?._id ?? compaction.teamOwner) === userId) return true;
  if (await userIsCompanyAdmin(userId, String(compaction.company?._id ?? compaction.company))) return true;
  if (await CompactionDelivery.exists({ teamCompaction: compaction._id, recipient: userId })) return true;
  if (await TeamCompactionSource.exists({ teamCompaction: compaction._id, employee: userId })) return true;
  return false;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid team compaction id.");

  await connectDb();
  try {
    const compaction = await TeamCompaction.findById(id)
      .populate("team", "name")
      .populate("teamOwner", "name email avatarUrl role")
      .populate("company", "name icon");
    if (!compaction) return jsonError("Team compaction not found.", 404);
    if (!(await canView(userId, compaction as any))) {
      return jsonError("Team compaction not found.", 404);
    }

    const [sources, deliveries, revisions] = await Promise.all([
      TeamCompactionSource.find({ teamCompaction: id })
        .populate("employee", "name email avatarUrl")
        .populate("employeeCompaction", "compactionType reportingDate status summary")
        .sort({ createdAt: 1 }),
      CompactionDelivery.find({ teamCompaction: id })
        .populate("recipient", "name email role")
        .sort({ createdAt: 1 }),
      CompactionRevision.find({ teamCompaction: id })
        .populate("changedBy", "name")
        .sort({ createdAt: -1 }),
    ]);

    const sourceCompactionIds = sources.map((source: any) => source.employeeCompaction?._id ?? source.employeeCompaction);
    const sourceTodos = sourceCompactionIds.length
      ? await CompactionTodo.find({ compaction: { $in: sourceCompactionIds } }).sort({ category: 1, createdAt: 1 })
      : [];
    const todosByCompaction = new Map<string, any[]>();
    for (const todo of sourceTodos) {
      const key = String(todo.compaction);
      const list = todosByCompaction.get(key) ?? [];
      list.push(todo);
      todosByCompaction.set(key, list);
    }
    const serializedSources = serializeDocs(sources).map((source: any) => ({
      ...source,
      todos: serializeDocs(todosByCompaction.get(String(source.employeeCompaction?.id ?? source.employeeCompaction?._id ?? source.employeeCompaction)) ?? []),
    }));

    const companyId = String((compaction as any).company?._id ?? (compaction as any).company ?? "");
    const teamId = String((compaction as any).team?._id ?? (compaction as any).team ?? "");
    const isOwner = String((compaction as any).teamOwner?._id ?? (compaction as any).teamOwner) === userId;
    const isAdmin = await userIsCompanyAdmin(userId, companyId);

    return NextResponse.json({
      compaction: serializeDoc(compaction),
      sources: serializedSources,
      deliveries: serializeDocs(deliveries),
      revisions: serializeDocs(revisions),
      permissions: {
        canEdit:
          (isOwner || isAdmin) &&
          ["draft", "awaiting_team_owner_confirmation", "correction_requested"].includes(
            String(compaction.status),
          ),
        canSubmit: isOwner || isAdmin,
        canReview: isAdmin,
        isTeamOwner: isOwner,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load team compaction.", 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid team compaction id.");

  const body = await request.json().catch(() => ({}));
  await connectDb();
  try {
    const updated = await updateTeamCompaction({
      teamCompactionId: id,
      actorId: userId,
      overallSummary: body.overallSummary,
      nextPeriodPlan: body.nextPeriodPlan,
      adminSupportRequired: body.adminSupportRequired,
      content: body.content,
    });

    await recordAudit({
      action: "team_compaction.updated",
      actionLabel: "Team compaction updated",
      company: updated.company ? String(updated.company) : null,
      actor: { id: userId },
      entityType: "TeamCompaction",
      entityId: id,
    });

    return NextResponse.json({ compaction: serializeDoc(updated as any) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The team compaction could not be updated.", 409);
  }
}
