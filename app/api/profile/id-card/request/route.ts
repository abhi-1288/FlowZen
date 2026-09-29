import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { resolveSeniorSecurityApprover, findApprovedApproverIdForRequester, requesterRegionScope } from "@/lib/join-approvers";
import { DOCUMENT_LETTER_APPROVER_ROLES, isUserInRegion } from "@/lib/company-regions";

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

  const user = await User.findById(userId).select("name email role company companyStatus phone avatarUrl bloodGroup emergencyContact regionLabel companyIdentityCode companyJoined createdAt membershipHistory");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") return jsonError("You must belong to an approved company.", 403);

  const body = await request.json();
  const adminId = String(body.adminId ?? "").trim();
  if (!adminId) return jsonError("Please select an HR to send the request to.", 400);

  const isJuniorRequester = String(user.role) === "security" && !Boolean((user as any).isSeniorSecurity);
  const approverFilter: Record<string, unknown> = {
    _id: adminId,
    company: user.company,
    companyStatus: "approved",
  };
  if (isJuniorRequester) {
    approverFilter.$or = [
      { role: { $in: [...DOCUMENT_LETTER_APPROVER_ROLES] } },
      { role: "security", isSeniorSecurity: true },
    ];
  } else {
    approverFilter.role = { $in: [...DOCUMENT_LETTER_APPROVER_ROLES] };
  }

  const admin = await User.findOne(approverFilter).select("_id name role regionLabel isSeniorSecurity");
  if (!admin) return jsonError("Selected approver not found.", 404);

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  // Region enforcement, mirroring the document letter flow: reject an
  // out-of-region approver, but only when the requester's region has one.
  const { region: requesterRegion, clause: regionClause, company: regionCompany } =
    await requesterRegionScope(companyId, user);
  if (regionClause && !isUserInRegion(regionCompany, requesterRegion, admin)) {
    const regionHasApprover = await findApprovedApproverIdForRequester({
      companyId,
      roles: DOCUMENT_LETTER_APPROVER_ROLES,
      regionClause,
    });
    if (regionHasApprover) {
      return jsonError(
        requesterRegion
          ? `Selected approver is not in your region (${requesterRegion}).`
          : "Selected approver is not in your region.",
        400,
      );
    }
  }

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

  // Junior security ID card requests go to senior security (unless they already picked one)
  let approverId = String(admin._id);
  const selectedIsSeniorSecurity = String(admin.role) === "security" && Boolean((admin as any).isSeniorSecurity);
  if (!selectedIsSeniorSecurity) {
    const ssApproverId = await resolveSeniorSecurityApprover(userId, companyId, null);
    if (ssApproverId) {
      approverId = ssApproverId;
    }
  }

  const joinRequest = await JoinRequest.create({
    requester: userId,
    approver: approverId,
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
      userJoiningDate:
        user.companyJoined ||
        (Array.isArray(user.membershipHistory)
          ? (user.membershipHistory as Array<Record<string, unknown>>).find(
              (m) => String(m?.action ?? "") === "joined-company",
            )?.at
          : null) ||
        user.createdAt,
    },
  });

  await Notification.create({
    user: approverId,
    company: companyId,
    type: "approval",
    title: "ID Card Request",
    message: `${user.name} has requested an ID card.`,
  });
  emitNotification(String(admin._id));

  return NextResponse.json({ requestId: String(joinRequest._id), status: "submitted" });
}
