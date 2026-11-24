import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import {
  effectiveRegionApproverClause,
  effectiveRegionLabelOf,
  regionLabelsOf,
} from "@/lib/company-regions";
import { isUserOnline } from "@/lib/socket-emit";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rich member search for the Messages "New chat" picker.
 *
 * Deliberately mirrors the membership boundary in `/api/messages`: only approved
 * members of the caller's company, never the caller. The conversation POST route
 * re-checks the same rule before writing a message, so a stale card here can
 * never become an invalid recipient.
 */
export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") ?? "").trim();
  const allRegions = ["1", "true", "all"].includes(String(url.searchParams.get("all") ?? "").toLowerCase());

  const me = await User.findById(userId).select("company companyStatus regionLabel");
  if (!me?.company || me.companyStatus !== "approved") {
    return NextResponse.json({ members: [], regions: [], currentRegion: "", selectedRegion: "" });
  }

  const company = await Company.findById(me.company).select("addresses address").lean();
  const currentRegion = effectiveRegionLabelOf(company as any, me);
  const regions = regionLabelsOf(company as any);
  const requestedRegion = String(url.searchParams.get("region") ?? currentRegion).trim();
  const selectedRegion = allRegions ? "" : requestedRegion || currentRegion;

  if (q.length < 2) {
    return NextResponse.json({ members: [], regions, currentRegion, selectedRegion });
  }

  const pattern = escapeRegex(q);
  const query: Record<string, unknown> = {
    company: me.company,
    companyStatus: "approved",
    _id: { $ne: me._id },
    $or: [
      { name: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } },
      { companyIdentityCode: { $regex: pattern, $options: "i" } },
    ],
  };

  if (selectedRegion) {
    const regionClause = effectiveRegionApproverClause(company as any, selectedRegion);
    if (regionClause) query.$and = [regionClause];
  }

  const rows = await User.find(query)
    .select(
      "name email role customRole isSeniorSecurity companyIdentityCode avatarUrl phone dob team regionLabel lastOnline companyJoined",
    )
    .populate({ path: "team", select: "name" })
    .limit(20)
    .lean();

  const members = (rows as any[]).map((member) => {
    const id = String(member._id ?? "");
    const team = member.team && typeof member.team === "object"
      ? (member.team as Record<string, unknown>)
      : null;
    return {
      id,
      name: String(member.name ?? ""),
      email: String(member.email ?? ""),
      role: String(member.role ?? "employee"),
      customRole: String(member.customRole ?? ""),
      isSeniorSecurity: Boolean(member.isSeniorSecurity),
      companyIdentityCode: String(member.companyIdentityCode ?? ""),
      avatarUrl: String(member.avatarUrl ?? ""),
      phone: String(member.phone ?? ""),
      dob: member.dob ?? null,
      team: team ? { id: String(team._id ?? ""), name: String(team.name ?? "") } : null,
      regionLabel: effectiveRegionLabelOf(company as any, member) || selectedRegion || currentRegion,
      lastOnline: member.lastOnline ?? null,
      companyJoined: member.companyJoined ?? null,
      isOnline: isUserOnline(id),
    };
  });

  return NextResponse.json({ members, regions, currentRegion, selectedRegion });
}
