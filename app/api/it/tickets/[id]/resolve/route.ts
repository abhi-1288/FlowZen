import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITTicket } from "@/models/ITTicket";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { isItStaff, pushItActivity } from "@/lib/it";
import { actingRoleForRequest } from "@/lib/delegation-access";

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

  const actor = await User.findById(userId).select("role company companyStatus name");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to resolve IT tickets.", 403);
  }
  const actingRole = await actingRoleForRequest({
    userId,
    request,
    realRole: String(actor.role ?? ""),
    featureKeys: ["it-tickets"],
  });
  if (!isItStaff(actingRole)) {
    return jsonError("Only IT staff can resolve IT tickets.", 403);
  }
  if (!RESOLUTION_TYPES.has(resolutionType)) return jsonError("Invalid resolution type.", 400);

  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;
  const ticket = await ITTicket.findOne({ _id: id, company: companyId });
  if (!ticket) return jsonError("Ticket not found.", 404);
  if (ticket.status !== "IN_PROGRESS" && ticket.status !== "WAITING_FOR_USER" && ticket.status !== "QUEUED" && ticket.status !== "ASSIGNED") {
    return jsonError(`Cannot resolve ticket from status ${ticket.status}.`, 400);
  }
  const isAssigned = ticket.assignedTo ? String(ticket.assignedTo) === userId : false;
  if (actingRole !== "it-admin" && !isAssigned) {
    return jsonError("You can only resolve tickets assigned to you.", 403);
  }

  // Verification step: when a delegated recipient resolves and the delegation
  // requires verification, defer to the authorizer.
  const delegationId = (await import("@/lib/delegation-access")).delegationIdFromRequest(request);
  if (delegationId) {
    const delegation = await (await import("@/lib/delegation-access")).delegationForFeature(userId, delegationId, "it-tickets");
    if (delegation && (delegation as any).requiresVerification) {
      (ticket as any).verificationStatus = "pending-verification";
      (ticket as any).submittedBy = userId;
      (ticket as any).authorizer = (delegation as any).authorizer;
      (ticket as any).pendingResolution = resolution;
      (ticket as any).pendingResolutionType = resolutionType;
      await ticket.save();
      const authorizerId = String((delegation as any).authorizer);
      const { Notification } = await import("@/models/Notification");
      const { emitNotification } = await import("@/lib/realtime");
      await (Notification as any).create({
        user: authorizerId,
        company: companyId,
        type: "approval",
        title: "IT Ticket Pending Verification",
        message: `${actor.name ?? "IT staff"} submitted a resolution for ticket ${ticket.ticketNumber} for your verification.`,
        link: "/it/tickets",
      });
      (emitNotification as any)(authorizerId);
      return NextResponse.json({ ticket: serializeDoc(ticket), deferred: true });
    }
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

  const refreshed = await ITTicket.findOne({ _id: id, company: companyId });
  return NextResponse.json({ ticket: serializeDoc(refreshed) });
}
