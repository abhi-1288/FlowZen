import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { reviewEmployeeCompaction, userCanReviewCompaction } from "@/lib/compaction-service";
import { TaskCompaction } from "@/models/TaskCompaction";

type Params = { params: Promise<{ id: string }> };

const ACTIONS = ["comment", "reviewed", "correction_requested"] as const;

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid compaction id.");

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "comment");
  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return jsonError("Action must be comment, reviewed or correction_requested.");
  }

  await connectDb();
  const compaction = await TaskCompaction.findById(id);
  if (!compaction) return jsonError("Compaction not found.", 404);
  const access = await userCanReviewCompaction(userId, compaction as any);
  if (!access.ok) return jsonError("You are not allowed to review this compaction.", 403);

  try {
    const updated = await reviewEmployeeCompaction({
      compactionId: id,
      reviewerId: userId,
      action: action as (typeof ACTIONS)[number],
      body: String(body.body ?? body.comment ?? "").slice(0, 4000),
    });

    await recordAudit({
      action: `compaction.${action}`,
      actionLabel: `Employee compaction ${action.replace("_", " ")}`,
      company: compaction.company ? String(compaction.company) : null,
      actor: { id: userId },
      entityType: "TaskCompaction",
      entityId: id,
    });

    return NextResponse.json({ compaction: serializeDoc(updated as any) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The review could not be saved.", 409);
  }
}
