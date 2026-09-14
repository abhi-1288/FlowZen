import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";

const INTERVIEWER_ROLES = ["project-manager", "qa-tester", "finance", "human-resource", "admin", "it-admin", "it-administration"];

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    await connectDb();
    const currentUser = await User.findById(userId);
    if (!currentUser?.company) return jsonError("Company not found", 404);

    const presentRoles = await User.distinct("role", {
      company: currentUser.company,
      _id: { $ne: userId },
      role: { $in: INTERVIEWER_ROLES },
    });

    const availableRoles = INTERVIEWER_ROLES.filter((role) => presentRoles.includes(role));
    return NextResponse.json({ availableRoles });
  } catch (err: any) {
    return jsonError(err.message || "Failed to fetch roles", 500);
  }
}