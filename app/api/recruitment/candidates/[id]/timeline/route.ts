import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDocs } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
const ALL_ROLES = ["admin", "human-resource", "project-manager", "qa-tester", "finance"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const user = await User.findById(userId);
  const isSeniorSecurity = user?.role === "security" && Boolean((user as any).isSeniorSecurity);
  if (!user || (!ALL_ROLES.includes(user.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const timeline = await ATSTimeline.find({ candidate: id, company: user.company })
    .sort({ createdAt: -1 })
    .populate("actor", "name");

  return NextResponse.json({ timeline: serializeDocs(timeline) });
}
