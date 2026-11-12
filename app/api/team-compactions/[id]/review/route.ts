import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { reviewTeamCompaction } from "@/lib/compaction-service";

type Params = { params: Promise<{ id: string }> };

const ACTIONS = ["comment", "acknowledged", "correction_requested", "follow_up"] as const;

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid team compaction id.");

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "comment");
  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return jsonError("Action must be comment, acknowledged, correction_requested or follow_up.");
  }

  await connectDb();
  try {
    const compaction = await reviewTeamCompaction({
      teamCompactionId: id,
      reviewerId: userId,
      action: action as (typeof ACTIONS)[number],
      body: String(body.body ?? body.comment ?? "").slice(0, 4000),
    });

    await recordAudit({
      action: `team_compaction.${action}`,
      actionLabel: `Team compaction ${action.replace("_", " ")}`,
      company: compaction.company ? String(compaction.company) : null,
      actor: { id: userId },
      entityType: "TeamCompaction",
      entityId: id,
    });

    return NextResponse.json({ compaction: serializeDoc(compaction as any) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The review could not be saved.", 409);
  }
}
