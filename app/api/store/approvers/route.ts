import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { resolveStoreApproverOptions } from "@/lib/store";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus name regionLabel team activeTeams",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to order.", 403);
  }

  const plan = await resolveStoreApproverOptions(user as any);

  return NextResponse.json({
    region: plan.region,
    regionFallback: plan.regionFallback,
    teamOwner: plan.teamOwner,
    teamOwnerBlockedReason: plan.teamOwnerBlockedReason,
    approvers: plan.approvers,
  });
}
