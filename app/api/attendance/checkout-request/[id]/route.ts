import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { actingRoleForRequest } from "@/lib/delegation-access";
import { CheckOutRequest } from "@/models/CheckOutRequest";
import { Company } from "@/models/Company";
import { Attendance } from "@/models/Attendance";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String((body as any).action ?? "");
  const rejectionReason = String((body as any).rejectionReason ?? "").trim();

  if (action !== "approve" && action !== "reject") {
    return jsonError("Action must be 'approve' or 'reject'.", 400);
  }
  if (action === "reject" && !rejectionReason) {
    return jsonError("Rejection reason is required.", 400);
  }

  try {
    await connectDb();
  } catch {
    return jsonError("Database unavailable", 500);
  }

  const actor = await User.findById(userId);
  if (!actor) return jsonError("User not found.", 404);
  const role = await actingRoleForRequest({
    userId,
    request,
    realRole: String(actor.role ?? ""),
    featureKeys: ["finance-checkout-requests"],
  });
  if (role !== "finance" && role !== "admin") {
    return jsonError("Only finance or admin can approve check-out requests.", 403);
  }
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const checkOutRequest = await CheckOutRequest.findById(id).populate("requester", "name email");
  if (!checkOutRequest) return jsonError("Request not found.", 404);
  if (checkOutRequest.status !== "pending") return jsonError("Request already processed.", 400);

  // Verification step
  const delegationId = (await import("@/lib/delegation-access")).delegationIdFromRequest(request);
  if (delegationId && (action === "approve" || action === "reject")) {
    const delegation = await (await import("@/lib/delegation-access")).delegationForFeature(userId, delegationId, "finance-checkout-requests");
    if (delegation && (delegation as any).requiresVerification) {
      (checkOutRequest as any).verificationStatus = "pending-verification";
      (checkOutRequest as any).submittedBy = userId;
      (checkOutRequest as any).authorizer = (delegation as any).authorizer;
      (checkOutRequest as any).pendingAction = action;
      await checkOutRequest.save();
      const authorizerId = String((delegation as any).authorizer);
      await Notification.create({
        user: authorizerId,
        company: actor.company,
        type: "approval",
        title: "Checkout Request Pending Verification",
        message: `${actor.name ?? "Finance"} submitted a checkout ${action} for your verification.`,
        link: "/profile/attendance",
      });
      emitNotification(authorizerId);
      return NextResponse.json({ checkOutRequest });
    }
  }

  if (action === "approve") {
    const attendance = await Attendance.findById(checkOutRequest.attendance);
    if (!attendance) return jsonError("Attendance record not found.", 404);

    const statusType = String((body as any).statusType ?? "present");
    const checkInTime = new Date(attendance.checkIn).getTime();
    let checkOutTime: Date;

    if (statusType === "absent") {
      checkOutTime = new Date(checkInTime);
    } else if (statusType === "halfDay") {
      const companyRec = await Company.findById(actor.company);
      const minWorkHours = companyRec?.minWorkHours ?? 8;
      const halfDayHours = minWorkHours / 2;
      checkOutTime = new Date(checkInTime + halfDayHours * 60 * 60 * 1000);
    } else {
      checkOutTime = new Date(checkInTime + 8 * 60 * 60 * 1000);
    }

    attendance.checkOut = checkOutTime;
    await attendance.save();

    checkOutRequest.status = "approved";
    checkOutRequest.approvedBy = actor._id;
    await checkOutRequest.save();

    const requesterId = String((checkOutRequest.requester as any)._id ?? checkOutRequest.requester);
    const statusLabel = statusType === "absent" ? "Absent" : statusType === "halfDay" ? "Half-Day" : "Present";
    await Notification.create({
      user: requesterId,
      company: actor.company,
      type: "info",
      title: "Check-Out Approved",
      body: `Your check-out request for ${new Date(checkOutRequest.date).toLocaleDateString()} has been approved. Status: ${statusLabel}.`,
      link: "/profile?tab=attendance",
    });
    emitNotification(requesterId);
  } else {
    checkOutRequest.status = "rejected";
    checkOutRequest.approvedBy = actor._id;
    checkOutRequest.rejectionReason = rejectionReason;
    await checkOutRequest.save();

    const requesterId = String((checkOutRequest.requester as any)._id ?? checkOutRequest.requester);
    await Notification.create({
      user: requesterId,
      company: actor.company,
      type: "info",
      title: "Check-Out Request Rejected",
      body: `Your check-out request for ${new Date(checkOutRequest.date).toLocaleDateString()} was rejected. Reason: ${rejectionReason}`,
      link: "/profile?tab=attendance",
    });
    emitNotification(requesterId);
  }

  return NextResponse.json({ checkOutRequest });
}
