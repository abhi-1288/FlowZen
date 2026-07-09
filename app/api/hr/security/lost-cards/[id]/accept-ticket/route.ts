import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LostCardReport } from "@/models/LostCardReport";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { ATSAuditLog } from "@/models/ATSAuditLog";

export async function POST(
  _request: Request,
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
  if (String(actor.role) !== "security") return jsonError("Only security members can accept tickets.", 403);

  const { id } = await params;

  const report = await LostCardReport.findOne({ _id: id, company: actor.company });
  if (!report) return jsonError("Not found.", 404);
  if (!report.seniorTicketOpened) return jsonError("Ticket has not been opened yet.", 400);
  if (report.assignedJuniorSecurity) return jsonError("Ticket already accepted by another junior security.", 400);

  report.assignedJuniorSecurity = actor._id;
  report.juniorAcceptedAt = new Date();
  report.timeline.push({
    action: "ticket-accepted",
    actor: actor._id,
    actorName: actor.name ?? "Unknown",
    timestamp: new Date(),
    notes: "Junior security accepted the ticket.",
  });
  await report.save();

  await ATSAuditLog.create({
    actor: userId,
    action: "lost-card-ticket-accepted",
    entityType: "LostCardReport",
    entityId: id,
    metadata: { acceptedBy: actor.name },
    company: actor.company,
  });

  // Notify assigned senior security and HR
  const notifyIds = [...new Set(
    [report.assignedSeniorSecurity, report.assignedHR]
      .filter(Boolean)
      .map((id) => String(id))
      .filter((id) => id !== userId),
  )];
  for (const nid of notifyIds) {
    await Notification.create({
      user: nid,
      company: actor.company,
      type: "approval",
      title: "Ticket Accepted by Junior Security",
      message: `${actor.name} has accepted the lost card ticket.`,
      body: `Ticket for report: ${report.reason}\nAccepted by: ${actor.name}`,
      link: "/profile-hub?tab=security",
    });
    emitNotification(nid);
  }

  const populated = await LostCardReport.findById(report._id)
    .populate("user", "name email avatarUrl companyIdentityCode role")
    .populate("assignedSeniorSecurity", "name email role")
    .populate("assignedHR", "name email role")
    .populate("assignedJuniorSecurity", "name email role")
    .lean();

  return NextResponse.json({ report: populated });
}
