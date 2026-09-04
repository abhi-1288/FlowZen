import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITProvisioningRequest } from "@/models/ITProvisioningRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { canManageIt, pushProvisioningActivity } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid request id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select(
    "role company companyStatus name isSeniorSecurity",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to view this request.", 403);
  }
  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;
  const role = String(actor.role);

  const req = await ITProvisioningRequest.findOne({ _id: id, company: companyId })
    .populate("employee", "name email")
    .populate("createdBy", "name email")
    .populate("manager", "name email")
    .populate("createdAccountUserId", "name email")
    .populate("reviewedBy", "name");
  if (!req) return jsonError("Provisioning request not found.", 404);

  const isHr = role === "human-resource" || role === "admin";
  const isIt = canManageIt(role, Boolean(actor.isSeniorSecurity)) || role === "it-administration";
  if (!isHr && !isIt) {
    return jsonError("You do not have permission to view this request.", 403);
  }
  // HR only sees their own.
  if (role === "human-resource" && String(req.createdBy) !== userId) {
    return jsonError("You do not have permission to view this request.", 403);
  }

  return NextResponse.json({ request: serializeDoc(req) });
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid request id.", 400);
  const body = await request.json();
  const action = String(body.action ?? "").trim().toLowerCase();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select(
    "role company companyStatus name isSeniorSecurity",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to review provisioning requests.", 403);
  }
  if (!canManageIt(String(actor.role), Boolean(actor.isSeniorSecurity))) {
    return jsonError("Only IT admins can review provisioning requests.", 403);
  }
  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;

  const req = await ITProvisioningRequest.findOne({ _id: id, company: companyId });
  if (!req) return jsonError("Provisioning request not found.", 404);

  if (action === "approve") {
    if (req.status === "APPROVED" || req.status === "ACCOUNT_CREATED" || req.status === "COMPLETED") {
      return jsonError(`Request is already ${req.status}.`, 400);
    }
    req.status = "APPROVED";
    req.reviewedBy = actor._id;
    req.reviewedAt = new Date();
    pushProvisioningActivity(
      req,
      { _id: actor._id },
      "Approved",
      `Approved by ${actor.name}`,
    );
  } else if (action === "reject") {
    const reason = String(body.reason ?? "").trim();
    if (!reason) return jsonError("Rejection reason is required.");
    if (req.status === "REJECTED") return jsonError("Request is already rejected.", 400);
    req.status = "REJECTED";
    req.rejectionReason = reason;
    req.reviewedBy = actor._id;
    req.reviewedAt = new Date();
    pushProvisioningActivity(req, { _id: actor._id }, "Rejected", `Rejected by ${actor.name}: ${reason}`);
  } else {
    return jsonError("Invalid action.", 400);
  }

  await req.save();

  const createdBy = String(req.createdBy ?? "");
  if (createdBy && createdBy !== userId) {
    await Notification.create({
      user: createdBy,
      company: companyId,
      type: "info",
      title: "Provisioning request updated",
      message: `${req.employeeName}'s provisioning request was ${action}d.`,
    });
    emitNotification(createdBy);
  }

  const refreshed = await ITProvisioningRequest.findById(id)
    .populate("employee", "name email")
    .populate("createdBy", "name")
    .populate("manager", "name");
  return NextResponse.json({ request: serializeDoc(refreshed) });
}