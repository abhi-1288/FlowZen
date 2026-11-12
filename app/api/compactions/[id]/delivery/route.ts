import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { retryCompactionDelivery, userIsCompanyAdmin } from "@/lib/compaction-service";
import { TaskCompaction } from "@/models/TaskCompaction";
import { CompactionDelivery } from "@/models/CompactionDelivery";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid compaction id.");

  await connectDb();
  try {
    const compaction = await retryCompactionDelivery({ compactionId: id, actorId: userId });
    const deliveries = await CompactionDelivery.find({ compaction: id })
      .populate("recipient", "name email role")
      .sort({ createdAt: 1 });

    await recordAudit({
      action: "compaction.delivery_retried",
      actionLabel: "Compaction delivery retried",
      company: compaction.company ? String(compaction.company) : null,
      actor: { id: userId },
      entityType: "TaskCompaction",
      entityId: id,
    });

    return NextResponse.json({
      compaction: serializeDoc(compaction as any),
      deliveries: deliveries.map((delivery: any) => serializeDoc(delivery)),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Delivery retry failed.", 409);
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid compaction id.");

  await connectDb();
  const compaction = await TaskCompaction.findById(id).select("employee teamOwner company");
  if (!compaction) return jsonError("Compaction not found.", 404);

  const isEmployee = String(compaction.employee) === userId;
  const isOwner = String(compaction.teamOwner) === userId;
  if (!isEmployee && !isOwner) {
    if (!(await userIsCompanyAdmin(userId, String(compaction.company?._id ?? compaction.company)))) {
      return jsonError("Compaction not found.", 404);
    }
  }

  const deliveries = await CompactionDelivery.find({ compaction: id })
    .populate("recipient", "name email role")
    .sort({ createdAt: 1 });
  return NextResponse.json({ deliveries: deliveries.map((delivery: any) => serializeDoc(delivery)) });
}
