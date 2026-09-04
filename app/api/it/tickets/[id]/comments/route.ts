import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { canViewTicket, pushItActivity, canManageIt } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);
  const body = await request.json();
  const text = String(body.body ?? "").trim();
  if (!text) return jsonError("Comment body is required.");
  if (text.length > 2000) return jsonError("Comment must be 2000 characters or fewer.");

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
    return jsonError("You must be an approved company member to comment on IT tickets.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const allowed = await canViewTicket({ role: String(user.role), _id: user._id }, companyId, ticket);
  if (!allowed) return jsonError("You do not have permission to comment on this ticket.", 403);

  if (!Array.isArray(ticket.comments)) ticket.comments = [];
  ticket.comments.push({ user: userId, body: text });
  pushItActivity(ticket, { _id: user._id }, "Comment added", `Comment added by ${user.name}`);
  await ticket.save();

  // Notify counterpart (requester or assigned IT member).
  const notifyTargets = new Set<string>();
  const requesterId = String(ticket.requester ?? "");
  const assignedId = ticket.assignedTo ? String(ticket.assignedTo) : "";
  if (requesterId && requesterId !== userId) notifyTargets.add(requesterId);
  if (assignedId && assignedId !== userId) notifyTargets.add(assignedId);
  for (const target of notifyTargets) {
    await Notification.create({
      user: target,
      company: companyId,
      type: "info",
      title: "New IT ticket comment",
      message: `${user.name} commented on ${ticket.ticketNumber}.`,
    });
    emitNotification(target);
  }

  const refreshed = await ITTicket.findById(id);

  // Return just the ticket so the client can re-render the comment list + activity.
  return NextResponse.json({ ticket: serializeDoc(refreshed) }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const url = new URL(request.url);
  const commentId = String(url.searchParams.get("commentId") ?? "").trim();
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);
  if (!commentId) return jsonError("commentId is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, ticket] = await Promise.all([
    User.findById(userId).select("role company companyStatus name _id"),
    ITTicket.findById(id),
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!ticket) return jsonError("Ticket not found.", 404);
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const allowed = await canViewTicket({ role: String(user.role), _id: user._id }, companyId, ticket);
  if (!allowed) return jsonError("You do not have permission to remove comments from this ticket.", 403);

  const index = (ticket.comments ?? []).findIndex((c: any) => String(c._id) === commentId);
  if (index === -1) return jsonError("Comment not found.", 404);

  const comment = ticket.comments[index];
  const isAuthor = String(comment.user) === String(user._id);
  const isItStaff = await canManageIt(String(user.role));
  if (!isAuthor && !isItStaff) {
    return jsonError("You can only delete your own comments.", 403);
  }

  const [removed] = ticket.comments.splice(index, 1);
  pushItActivity(ticket, { _id: user._id }, "Comment removed", `Comment removed by ${user.name}`);
  await ticket.save();

  const refreshed = await ITTicket.findById(id);
  return NextResponse.json({ ticket: serializeDoc(refreshed) });
}
