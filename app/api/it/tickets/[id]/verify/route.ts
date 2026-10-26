import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
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

  const user = await User.findById(userId).select("name role company companyStatus");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const companyId = typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const ticket = await ITTicket.findOne({ _id: id, company: companyId });
  if (!ticket) return jsonError("Ticket not found.", 404);
  if ((ticket as any).verificationStatus !== "pending-verification") return jsonError("This ticket is not pending verification.", 400);

  const isAdminHr = ["admin", "human-resource", "it-admin"].includes(String(user.role));
  const isAuthorizer = (ticket as any).authorizer && String((ticket as any).authorizer) === userId;
  if (!isAdminHr && !isAuthorizer) return jsonError("Forbidden.", 403);
  if (String((ticket as any).submittedBy) === userId) return jsonError("You cannot verify your own submission.", 403);

  // Apply the pending resolution
  if ((ticket as any).pendingResolution) {
    ticket.resolution = (ticket as any).pendingResolution;
    ticket.resolutionType = (ticket as any).pendingResolutionType;
    ticket.resolvedBy = (ticket as any).submittedBy;
    ticket.status = "RESOLVED";
  }
  (ticket as any).verificationStatus = "verified";
  (ticket as any).verifiedBy = userId;
  (ticket as any).verifiedAt = new Date();
  (ticket as any).pendingResolution = "";
  (ticket as any).pendingResolutionType = "";
  await ticket.save();

  // Notify the requester
  const requesterId = String(ticket.requester ?? "");
  if (requesterId) {
    await Notification.create({
      user: requesterId,
      company: user.company,
      type: "info",
      title: "Ticket resolution verified",
      message: `Ticket ${ticket.ticketNumber} resolution has been verified by ${user.name ?? "approver"}.`,
      link: "/it/tickets",
    });
    emitNotification(requesterId);
  }

  return NextResponse.json({ ticket: serializeDoc(ticket) });
}
