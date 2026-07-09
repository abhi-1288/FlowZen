import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LostCardReport } from "@/models/LostCardReport";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
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

  const actor = await User.findById(userId).select("name role company isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (String(actor.role) !== "security") return jsonError("Only security members can complete tickets.", 403);

  const { id } = await params;
  const body = await request.json();
  const followUpNote = String(body.note ?? "").trim();
  if (!followUpNote) return jsonError("Follow-up note is required.", 400);

  const report = await LostCardReport.findOne({ _id: id, company: actor.company });
  if (!report) return jsonError("Not found.", 404);
  if (!report.assignedJuniorSecurity) return jsonError("Ticket has not been accepted yet.", 400);
  if (String(report.assignedJuniorSecurity) !== userId) return jsonError("Only the assigned junior security can complete this ticket.", 403);
  if (report.juniorCompletedAt) return jsonError("Ticket already completed.", 400);

  report.followUpNotes.push({
    note: followUpNote,
    addedBy: actor._id,
    addedByName: actor.name ?? "Unknown",
    addedAt: new Date(),
  });
  report.juniorCompletedAt = new Date();
  report.timeline.push({
    action: "ticket-completed",
    actor: actor._id,
    actorName: actor.name ?? "Unknown",
    timestamp: new Date(),
    notes: followUpNote,
  });
  await report.save();

  await ATSAuditLog.create({
    actor: userId,
    action: "lost-card-ticket-completed",
    entityType: "LostCardReport",
    entityId: id,
    metadata: { completedBy: actor.name, followUpNote },
    company: actor.company,
  });

  // Notify employee, senior security, and HR
  const notifyIds = [...new Set(
    [report.user, report.assignedSeniorSecurity, report.assignedHR]
      .filter(Boolean)
      .map((id) => String(id))
      .filter((id) => id !== userId),
  )];
  for (const nid of notifyIds) {
    await Notification.create({
      user: nid,
      company: actor.company,
      type: "approval",
      title: "Lost Card Ticket Completed",
      message: `${actor.name} has completed the lost card ticket.`,
      body: `Follow-up: ${followUpNote}`,
      link: "/profile?tab=dashboard",
    });
    emitNotification(nid);
  }

  const populated = await LostCardReport.findById(report._id)
    .populate("user", "name email avatarUrl companyIdentityCode role")
    .populate("assignedSeniorSecurity", "name email role")
    .populate("assignedHR", "name email role")
    .populate("assignedJuniorSecurity", "name email role")
    .populate("followUpNotes.addedBy", "name email role")
    .lean();

  return NextResponse.json({ report: populated });
}
