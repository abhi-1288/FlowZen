import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { isItAdminRole, pushItActivity } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);
  const body = await request.json();
  const assigneeId = String(body.assigneeId ?? "").trim();

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
    return jsonError("You must be an approved company member to assign IT tickets.", 403);
  }
  if (!isItAdminRole(String(actor.role))) {
    return jsonError("Only IT admins can assign IT tickets.", 403);
  }
  if (!assigneeId) return jsonError("assigneeId is required.");

  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;
  const assignee = await User.findOne({
    _id: assigneeId,
    company: companyId,
    companyStatus: "approved",
    role: { $in: ["it-administration"] },
  }).select("name email role companyStatus");
  if (!assignee) return jsonError("Assignee not found in your company.", 404);

  const previous = ticket.assignedTo ? String(ticket.assignedTo) : null;
  const previousName = previous === assigneeId ? "(same)" : previous ? "previous assignee" : "unassigned";

  ticket.assignedTo = assignee._id;
  ticket.assignedBy = actor._id;
  ticket.assignedAt = new Date();
  if (["PENDING", "CANCELLED", "RESOLVED"].includes(String(ticket.status)) || String(ticket.status) === "") {
    ticket.status = "ASSIGNED";
  }
  pushItActivity(
    ticket,
    { _id: actor._id },
    "Assigned",
    `Assigned ${ticket.ticketNumber} to ${assignee.name}${previous ? ` (reassigned from ${previous})` : ""}`,
  );
  await ticket.save();

  const assigneeIdStr = String(assignee._id);
  await Notification.create({
    user: assigneeIdStr,
    company: companyId,
    type: "info",
    title: "IT ticket assigned",
    message: `${ticket.ticketNumber}: ${ticket.title} was assigned to you by ${actor.name}.`,
  });
  emitNotification(assigneeIdStr);

  return NextResponse.json({ ticket: serializeDoc(ticket) });
}
