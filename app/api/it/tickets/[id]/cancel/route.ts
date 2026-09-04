import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { User } from "@/models/User";
import { pushItActivity } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

const CANCEL_REASONS = new Set([
  "Issue resolved on my own",
  "Duplicate ticket",
  "No longer needed",
  "Wrong category",
  "Other",
]);

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);
  const body = await request.json();
  const reason = String(body.cancelReason ?? body.reason ?? "").trim();
  if (!reason) return jsonError("Cancellation reason is required.");
  if (!CANCEL_REASONS.has(reason)) return jsonError("Invalid cancellation reason.");

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

  // Only the requester can cancel.
  const requesterId = String(ticket.requester ?? "");
  if (!requesterId || requesterId !== userId) {
    return jsonError("Only the requester can cancel this ticket.", 403);
  }
  const cancellable = ["PENDING", "ASSIGNED", "QUEUED", "IN_PROGRESS", "WAITING_FOR_USER"];
  if (!cancellable.includes(String(ticket.status))) {
    return jsonError(`Ticket in ${ticket.status} status cannot be cancelled.`, 400);
  }

  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  ticket.status = "CANCELLED";
  ticket.cancelReason = reason;
  ticket.cancelledBy = user._id;
  ticket.cancelledAt = new Date();
  // Ticket remains in the database — never silently deleted.
  pushItActivity(ticket, { _id: user._id }, "Ticket cancelled", `Cancelled by ${user.name}: ${reason}`);
  await ticket.save();

  const refreshed = await ITTicket.findById(id)
    .populate("requester", "name email")
    .populate("assignedTo", "name")
    .populate("assignedBy", "name")
    .populate("resolvedBy", "name");
  return NextResponse.json({ ticket: serializeDoc(refreshed) });
}
