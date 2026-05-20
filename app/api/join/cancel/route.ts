import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { User } from "@/models/User";

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

  const [user, pendingJoin] = await Promise.all([
    User.findById(userId),
    JoinRequest.findOne({
      requester: userId,
      kind: { $in: ["company", "team"] },
      status: "pending",
    }).sort({ createdAt: -1 }),
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!pendingJoin) return jsonError("No pending join request found.", 404);

  pendingJoin.status = "rejected";
  pendingJoin.cancelReason = "";
  pendingJoin.cancelledAt = new Date();
  await pendingJoin.save();

  if (pendingJoin.kind === "company") {
    user.companyStatus = "none";
    user.company = null;
  } else if (pendingJoin.kind === "team") {
    user.teamStatus = "none";
    user.team = null;
  }
  await user.save();

  return NextResponse.json({ ok: true });
}
