import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { getFlowZenQuota } from "@/lib/interview-quota";
import { User } from "@/models/User";

const RECRUITMENT_ROLES = ["admin", "human-resource", "project-manager", "qa-tester", "finance"];

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId).select("role company isSeniorSecurity");
  if (!user?.company) return jsonError("Forbidden", 403);

  const isSeniorSecurity = user.role === "security" && Boolean(user.isSeniorSecurity);
  if (!RECRUITMENT_ROLES.includes(user.role) && !isSeniorSecurity) return jsonError("Forbidden", 403);

  const quota = await getFlowZenQuota(user.company);
  return NextResponse.json(quota, { headers: { "Cache-Control": "no-store" } });
}
