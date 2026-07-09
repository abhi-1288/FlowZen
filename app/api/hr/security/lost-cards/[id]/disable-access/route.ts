import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LostCardReport } from "@/models/LostCardReport";
import { ATSAuditLog } from "@/models/ATSAuditLog";

const ZONE_OPTIONS = [
  "office-entry",
  "parking",
  "cafeteria",
  "printer",
  "server-room",
  "attendance-card",
];

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
  if (!["admin", "security"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;
  const body = await request.json();

  const report = await LostCardReport.findOne({ _id: id, company: actor.company });
  if (!report) return jsonError("Not found.", 404);

  if (report.status !== "replacement-approved") {
    return jsonError("Card access can only be disabled after replacement is approved.", 400);
  }

  const zones: string[] = body.zones ?? ZONE_OPTIONS;
  const validZones = zones.filter((z: string) => ZONE_OPTIONS.includes(z));

  report.status = "card-disabled";
  report.cardDisabledBy = userId as any;
  report.cardDisabledAt = new Date();
  report.disabledZones = validZones;
  report.timeline.push({
    action: "card-disabled",
    actor: userId as any,
    actorName: actor.name ?? "Unknown",
    timestamp: new Date(),
    notes: `Disabled zones: ${validZones.join(", ")}`,
  });
  await report.save();

  await ATSAuditLog.create({
    actor: userId,
    action: "lost-card-disable-access",
    entityType: "LostCardReport",
    entityId: id,
    metadata: { zones: validZones },
    company: actor.company,
  });

  const updated = await LostCardReport.findById(report._id)
    .populate("user", "name email avatarUrl companyIdentityCode role")
    .lean() as Record<string, unknown> | null;

  return NextResponse.json({ report: updated });
}
