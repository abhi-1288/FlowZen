import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { createJoinCode, createRoleJoinCode } from "@/lib/codes";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError("Company name is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (user.role !== "admin") return jsonError("Only admins can register a company.", 403);
  if (user.company) return jsonError("You already have a registered company.", 409);

  const joinCode = createJoinCode("CO");
  const company = await Company.create({
    name,
    owner: userId,
    joinCode,
    otherJoinCode: createRoleJoinCode(joinCode),
    members: [userId]
  });

  user.company = company._id;
  user.companyStatus = "approved";
  await user.save();

  await Notification.create({
    user: userId,
    company: company._id,
    type: "system",
    title: "Company registered",
    message: `${company.name} is ready for staff onboarding.`
  });
  emitNotification(userId);

  return NextResponse.json({ company: serializeDoc(company) }, { status: 201 });
}
