import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { isItStaff, pushItActivity } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);
  const body = await request.json();
  const note = String(body.note ?? "").trim();

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
    return jsonError("You must be an approved company member to request information.", 403);
  }
  if (!isItStaff(String(actor.role))) {
    return jsonError("Only IT staff can request information from the requester.", 403);
  }
  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;

  if (ticket.status !== "IN_PROGRESS" && ticket.status !== "QUEUED" && ticket.status !== "ASSIGNED") {
    return jsonError(`Cannot request information from status ${ticket.status}.`, 400);
  }

  // Ensure assigned IT member requesting; IT admin can also request.
  const isAssigned = ticket.assignedTo ? String(ticket.assignedTo) === userId : false;
  if (String(actor.role) !== "it-admin" && !isAssigned) {
    return jsonError("You can only request information on tickets assigned to you.", 403);
  }

  ticket.status = "WAITING_FOR_USER";
  if (!note) {
    pushItActivity(ticket, { _id: actor._id }, "Information requested", `Information requested from requester`);
  } else {
    if (!Array.isArray(ticket.comments)) ticket.comments = [];
    ticket.comments.push({ user: userId, body: note });
    pushItActivity(ticket, { _id: actor._id }, "Information requested", `Information requested: ${note}`);
  }
  await ticket.save();

  const requesterId = String(ticket.requester ?? "");
  if (requesterId && requesterId !== userId) {
    await Notification.create({
      user: requesterId,
      company: companyId,
      type: "info",
      title: "IT needs more information",
      message: `${ticket.ticketNumber}: IT requested additional information from you.`,
    });
    emitNotification(requesterId);
  }

  const refreshed = await ITTicket.findById(id);
  return NextResponse.json({ ticket: serializeDoc(refreshed) });
}
