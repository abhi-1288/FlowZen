import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (!user.company) return jsonError("You are not in a company.", 400);

  if (!["project-manager", "qa-tester"].includes(String(user.role))) {
    return jsonError("Only project managers or Q-A testers can request quit company.", 403);
  }

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found.", 404);

  const existing = await JoinRequest.findOne({
    requester: user._id,
    kind: "quit-company",
    status: "pending",
  });
  if (existing) return jsonError("Quit request already pending.", 409);

  await JoinRequest.create({
    requester: user._id,
    approver: company.owner,
    company: user.company,
    kind: "quit-company",
  });

  await Notification.create({
    user: company.owner,
    company: user.company,
    type: "approval",
    title: "Quit Request",
    message: `${user.name}: ${user.role} is requesting to quit on ${company.name}`,
  });
  emitNotification(String(company.owner));

  return NextResponse.json({ ok: true });
}
