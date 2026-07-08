import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LostCardReport } from "@/models/LostCardReport";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const actor = await User.findById(userId).select("company role");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource", "security"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;
  const body = await request.json();
  const newStatus = String(body.status ?? "").trim();

  if (!["reported", "replacement-requested", "replaced", "found"].includes(newStatus)) {
    return jsonError("Invalid status.", 400);
  }

  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "replacement-requested") update.replacementRequestedAt = new Date();
  if (newStatus === "replaced") update.replacementIssuedAt = new Date();

  const report = await LostCardReport.findOneAndUpdate(
    { _id: id, company: actor.company },
    { $set: update },
    { new: true }
  ).lean() as Record<string, unknown> | null;

  if (!report) return jsonError("Not found.", 404);

  return NextResponse.json({
    report: {
      id: String(report._id),
      status: report.status,
      replacementRequestedAt: report.replacementRequestedAt,
      replacementIssuedAt: report.replacementIssuedAt,
    },
  });
}
