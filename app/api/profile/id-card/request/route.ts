import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

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

  const user = await User.findById(userId).select("name email role company companyStatus phone avatarUrl bloodGroup emergencyContact regionLabel companyIdentityCode");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") return jsonError("You must belong to an approved company.", 403);

  const body = await request.json();
  const adminId = String(body.adminId ?? "").trim();
  if (!adminId) return jsonError("Please select an HR to send the request to.", 400);

  const admin = await User.findOne({ _id: adminId, company: user.company, role: "human-resource", companyStatus: "approved" }).select("_id name");
  if (!admin) return jsonError("Selected HR not found.", 404);

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const existing = await JoinRequest.findOne({
    requester: userId,
    company: companyId,
    kind: "id-card",
    status: "pending",
  });
  if (existing) return jsonError("You already have a pending ID card request.", 400);

  const existingApproved = await JoinRequest.findOne({
    requester: userId,
    company: companyId,
    kind: "id-card",
    status: "approved",
  });
  if (existingApproved) return jsonError("Your ID card request is already approved.", 400);

  const joinRequest = await JoinRequest.create({
    requester: userId,
    approver: admin._id,
    company: companyId,
    kind: "id-card",
    status: "pending",
    metadata: {
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      userPhone: user.phone,
      userAvatar: user.avatarUrl,
      userBloodGroup: user.bloodGroup,
      userEmergencyContact: user.emergencyContact,
      userRegionLabel: user.regionLabel,
      userIdentityCode: user.companyIdentityCode,
    },
  });

  await Notification.create({
    user: admin._id,
    company: companyId,
    type: "approval",
    title: "ID Card Request",
    message: `${user.name} has requested an ID card.`,
  });
  emitNotification(String(admin._id));

  return NextResponse.json({ requestId: String(joinRequest._id), status: "submitted" });
}
