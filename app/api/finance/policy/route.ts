import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { effectiveRegionLabelOf, isUserInEffectiveRegion, type OfficeAddressLike } from "@/lib/company-regions";

/**
 * Resolve the policy region for an actor. Regional admins manage their own
 * region's policy; the company owner may target any region (or global "").
 */
async function resolvePolicyRegion(actor: any) {
  const company = (await Company.findById(actor.company)
    .select("owner addresses address")
    .lean()) as {
    owner?: unknown;
    addresses?: OfficeAddressLike[] | null;
    address?: string | null;
  } | null;
  const ownerId = company?.owner ?? null;
  const isOwner = ownerId != null && String(ownerId) === String(actor._id);
  const adminRegion = effectiveRegionLabelOf(company, actor);
  return { company, isOwner, adminRegion };
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus regionLabel");
  if (!actor || !actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  // The actor's own region policy, falling back to the global policy when the
  // region has no policy of its own. The company owner may target any region.
  const { company, isOwner, adminRegion } = await resolvePolicyRegion(actor);
  const requestedRegion = String(new URL(request.url).searchParams.get("region") ?? "").trim();
  const targetRegion = isOwner && requestedRegion ? requestedRegion : adminRegion;
  let policy = await CompanyPolicy.findOne({ company: actor.company, region: targetRegion })
    .populate("foodOptedOutMembers", "name email role")
    .populate("travelOptedOutMembers", "name email role");
  if (!policy && targetRegion) {
    policy = await CompanyPolicy.findOne({ company: actor.company, region: "" })
      .populate("foodOptedOutMembers", "name email role")
      .populate("travelOptedOutMembers", "name email role");
  }

  if (!policy) {
    return NextResponse.json({
      foodAmount: 0,
      travelAccommodationAmount: 0,
      foodOptedOutMembers: [],
      travelOptedOutMembers: [],
      advanceSalaryEnabled: false,
      pfPercentage: 12,
      esicPercentage: 0.75,
      tdsPercentage: 0,
      houseRentPercentage: 37.33,
      conveyancePercentage: 5.92,
      medicalPercentage: 4.63,
      specialAllowancePercentage: 74.33,
    });
  }

  return NextResponse.json({
    foodAmount: policy.foodAmount ?? 0,
    travelAccommodationAmount: policy.travelAccommodationAmount ?? 0,
    foodOptedOutMembers: policy.foodOptedOutMembers ?? [],
    travelOptedOutMembers: policy.travelOptedOutMembers ?? [],
    advanceSalaryEnabled: policy.advanceSalaryEnabled ?? false,
    pfPercentage: policy.pfPercentage ?? 12,
    esicPercentage: policy.esicPercentage ?? 0.75,
    tdsPercentage: policy.tdsPercentage ?? 0,
    houseRentPercentage: policy.houseRentPercentage ?? 37.33,
    conveyancePercentage: policy.conveyancePercentage ?? 5.92,
    medicalPercentage: policy.medicalPercentage ?? 4.63,
    specialAllowancePercentage: policy.specialAllowancePercentage ?? 74.33,
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus regionLabel");
  if (!actor || !actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);
  if (!["finance", "admin"].includes(String(actor.role ?? "")))
    return jsonError("Only finance or admin can configure policies.", 403);

  const body = await request.json();

  // Regional finance/admin may only configure their own region's policy. The
  // company owner may target any region or the global policy.
  const { isOwner, adminRegion } = await resolvePolicyRegion(actor);
  const requestedRegion = String(body.region ?? "").trim();
  let targetRegion = adminRegion;
  if (isOwner && requestedRegion) {
    targetRegion = requestedRegion;
  } else if (!isOwner && requestedRegion && requestedRegion !== adminRegion) {
    return jsonError(`You can only configure policies for your own region (${adminRegion}).`, 403);
  }

  const hasPctFields = "pfPercentage" in body || "esicPercentage" in body || "tdsPercentage" in body;
  if (hasPctFields && String(actor.role) !== "finance") {
    const financeCount = await User.countDocuments({
      company: actor.company,
      role: "finance",
      companyStatus: "approved",
    });
    if (financeCount > 0) {
      return jsonError("Only finance can configure deduction percentages when a finance member exists.", 403);
    }
  }
  const foodAmount = Math.max(0, Number(body.foodAmount ?? 0));
  const travelAccommodationAmount = Math.max(0, Number(body.travelAccommodationAmount ?? 0));

  const update: Record<string, any> = { foodAmount, travelAccommodationAmount };
  if (typeof body.advanceSalaryEnabled === "boolean") {
    update.advanceSalaryEnabled = body.advanceSalaryEnabled;
  }
  if (typeof body.pfPercentage === "number") update.pfPercentage = Math.max(0, body.pfPercentage);
  if (typeof body.esicPercentage === "number") update.esicPercentage = Math.max(0, body.esicPercentage);
  if (typeof body.tdsPercentage === "number") update.tdsPercentage = Math.max(0, body.tdsPercentage);
  if (typeof body.houseRentPercentage === "number") update.houseRentPercentage = Math.max(0, body.houseRentPercentage);
  if (typeof body.conveyancePercentage === "number") update.conveyancePercentage = Math.max(0, body.conveyancePercentage);
  if (typeof body.medicalPercentage === "number") update.medicalPercentage = Math.max(0, body.medicalPercentage);
  if (typeof body.specialAllowancePercentage === "number") update.specialAllowancePercentage = Math.max(0, body.specialAllowancePercentage);

  const policy = await CompanyPolicy.findOneAndUpdate(
    { company: actor.company, region: targetRegion },
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
    pfPercentage: policy.pfPercentage ?? 12,
    esicPercentage: policy.esicPercentage ?? 0.75,
    tdsPercentage: policy.tdsPercentage ?? 0,
    houseRentPercentage: policy.houseRentPercentage ?? 37.33,
    conveyancePercentage: policy.conveyancePercentage ?? 5.92,
    medicalPercentage: policy.medicalPercentage ?? 4.63,
    specialAllowancePercentage: policy.specialAllowancePercentage ?? 74.33,
  });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus name regionLabel");
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
  }).select("_id name email regionLabel");
  if (!member) return jsonError("Member not found in this company.", 404);

  // Regional finance/admin may only manage opt-outs for members in their own
  // region, and only against their region's policy.
  const { company, isOwner, adminRegion } = await resolvePolicyRegion(actor);
  if (!isOwner && adminRegion) {
    if (!isUserInEffectiveRegion(company, adminRegion, member)) {
      return jsonError(`This member is outside your region (${adminRegion}).`, 403);
    }
  }

  let policy = await CompanyPolicy.findOne({ company: actor.company, region: adminRegion });
  if (!policy && adminRegion) {
    policy = await CompanyPolicy.findOne({ company: actor.company, region: "" });
  }
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
    pfPercentage: policy.pfPercentage ?? 12,
    esicPercentage: policy.esicPercentage ?? 0.75,
    tdsPercentage: policy.tdsPercentage ?? 0,
    houseRentPercentage: policy.houseRentPercentage ?? 37.33,
    conveyancePercentage: policy.conveyancePercentage ?? 5.92,
    medicalPercentage: policy.medicalPercentage ?? 4.63,
    specialAllowancePercentage: policy.specialAllowancePercentage ?? 74.33,
    nowOptedOut: !isOptedOut,
  });
}
