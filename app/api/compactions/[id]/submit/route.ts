import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { submitEmployeeCompaction } from "@/lib/compaction-service";
import { TaskCompaction } from "@/models/TaskCompaction";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid compaction id.");

  const body = await request.json().catch(() => ({}));
  await connectDb();
  const existing = await TaskCompaction.findById(id).select("employee");
  if (!existing) return jsonError("Compaction not found.", 404);
  if (String(existing.employee) !== userId) {
    return jsonError("Only the employee can confirm this compaction.", 403);
  }

  try {
    const compaction = await submitEmployeeCompaction({
      compactionId: id,
      employeeId: userId,
      content: body.content,
      summary: body.summary,
      reasonForContinuing: body.reasonForContinuing,
    });
    return NextResponse.json({ compaction: serializeDoc(compaction as any) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The compaction could not be submitted.", 409);
  }
}
