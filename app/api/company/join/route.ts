import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { findApprovedHrUserIdByInviteSuffix, resolveCompanyJoinApproverId, stripHrInviteSuffix } from "@/lib/join-approvers";

function roleForCompanyCode(company: any, code: string, baseCode: string) {
  const matches = (stored: unknown) => {
    const value = String(stored ?? "").toUpperCase();
    if (!value) return false;
    return code === value || baseCode === value || code.startsWith(`${value}-HR`);
  };

  if (matches(company.adminJoinCode)) return "admin";
  if (matches(company.managerJoinCode)) return "project-manager";
  if (matches(company.testerJoinCode)) return "qa-tester";
  if (matches(company.financeJoinCode)) return "finance";
  if (matches(company.employeeJoinCode)) return "employee";
  if (matches(company.otherJoinCode)) return "others";
  if (matches(company.hrJoinCode) || matches(company.joinCode)) return "human-resource";
  return null;
}

function joinTitleForRole(role: string) {
  if (role === "admin") return "Admin join request";
  if (role === "human-resource") return "HR join request";
  if (role === "project-manager") return "Manager join request";
  if (role === "qa-tester") return "Tester join request";
  if (role === "finance") return "Finance join request";
  if (role === "employee") return "Employee join request";
  return "Others join request";
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const rawCode = String(body.code ?? "").trim().toUpperCase();
  if (!rawCode) return jsonError("Company code is required.");
  const { baseCode: withoutHrSuffix, hrSuffix } = stripHrInviteSuffix(rawCode);
  const isSuffixedCompanyCode = /^CO-.+-\d+$/.test(withoutHrSuffix);
  const baseCode = isSuffixedCompanyCode ? withoutHrSuffix.replace(/-\d+$/, "") : withoutHrSuffix;

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, company] = await Promise.all([
    User.findById(userId),
    Company.findOne({
      $or: [
        { joinCode: withoutHrSuffix },
        { joinCode: baseCode },
        { hrJoinCode: withoutHrSuffix },
        { managerJoinCode: withoutHrSuffix },
        { testerJoinCode: withoutHrSuffix },
        { financeJoinCode: withoutHrSuffix },
        { employeeJoinCode: withoutHrSuffix },
        { otherJoinCode: withoutHrSuffix },
        { adminJoinCode: withoutHrSuffix },
      ]
    })
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!company) return jsonError("Invalid company code.", 404);
  const codeRole = roleForCompanyCode(company, rawCode, baseCode);
  if (!codeRole) return jsonError("Invalid company code.", 404);
  if (String(user.role) !== codeRole) {
    return jsonError(`This company code is for ${joinTitleForRole(codeRole).replace(" join request", "")} role users.`, 403);
  }
  const isAlreadyMember = company.members?.some((memberId: { toString: () => string }) => String(memberId) === userId);
  if (isAlreadyMember || (String(user.company ?? "") === String(company._id) && user.companyStatus === "approved")) {
    return NextResponse.json({ status: "joined" });
  }

  const existingPendingRequest = await JoinRequest.findOne({
    requester: userId,
    company: company._id,
    kind: "company",
    status: "pending"
  });
  const invitedHrId =
    hrSuffix && ["project-manager", "qa-tester", "finance", "employee", "others"].includes(codeRole)
      ? await findApprovedHrUserIdByInviteSuffix(company._id, hrSuffix)
      : null;
  const approverId = invitedHrId ?? (await resolveCompanyJoinApproverId(company, codeRole));
  const approvalNotifier: "hr" | "admin" =
    codeRole === "admin" ? "admin" :
    approverId === String(company.owner) ? "admin" : "hr";
  const enrollingHrId =
    invitedHrId ?? (codeRole !== "admin" && approvalNotifier === "hr" ? approverId : null);

  if (existingPendingRequest) {
    user.company = company._id;
    user.companyStatus = "pending";
    await user.save();

    await JoinRequest.updateOne(
      { _id: existingPendingRequest._id },
      {
        $set: {
          approver: approverId,
          metadata: {
            ...(typeof existingPendingRequest.metadata === "object" &&
            existingPendingRequest.metadata !== null
              ? (existingPendingRequest.metadata as Record<string, unknown>)
              : {}),
            enrollingHrId,
          },
        },
      },
    );

    const refreshedRequest = await JoinRequest.findById(existingPendingRequest._id);

    await Notification.create({
      user: approverId,
      company: company._id,
      type: "approval",
      title: joinTitleForRole(codeRole),
      message: `${user.name} requested approval to join ${company.name}.`
    });
    emitNotification(String(approverId));

    return NextResponse.json({
      request: serializeDoc(refreshedRequest ?? existingPendingRequest),
      status: "requested",
      approvalNotifier,
    });
  }

  const joinRequest = await JoinRequest.findOneAndUpdate(
    { requester: userId, company: company._id, kind: "company", status: "pending" },
    {
      $set: { approver: approverId, metadata: { enrollingHrId } },
      $setOnInsert: {
        requester: userId,
        company: company._id,
        kind: "company",
      },
    },
    { new: true, upsert: true }
  );

  user.company = company._id;
  user.companyStatus = "pending";
  await user.save();

  await Notification.create({
    user: approverId,
    company: company._id,
    type: "approval",
    title: joinTitleForRole(codeRole),
    message: `${user.name} requested approval to join ${company.name}.`
  });
  emitNotification(String(approverId));

  return NextResponse.json(
    { request: serializeDoc(joinRequest), status: "requested", approvalNotifier },
    { status: 201 },
  );
}
