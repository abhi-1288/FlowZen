import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { User } from "@/models/User";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  const policy = await CompanyPolicy.findOne({ company: actor.company })
    .populate("salaryCycleChangeRequestedBy", "name email")
    .populate("salaryCycleChangeApprover", "name email");

  return NextResponse.json({
    salaryCycleDay: policy?.salaryCycleDay ?? 29,
    pendingSalaryCycleDay: policy?.pendingSalaryCycleDay ?? null,
    salaryCycleStartDay: policy?.salaryCycleStartDay ?? null,
    salaryCycleEndDay: policy?.salaryCycleEndDay ?? null,
    pendingSalaryCycleStartDay: policy?.pendingSalaryCycleStartDay ?? null,
    pendingSalaryCycleEndDay: policy?.pendingSalaryCycleEndDay ?? null,
    salaryCycleChangeStatus: policy?.salaryCycleChangeStatus ?? null,
    salaryCycleChangeRequestedBy: policy?.salaryCycleChangeRequestedBy ?? null,
    salaryCycleChangeApprover: policy?.salaryCycleChangeApprover ?? null,
    salaryCycleChangeRequestedAt: policy?.salaryCycleChangeRequestedAt ?? null,
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await User.findById(userId).select("name role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);
  if (String(actor.role) !== "finance")
    return jsonError("Only finance can propose salary cycle changes.", 403);

  const body = await request.json();
  const newSalaryCycleStartDay = Math.max(1, Math.min(31, Math.floor(Number(body.salaryCycleStartDay ?? 0))));
  const newSalaryCycleEndDay = Math.max(1, Math.min(31, Math.floor(Number(body.salaryCycleEndDay ?? 0))));
  
  if (newSalaryCycleStartDay < 1 || newSalaryCycleStartDay > 31)
    return jsonError("Salary cycle start day must be between 1 and 31.", 400);
  if (newSalaryCycleEndDay < 1 || newSalaryCycleEndDay > 31)
    return jsonError("Salary cycle end day must be between 1 and 31.", 400);
  
  if (newSalaryCycleStartDay <= newSalaryCycleEndDay)
    return jsonError("Start day (last month date) must be greater than End day (current month date).", 400);

  const assignedAdminId = String(body.assignedAdminId ?? "");
  if (!assignedAdminId)
    return jsonError("Please assign an admin to approve this change.", 400);

  const targetAdmin = await User.findOne({
    _id: assignedAdminId,
    company: actor.company,
    role: "admin",
    companyStatus: "approved",
  }).select("_id name");
  if (!targetAdmin)
    return jsonError("Selected admin is not available for this company.", 400);

  const policy = await CompanyPolicy.findOneAndUpdate(
    { company: actor.company },
    {
      $set: {
        pendingSalaryCycleStartDay: newSalaryCycleStartDay,
        pendingSalaryCycleEndDay: newSalaryCycleEndDay,
        salaryCycleChangeStatus: "pending",
        salaryCycleChangeRequestedBy: userId,
        salaryCycleChangeApprover: targetAdmin._id,
        salaryCycleChangeRequestedAt: new Date(),
      },
    },
    { new: true, upsert: true },
  );

  await Notification.create({
    user: targetAdmin._id,
    company: actor.company,
    type: "approval",
    title: "Salary cycle change pending approval",
    message: `${actor.name ?? "Finance"} proposed changing the salary cycle to ${newSalaryCycleStartDay} - ${newSalaryCycleEndDay}. Please review and approve.`,
  });
  emitNotification(String(targetAdmin._id));

  return NextResponse.json({
    salaryCycleDay: policy.salaryCycleDay ?? 29,
    pendingSalaryCycleDay: policy.pendingSalaryCycleDay,
    salaryCycleStartDay: policy.salaryCycleStartDay,
    salaryCycleEndDay: policy.salaryCycleEndDay,
    pendingSalaryCycleStartDay: policy.pendingSalaryCycleStartDay,
    pendingSalaryCycleEndDay: policy.pendingSalaryCycleEndDay,
    salaryCycleChangeStatus: policy.salaryCycleChangeStatus,
    salaryCycleChangeRequestedBy: policy.salaryCycleChangeRequestedBy,
    salaryCycleChangeApprover: policy.salaryCycleChangeApprover,
    salaryCycleChangeRequestedAt: policy.salaryCycleChangeRequestedAt,
  });
}
