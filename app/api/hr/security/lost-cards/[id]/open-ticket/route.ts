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

  const isSenior = ["admin", "human-resource"].includes(String(actor.role)) || Boolean(actor.isSeniorSecurity);
  if (!isSenior) return jsonError("Only senior security, HR, or admin can open a ticket.", 403);

  const { id } = await params;

  const report = await LostCardReport.findOne({ _id: id, company: actor.company });
  if (!report) return jsonError("Not found.", 404);
  if (report.seniorTicketOpened) return jsonError("Ticket already opened.", 400);
  if (report.status !== "reported") return jsonError("Can only open ticket for a reported card.", 400);

  report.seniorTicketOpened = true;
  report.seniorTicketOpenedBy = actor._id;
  report.seniorTicketOpenedAt = new Date();
  report.timeline.push({
    action: "ticket-opened",
    actor: actor._id,
    actorName: actor.name ?? "Unknown",
    timestamp: new Date(),
    notes: "Senior security opened a ticket.",
  });
  await report.save();

  await ATSAuditLog.create({
    actor: userId,
    action: "lost-card-ticket-opened",
    entityType: "LostCardReport",
    entityId: id,
    metadata: { openedBy: actor.name },
    company: actor.company,
  });

  // Notify employee who reported and assigned HR
  const notifyIds = [String(report.user)];
  if (report.assignedHR) notifyIds.push(String(report.assignedHR));
  const uniqueIds = [...new Set(notifyIds.filter((nid) => nid !== userId))];

  for (const nid of uniqueIds) {
    await Notification.create({
      user: nid,
      company: actor.company,
      type: "approval",
      title: "Lost Card Ticket Opened",
      message: "A ticket has been opened for your lost card report. Check dashboard for details.",
      body: `Report: ${report.reason}\nStatus: Ticket Opened`,
      link: "/profile?tab=dashboard",
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
