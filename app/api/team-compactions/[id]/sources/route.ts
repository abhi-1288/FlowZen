import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { updateTeamCompactionSources, userIsCompanyAdmin } from "@/lib/compaction-service";
import { TeamCompaction } from "@/models/TeamCompaction";
import { TeamCompactionSource } from "@/models/TeamCompactionSource";
import { CompactionDelivery } from "@/models/CompactionDelivery";

type Params = { params: Promise<{ id: string }> };

/**
 * Mirrors the detail route's view rules. Source rows contain employee names and
 * report summaries, so they must not be readable by an arbitrary signed-in user
 * who guesses the id.
 */
async function canViewSources(userId: string, teamCompactionId: string): Promise<boolean> {
  const compaction = await TeamCompaction.findById(teamCompactionId).select("teamOwner company");
  if (!compaction) return false;
  if (String(compaction.teamOwner) === userId) return true;
  if (await userIsCompanyAdmin(userId, String(compaction.company?._id ?? compaction.company))) return true;
  if (await CompactionDelivery.exists({ teamCompaction: teamCompactionId, recipient: userId })) return true;
  return Boolean(
    await TeamCompactionSource.exists({ teamCompaction: teamCompactionId, employee: userId }),
  );
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid team compaction id.");

  await connectDb();
  if (!(await canViewSources(userId, id))) {
    return jsonError("Team compaction not found.", 404);
  }
  const sources = await TeamCompactionSource.find({ teamCompaction: id })
    .populate("employee", "name email avatarUrl")
    .populate("employeeCompaction", "compactionType reportingDate status summary")
    .sort({ createdAt: 1 });
  return NextResponse.json({ sources: serializeDocs(sources) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid team compaction id.");

  const body = await request.json().catch(() => ({}));
  const raw = Array.isArray(body.sources)
    ? body.sources
    : [
        {
          employeeCompactionId: body.employeeCompactionId,
          inclusionStatus: body.inclusionStatus,
          exclusionReason: body.exclusionReason,
        },
      ];

  const updates = raw
    .map((item: Record<string, unknown>) => ({
      employeeCompactionId: String(item.employeeCompactionId ?? item.id ?? ""),
      inclusionStatus:
        item.inclusionStatus === "included" || item.inclusionStatus === "excluded"
          ? item.inclusionStatus
          : undefined,
      exclusionReason:
        item.exclusionReason === undefined ? undefined : String(item.exclusionReason).slice(0, 2000),
    }))
    .filter((item: { employeeCompactionId: string }) => isObjectId(item.employeeCompactionId));

  if (!updates.length) return jsonError("At least one valid source is required.");

  await connectDb();
  try {
    const compaction = await updateTeamCompactionSources({
      teamCompactionId: id,
      actorId: userId,
      updates,
    });
    const sources = await TeamCompactionSource.find({ teamCompaction: id })
      .populate("employee", "name email avatarUrl")
      .populate("employeeCompaction", "compactionType reportingDate status summary")
      .sort({ createdAt: 1 });
    return NextResponse.json({ compaction: serializeDoc(compaction as any), sources: serializeDocs(sources) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Sources could not be updated.", 409);
  }
}
