import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { User } from "@/models/User";
import { pushItActivity } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);
  const body = await request.json();
  const confirmed = Boolean(body.confirmed);

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

  // Only the requester can confirm.
  const requesterId = String(ticket.requester ?? "");
  if (!requesterId || requesterId !== userId) {
    return jsonError("Only the requester can confirm this ticket.", 403);
  }
  if (ticket.status !== "AWAITING_CONFIRMATION") {
    return jsonError(`Cannot confirm a ticket in ${ticket.status} status.`, 400);
  }

  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  if (confirmed) {
    ticket.status = "RESOLVED";
    ticket.employeeConfirmed = true;
    ticket.confirmedAt = new Date();
    pushItActivity(ticket, { _id: user._id }, "Employee confirmed", `Issue confirmed resolved by ${user.name}`);
  } else {
    ticket.status = "IN_PROGRESS";
    ticket.employeeConfirmed = false;
    pushItActivity(ticket, { _id: user._id }, "Issue not resolved", `${user.name} reported the issue persists`);
  }
  await ticket.save();

  const refreshed = await ITTicket.findById(id);
  return NextResponse.json({ ticket: serializeDoc(refreshed) });
}
