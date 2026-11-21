import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const teams = await Team.find({ manager: userId }).select("name employees");
  const teamList = teams.map((t: any) => ({
    id: String(t._id),
    name: String(t.name ?? ""),
    memberIds: (t.employees || []).map((e: any) => String(e)),
  }));

  const allIds = new Set<string>();
  for (const t of teamList) for (const id of t.memberIds) allIds.add(id);

  const users = await User.find({ _id: { $in: Array.from(allIds) } })
    .select("name email role customRole isSeniorSecurity regionLabel companyIdentityCode")
    .sort({ name: 1 });

  const userMap = new Map(users.map((u: any) => [String(u._id), u]));

  const teamsWithMembers = teamList.map((t) => ({
    id: t.id,
    name: t.name,
    members: t.memberIds
      .map((id: string) => userMap.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: String(u._id),
        name: u.name ?? "",
        email: u.email ?? "",
        role: u.role ?? "employee",
        isSeniorSecurity: Boolean(u.isSeniorSecurity),
        customRole: u.customRole ?? "",
        regionLabel: u.regionLabel ?? "",
        companyIdentityCode: u.companyIdentityCode ?? "",
      })),
  }));

  const flatMembers = users.map((u: any) => ({
    id: String(u._id),
    name: u.name ?? "",
    email: u.email ?? "",
    role: u.role ?? "employee",
    isSeniorSecurity: Boolean(u.isSeniorSecurity),
    customRole: u.customRole ?? "",
    regionLabel: u.regionLabel ?? "",
    companyIdentityCode: u.companyIdentityCode ?? "",
  }));

  return NextResponse.json({
    teams: teamsWithMembers,
    teamCount: teamsWithMembers.length,
    members: flatMembers,
    region: "My team",
    regionLabel: "My team",
  });
}