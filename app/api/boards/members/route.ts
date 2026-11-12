import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { getContinuityActor } from "@/lib/continuity-access";
import { User } from "@/models/User";

/**
 * Minimal company directory for assignment and handover pickers. It never
 * exposes users outside the actor's company and only approved members.
 */
export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor?.company) return jsonError("No company", 400);

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId") ?? "";

  const users = await User.find({
    company: actor.company,
    companyStatus: "approved",
    ...(teamId ? { team: teamId } : {}),
  })
    .select("name email role avatarUrl companyIdentityCode team")
    .sort({ name: 1 })
    .limit(500);

  return NextResponse.json({
    members: users.map((user) => ({
      id: String(user._id),
      name: String(user.name ?? ""),
      email: String(user.email ?? ""),
      role: String(user.role ?? ""),
      avatarUrl: user.avatarUrl ?? "",
      employeeCode: String(user.companyIdentityCode ?? ""),
      team: user.team ? String(user.team) : null,
    })),
  });
}
