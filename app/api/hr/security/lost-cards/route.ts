import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LostCardReport } from "@/models/LostCardReport";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";

  const filter: Record<string, unknown> = { company: actor.company };
  if (status) filter.status = status;

  const reports = await LostCardReport.find(filter)
    .sort({ reportedAt: -1 })
    .populate("user", "name email avatarUrl companyIdentityCode role")
    .lean() as Record<string, unknown>[];

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: String(r._id),
      user: r.user,
      status: r.status,
      reportedAt: r.reportedAt,
      replacementRequestedAt: r.replacementRequestedAt,
      replacementIssuedAt: r.replacementIssuedAt,
      notes: r.notes,
    })),
  });
}

export async function POST(request: Request) {
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

  const body = await request.json();
  const targetUserId = String(body.userId ?? "").trim();
  if (!targetUserId) return jsonError("userId is required.", 400);

  // Verify the target user belongs to the same company
  const targetUser = await User.findOne({ _id: targetUserId, company: actor.company }).select("_id");
  if (!targetUser) return jsonError("User not found in your company.", 404);

  const report = await LostCardReport.create({
    user: targetUserId,
    company: actor.company,
    status: "reported",
    notes: String(body.notes ?? "").trim(),
  });

  return NextResponse.json({ report: { ...report.toObject(), id: String(report._id) } });
}
