import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { CheckOutRequest } from "@/models/CheckOutRequest";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const attendanceId = String((body as any).attendanceId ?? "").trim();
  const reason = String((body as any).reason ?? "").trim();
  const assignedTo = String((body as any).assignedTo ?? "").trim();
  if (!attendanceId) return jsonError("Attendance record ID is required.", 400);
  if (!reason) return jsonError("Reason is required.", 400);

  try {
    await connectDb();
  } catch (error) {
    return jsonError("Database unavailable", 500);
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const attendance = await Attendance.findOne({
    _id: attendanceId,
    user: userId,
  });
  if (!attendance) return jsonError("Attendance record not found.", 404);
  if (attendance.checkOut) return jsonError("Already checked out for this day.", 400);

  const checkInTime = new Date(attendance.checkIn).getTime();
  const requestedCheckOut = new Date(checkInTime + 8 * 60 * 60 * 1000);

  const existing = await CheckOutRequest.findOne({
    requester: userId,
    attendance: attendanceId,
    status: "pending",
  });
  if (existing) return jsonError("Already requested check-out for this record.", 400);

  const checkOutRequestData: any = {
    requester: userId,
    attendance: attendanceId,
    company: user.company,
    date: attendance.date,
    requestedCheckOut,
    reason,
    status: "pending",
  };
  if (assignedTo) {
    checkOutRequestData.assignedTo = assignedTo;
  }

  const checkOutRequest = await CheckOutRequest.create(checkOutRequestData);

  const requesterName = user.name || "A member";

  if (assignedTo) {
    const assignedFinance = await User.findById(assignedTo).select("_id");
    if (assignedFinance) {
      await Notification.create({
        user: assignedFinance._id,
        company: user.company,
        type: "approval" as const,
        title: "Check-Out Request",
        body: `${requesterName} requested a check-out for ${new Date(attendance.date).toLocaleDateString()}. Reason: ${reason} (Assigned to you)`,
        link: "/profile?tab=attendance",
      });
      emitNotification(String(assignedFinance._id));
    }
  } else {
    const financeUsers = await User.find({
      company: user.company,
      companyStatus: "approved",
      role: "finance",
    }).select("_id");

    const notifications = financeUsers.map((financeUser: any) => ({
      user: financeUser._id,
      company: user.company,
      type: "approval" as const,
      title: "Check-Out Request",
      body: `${requesterName} requested a check-out for ${new Date(attendance.date).toLocaleDateString()}. Reason: ${reason}`,
      link: "/profile?tab=attendance",
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      financeUsers.forEach((financeUser: any) => emitNotification(String(financeUser._id)));
    }
  }

  return NextResponse.json({ checkOutRequest });
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    return jsonError("Database unavailable", 500);
  }

  const user = await User.findById(userId).select("role company companyStatus");
  if (!user) return jsonError("User not found.", 404);

  const role = String(user.role ?? "");
  const isFinanceOrAdmin = role === "finance" || role === "admin";

  let requests;
  if (isFinanceOrAdmin && user.company) {
    requests = await CheckOutRequest.find({ company: user.company })
      .populate("requester", "name email")
      .populate("attendance", "checkIn checkOut date")
      .sort({ createdAt: -1 });
  } else {
    requests = await CheckOutRequest.find({ requester: userId })
      .populate("attendance", "checkIn checkOut date")
      .sort({ createdAt: -1 });
  }

  return NextResponse.json({ requests });
}
