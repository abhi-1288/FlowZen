import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";

const ALLOWED = ["admin", "human-resource", "project-manager", "qa-tester", "finance"];

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    const isSeniorSecurity = user?.role === "security" && Boolean((user as any).isSeniorSecurity);
    if (!user || (!ALLOWED.includes(user.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
    if (!user.company) return jsonError("No company found.", 400);

    const isHr = user.role === "admin" || user.role === "human-resource" || isSeniorSecurity;
    const filter: any = { company: user.company };
    if (isHr) {
      filter.stage = { $nin: ["joined", "rejected"] };
    } else {
      filter["assignedTeam.user"] = userId;
      filter["assignedTeam.status"] = { $ne: "completed" };
    }

    const count = await ATSCandidate.countDocuments(filter);
    return NextResponse.json({ count });
  } catch (err: any) {
    return jsonError(err.message || "Failed to fetch count", 500);
  }
}
