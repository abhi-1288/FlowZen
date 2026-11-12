import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { submitTeamCompaction } from "@/lib/compaction-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid team compaction id.");

  const body = await request.json().catch(() => ({}));
  await connectDb();
  try {
    const compaction = await submitTeamCompaction({
      teamCompactionId: id,
      actorId: userId,
      overallSummary: body.overallSummary,
      nextPeriodPlan: body.nextPeriodPlan,
      adminSupportRequired: body.adminSupportRequired,
      content: body.content,
    });
    return NextResponse.json({ compaction: serializeDoc(compaction as any) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The report could not be submitted.", 409);
  }
}
