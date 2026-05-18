import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!code) return jsonError("Company code is required.");
  const isSuffixedCompanyCode = /^CO-.+-\d+$/.test(code);
  const baseCode = isSuffixedCompanyCode ? code.replace(/-\d+$/, "") : code;

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, company] = await Promise.all([
    User.findById(userId),
    Company.findOne({ $or: [{ joinCode: code }, { joinCode: baseCode }, { otherJoinCode: code }] })
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!company) return jsonError("Invalid company code.", 404);
  const isOtherCode = isSuffixedCompanyCode || String(company.otherJoinCode ?? "") === code;
  if (isOtherCode) {
    if (user.role !== "others") {
      return jsonError("This company code is for Others role users.", 403);
    }
  } else if (!["project-manager", "qa-tester"].includes(String(user.role))) {
    return jsonError("Company code onboarding is for project managers or Q-A testers.", 403);
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
  if (existingPendingRequest) {
    user.company = company._id;
    user.companyStatus = "pending";
    await user.save();
    return NextResponse.json({ request: serializeDoc(existingPendingRequest), status: "requested" });
  }

  const joinRequest = await JoinRequest.findOneAndUpdate(
    { requester: userId, company: company._id, kind: "company", status: "pending" },
    { $setOnInsert: { requester: userId, approver: company.owner, company: company._id, kind: "company" } },
    { new: true, upsert: true }
  );

  user.company = company._id;
  user.companyStatus = "pending";
  await user.save();

  await Notification.create({
    user: company.owner,
    company: company._id,
    type: "approval",
    title: isOtherCode ? "Others join request" : "Manager join request",
    message: `${user.name} requested approval to join ${company.name}.`
  });
  emitNotification(String(company.owner));

  return NextResponse.json({ request: serializeDoc(joinRequest), status: "requested" }, { status: 201 });
}
