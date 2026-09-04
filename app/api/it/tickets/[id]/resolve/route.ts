import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { isItStaff, pushItActivity } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

const RESOLUTION_TYPES = new Set([
  "ACCESS_CORRECTED",
  "HARDWARE_REPAIRED",
  "SOFTWARE_INSTALLED",
  "CONFIGURATION_CHANGED",
  "PASSWORD_ACCOUNT_FIXED",
  "NETWORK_ISSUE_FIXED",
  "USER_GUIDEANCE",
  "OTHER",
]);

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);
  const body = await request.json();
  const resolution = String(body.resolution ?? "").trim();
  const resolutionType = String(body.resolutionType ?? "OTHER").toUpperCase();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [actor, ticket] = await Promise.all([
    User.findById(userId).select("role company companyStatus name"),
    ITTicket.findById(id),
  ]);
  if (!actor) return jsonError("User not found.", 404);
  if (!ticket) return jsonError("Ticket not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to resolve IT tickets.", 403);
  }
  if (!isItStaff(String(actor.role))) {
    return jsonError("Only IT staff can resolve IT tickets.", 403);
  }
  if (!RESOLUTION_TYPES.has(resolutionType)) return jsonError("Invalid resolution type.", 400);
  if (ticket.status !== "IN_PROGRESS" && ticket.status !== "WAITING_FOR_USER" && ticket.status !== "QUEUED" && ticket.status !== "ASSIGNED") {
    return jsonError(`Cannot resolve ticket from status ${ticket.status}.`, 400);
  }

  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;
  const isAssigned = ticket.assignedTo ? String(ticket.assignedTo) === userId : false;
  if (String(actor.role) !== "it-admin" && !isAssigned) {
    return jsonError("You can only resolve tickets assigned to you.", 403);
  }

  ticket.resolution = resolution;
  ticket.resolutionType = resolutionType;
  ticket.resolvedBy = actor._id;
  ticket.resolvedAt = new Date();
  ticket.employeeConfirmed = false;
  ticket.status = "AWAITING_CONFIRMATION";
  pushItActivity(ticket, { _id: actor._id }, "Resolution submitted", `Resolution submitted by ${actor.name} (${resolutionType})`);
  await ticket.save();

  const requesterId = String(ticket.requester ?? "");
  if (requesterId && requesterId !== userId) {
    await Notification.create({
      user: requesterId,
      company: companyId,
      type: "info",
      title: "Resolution awaiting confirmation",
      message: `${ticket.ticketNumber}: Please confirm whether your issue is resolved.`,
    });
    emitNotification(requesterId);
  }

  const refreshed = await ITTicket.findById(id);
  return NextResponse.json({ ticket: serializeDoc(refreshed) });
}
