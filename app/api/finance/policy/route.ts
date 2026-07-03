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
    .populate("foodOptedOutMembers", "name email role")
    .populate("travelOptedOutMembers", "name email role");

  if (!policy) {
    return NextResponse.json({
      foodAmount: 0,
      travelAccommodationAmount: 0,
      foodOptedOutMembers: [],
      travelOptedOutMembers: [],
      advanceSalaryEnabled: false,
    });
  }

  return NextResponse.json({
    foodAmount: policy.foodAmount ?? 0,
    travelAccommodationAmount: policy.travelAccommodationAmount ?? 0,
    foodOptedOutMembers: policy.foodOptedOutMembers ?? [],
    travelOptedOutMembers: policy.travelOptedOutMembers ?? [],
    advanceSalaryEnabled: policy.advanceSalaryEnabled ?? false,
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);
  if (!["finance", "admin"].includes(String(actor.role ?? "")))
    return jsonError("Only finance or admin can configure policies.", 403);

  const body = await request.json();
  const foodAmount = Math.max(0, Number(body.foodAmount ?? 0));
  const travelAccommodationAmount = Math.max(0, Number(body.travelAccommodationAmount ?? 0));

  const update: Record<string, any> = { foodAmount, travelAccommodationAmount };
  if (typeof body.advanceSalaryEnabled === "boolean") {
    update.advanceSalaryEnabled = body.advanceSalaryEnabled;
  }

  const policy = await CompanyPolicy.findOneAndUpdate(
    { company: actor.company },
    { $set: update },
    { new: true, upsert: true },
  );

  const allMembers = await User.find({
    company: actor.company,
    companyStatus: "approved",
  }).select("_id");
  const messages: string[] = [];
  if (foodAmount > 0) messages.push(`Food allowance: ₹${foodAmount}`);
  if (travelAccommodationAmount > 0) messages.push(`Travel accommodation: ₹${travelAccommodationAmount}`);
  if (messages.length > 0) {
    await Notification.insertMany(
      allMembers.map((m) => ({
        user: m._id,
        company: actor.company,
        type: "info",
        title: "Company policies updated",
        message: `Finance has set the following deductions: ${messages.join(", ")}. Opt in/out from the Finance tab.`,
      })),
    );
    allMembers.forEach((m) => emitNotification(String(m._id)));
  }

  return NextResponse.json({
    foodAmount: policy.foodAmount ?? 0,
    travelAccommodationAmount: policy.travelAccommodationAmount ?? 0,
    foodOptedOutMembers: policy.foodOptedOutMembers ?? [],
    travelOptedOutMembers: policy.travelOptedOutMembers ?? [],
    advanceSalaryEnabled: policy.advanceSalaryEnabled ?? false,
  });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus name");
  if (!actor || !actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  const body = await request.json();
  const targetMemberId = String(body.memberId ?? "");
  if (!targetMemberId) return jsonError("Member ID is required.", 400);

  const type = String(body.type ?? "");
  if (!["food", "travel"].includes(type))
    return jsonError("Type must be 'food' or 'travel'.", 400);

  const member = await User.findOne({
    _id: targetMemberId,
    company: actor.company,
    companyStatus: "approved",
  }).select("_id name email");
  if (!member) return jsonError("Member not found in this company.", 404);

  const policy = await CompanyPolicy.findOne({ company: actor.company });
  if (!policy) return jsonError("No policy configured yet.", 404);

  const field = type === "food" ? "foodOptedOutMembers" : "travelOptedOutMembers";
  const arr = policy[field] ?? [];
  const isOptedOut = arr.some((id: any) => String(id) === targetMemberId);

  if (isOptedOut) {
    policy[field] = arr.filter((id: any) => String(id) !== targetMemberId);
  } else {
    if (!Array.isArray(policy[field])) policy[field] = [];
    policy[field].push(member._id);
  }

  await policy.save();

  // Notify all finance/admin users in the company
  const financeUsers = await User.find({
    company: actor.company,
    companyStatus: "approved",
    role: { $in: ["finance", "admin"] },
  }).select("_id");
  const action = isOptedOut ? "opted in" : "opted out";
  const label = type === "food" ? "Food Allowance" : "Travel Accommodation";
  const memberName = String((member as any).name ?? "A member");
  const notifications = financeUsers
    .filter((fu) => String(fu._id) !== String(actor._id))
    .map((fu) => ({
      user: fu._id,
      company: actor.company,
      type: "info" as const,
      title: "Policy opt-out updated",
      message: `${memberName} has ${action} of ${label} deductions.`,
    }));
  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
    financeUsers
      .filter((fu) => String(fu._id) !== String(actor._id))
      .forEach((fu) => emitNotification(String(fu._id)));
  }

  return NextResponse.json({
    foodAmount: policy.foodAmount ?? 0,
    travelAccommodationAmount: policy.travelAccommodationAmount ?? 0,
    foodOptedOutMembers: policy.foodOptedOutMembers ?? [],
    travelOptedOutMembers: policy.travelOptedOutMembers ?? [],
    advanceSalaryEnabled: policy.advanceSalaryEnabled ?? false,
    nowOptedOut: !isOptedOut,
  });
}
