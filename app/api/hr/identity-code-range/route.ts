import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { identityCodeRegionsOf } from "@/lib/company-identity";
import { mainOfficeLabelOf } from "@/lib/company-regions";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus name");
  if (!user) return jsonError("User not found.", 404);
  const isAdmin = user.role === "admin" && String(user.company ?? "").length > 0;
  const isHr = user.role === "human-resource" && user.companyStatus === "approved" && Boolean(user.company);
  if (!isAdmin && !isHr) {
    return jsonError("Only HR or admin can request an identity code range increase.", 403);
  }

  const company = await Company.findById(user.company).select(
    "identityCodeRegions identityCodeDigits identityCodeStartRange identityCodeEndRange addresses address multiOffice",
  );
  if (!company) return jsonError("Company not found.", 404);

  const body = await request.json().catch(() => ({}));
  const regionName = String(body.region ?? "").trim();
  const newEndRange = Number(body.newEndRange ?? 0);

  const regions = identityCodeRegionsOf(company as any);
  const target = regions.find(
    (r) => String(r.region).trim().toLowerCase() === regionName.toLowerCase(),
  );
  if (!target) {
    return jsonError(`Region "${regionName}" is not partitioned in your identity code ranges.`, 400);
  }

  if (!Number.isFinite(newEndRange) || newEndRange <= target.endRange) {
    return jsonError("New end range must be greater than the current region end range.", 400);
  }

  const masterEnd = company.identityCodeEndRange;
  const digits = company.identityCodeDigits;
  const capacity = digits != null ? Math.pow(10, digits) - 1 : null;
  if (masterEnd != null && newEndRange > masterEnd) {
    return jsonError(`New end range exceeds the company master end range (${masterEnd}).`, 400);
  }
  if (capacity != null && newEndRange > capacity) {
    return jsonError(`New end range exceeds the ${digits}-digit capacity (${capacity}).`, 400);
  }

  const sorted = [...regions].sort((a, b) => a.startRange - b.startRange);
  const pos = sorted.findIndex((r) => r === target);
  const nextRegion = pos !== -1 ? sorted[pos + 1] : undefined;
  if (nextRegion && nextRegion.startRange <= newEndRange) {
    return jsonError(
      `New end range overlaps region "${nextRegion.region}" (starts at ${nextRegion.startRange}).`,
      400,
    );
  }

  const duplicate = await JoinRequest.findOne({
    requester: userId,
    company: user.company,
    kind: "identity-code-range",
    status: "pending",
    "metadata.region": target.region,
  }).select("_id");
  if (duplicate) {
    return jsonError("You already have a pending range increase request for this region.", 409);
  }

  const mainLabel = mainOfficeLabelOf({ addresses: (company as any).addresses, address: (company as any).address });
  let approver: { _id: unknown; name?: string } | null = null;

  if (mainLabel) {
    approver = await User.findOne({
      company: user.company,
      role: "human-resource",
      companyStatus: "approved",
      regionLabel: { $regex: `^${mainLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    })
      .select("_id name")
      .sort({ createdAt: 1 });
  }
  if (!approver) {
    approver = await User.findOne({
      company: user.company,
      role: "admin",
      companyStatus: "approved",
    })
      .select("_id name")
      .sort({ createdAt: 1 });
  }
  if (!approver) {
    approver = await User.findOne({
      company: user.company,
      role: "human-resource",
      companyStatus: "approved",
    })
      .select("_id name")
      .sort({ createdAt: 1 });
  }

  if (!approver) {
    return jsonError("No main-office HR or admin is available to approve range increases.", 404);
  }

  const joinRequest = await JoinRequest.create({
    requester: userId,
    approver: approver._id,
    company: user.company,
    kind: "identity-code-range",
    status: "pending",
    metadata: {
      region: target.region,
      currentEndRange: target.endRange,
      newEndRange,
      requesterName: user.name ?? "",
    },
  });

  await Notification.create({
    user: approver._id,
    company: user.company,
    type: "approval",
    title: "Identity code range increase request",
    message: `${String(user.name ?? "A member")} requested to extend the identity code range for "${target.region}" to ${newEndRange}.`,
  });
  emitNotification(String(approver._id));

  return NextResponse.json({
    requestId: String(joinRequest._id),
    approverName: String(approver.name ?? ""),
    status: "pending",
  });
}