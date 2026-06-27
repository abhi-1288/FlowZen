import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
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
  const role = String(actor.role ?? "");
  if (role !== "finance" && role !== "admin") {
    return jsonError("Only finance or admin can approve check-out requests.", 403);
  }
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const checkOutRequest = await CheckOutRequest.findById(id).populate("requester", "name email");
  if (!checkOutRequest) return jsonError("Request not found.", 404);
  if (checkOutRequest.status !== "pending") return jsonError("Request already processed.", 400);

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
