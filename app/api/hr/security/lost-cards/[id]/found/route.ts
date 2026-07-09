import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LostCardReport } from "@/models/LostCardReport";
import { ATSAuditLog } from "@/models/ATSAuditLog";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("name role company");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource", "security"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;
  const body = await request.json();

  const report = await LostCardReport.findOne({ _id: id, company: actor.company });
  if (!report) return jsonError("Not found.", 404);

  if (["completed", "rejected", "found", "found-after-replacement"].includes(report.status)) {
    return jsonError("This report is already in a terminal state.", 400);
  }

  const replacementAlreadyIssued = Boolean(body.replacementAlreadyIssued);
  const newStatus = replacementAlreadyIssued ? "found-after-replacement" : "found";

  report.status = newStatus;
  report.oldCardFound = true;
  report.replacementAlreadyIssued = replacementAlreadyIssued;
  if (replacementAlreadyIssued) {
    report.oldCardDestroyed = true;
  }
  report.timeline.push({
    action: newStatus,
    actor: userId as any,
    actorName: actor.name ?? "Unknown",
    timestamp: new Date(),
    notes: replacementAlreadyIssued
      ? "Old card found after replacement issued — old card destroyed."
      : "Old card found — card reactivated.",
  });
  await report.save();

  await ATSAuditLog.create({
    actor: userId,
    action: `lost-card-${newStatus}`,
    entityType: "LostCardReport",
    entityId: id,
    metadata: { replacementAlreadyIssued, oldCardDestroyed: report.oldCardDestroyed },
    company: actor.company,
  });

  const updated = await LostCardReport.findById(report._id)
    .populate("user", "name email avatarUrl companyIdentityCode role")
    .lean() as Record<string, unknown> | null;

  return NextResponse.json({ report: updated });
}
