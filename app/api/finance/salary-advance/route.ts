import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { emitNotification } from "@/lib/realtime";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select(
    "name role company companyStatus baseSalary",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  const policy = await CompanyPolicy.findOne({ company: user.company }).select("advanceSalaryEnabled");
  if (!policy?.advanceSalaryEnabled)
    return jsonError("Advance salary is not enabled by your finance team.", 403);

  const body = await req.json();
  const advanceAmount = Math.max(0, Number(body.advanceAmount ?? 0));
  if (advanceAmount <= 0)
    return jsonError("Advance amount must be greater than 0.", 400);

  const reason = String(body.reason ?? "").trim();
  if (!reason)
    return jsonError("Reason is required for advance salary request.", 400);

  const repayInMonths = Math.max(1, Math.min(12, Number(body.repayInMonths ?? 1)));

  const existing = await JoinRequest.findOne({
    requester: userId,
    company: user.company,
    kind: "salary-advance",
    status: "pending",
  });
  if (existing)
    return jsonError("You already have a pending advance salary request.", 400);

  const approverId = String(body.approverId ?? "").trim();
  if (!approverId)
    return jsonError("Approver is required.", 400);

  const approver = await User.findOne({
    _id: approverId,
    company: user.company,
    companyStatus: "approved",
  }).select("_id role");
  if (!approver)
    return jsonError("Selected approver not found in your company.", 400);

  if (String(approver._id) === String(user._id))
    return jsonError("You cannot approve your own request.", 400);

  if (!approverId)
    return jsonError("No approver available for your company.", 400);

  const request = await JoinRequest.create({
    requester: userId,
    approver: approverId,
    company: user.company,
    kind: "salary-advance",
    status: "pending",
    metadata: {
      advanceAmount,
      reason,
      repayInMonths,
      repaymentPerMonth: Math.round(advanceAmount / repayInMonths),
      requestedDate: new Date(),
    },
  });

  await Notification.create({
    user: approverId,
    company: user.company,
    type: "approval",
    title: "Salary advance request",
    message: `${user.name ?? "An employee"} requested a salary advance of ₹${advanceAmount.toLocaleString("en-IN")}. Reason: ${reason}`,
  });
  emitNotification(String(approverId));

  return NextResponse.json({
    ok: true,
    requestId: String(request._id),
  });
}
