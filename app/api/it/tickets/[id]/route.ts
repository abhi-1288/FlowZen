import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { canTransitionTicket, canViewTicket, isItAdminRole, pushItActivity } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, ticket] = await Promise.all([
    User.findById(userId).select("role company companyStatus name"),
    ITTicket.findById(id)
      .populate("requester", "name email role companyIdentityCode department customRole phone emergencyContact avatarUrl")
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email")
      .populate("resolvedBy", "name email")
      .populate("manager", "name email"),
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!ticket) return jsonError("Ticket not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to view IT tickets.", 403);
  }

  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const allowed = await canViewTicket({ role: String(user.role), _id: user._id }, companyId, ticket);
  if (!allowed) return jsonError("You do not have permission to view this ticket.", 403);

  return NextResponse.json({ ticket: serializeDoc(ticket) });
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);

  const body = await request.json();
  const newStatus = String(body.status ?? "").toUpperCase();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, ticket] = await Promise.all([
    User.findById(userId).select("role company companyStatus name"),
    ITTicket.findById(id),
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!ticket) return jsonError("Ticket not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to modify IT tickets.", 403);
  }

  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  // Priority change: IT_ADMIN only.
  if (body.priority !== undefined && body.priority !== null) {
    const newPriority = String(body.priority).toUpperCase();
    const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (!allowedPriorities.includes(newPriority)) return jsonError("Invalid priority.", 400);
    if (!isItAdminRole(String(user.role))) {
      return jsonError("Only IT admins can change ticket priority.", 403);
    }
    if (String(ticket.priority) !== newPriority) {
      pushItActivity(ticket, { _id: user._id }, "Priority changed", `Priority changed to ${newPriority}`);
      ticket.priority = newPriority;
    }
  }

  if (newStatus && newStatus !== ticket.status) {
    if (newStatus === "CANCELLED") {
      return jsonError("Use the cancel endpoint to cancel a ticket.", 400);
    }
    if (newStatus === "RESOLVED") {
      return jsonError("Use the resolve endpoint to resolve a ticket.", 400);
    }
    // Ticket scoping + transition validation.
    const allowedView = await canViewTicket({ role: String(user.role), _id: user._id }, companyId, ticket);
    if (!allowedView) return jsonError("You do not have permission to modify this ticket.", 403);
    if (!canTransitionTicket(ticket.status, newStatus)) {
      return jsonError(`Invalid status transition from ${ticket.status} to ${newStatus}.`, 400);
    }
    pushItActivity(
      ticket,
      { _id: user._id },
      "Status changed",
      `Status changed ${ticket.status} → ${newStatus}`,
    );
    ticket.status = newStatus;
  }

  await ticket.save();

  // Notify the requester of meaningful status changes.
  if (newStatus && newStatus !== ticket.status) {
    const requesterId = String(ticket.requester ?? "");
    if (requesterId && requesterId !== userId) {
      await Notification.create({
        user: requesterId,
        company: companyId,
        type: "info",
        title: "IT ticket updated",
        message: `${ticket.ticketNumber} is now ${newStatus.replaceAll("_", " ")}.`,
      });
      emitNotification(requesterId);
    }
  }

  return NextResponse.json({ ticket: serializeDoc(ticket) });
}
