import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const hrUser = await User.findById(userId);
  const isSeniorSecurity = hrUser?.role === "security" && Boolean((hrUser as any).isSeniorSecurity);
  if (!hrUser || (!HR_ROLES.includes(hrUser.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
  if (!hrUser.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: hrUser.company }).select("email");
  if (!candidate) return jsonError("Candidate not found.", 404);

  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get("email") ?? candidate.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ exists: false });

  const existing = await User.findOne({ email }).populate("company", "name");
  if (!existing) return NextResponse.json({ exists: false });

  const companyDoc = existing.company as any;
  const companyId = companyDoc?._id ?? companyDoc ?? "";

  return NextResponse.json({
    exists: true,
    isInYourCompany: String(companyId) === String(hrUser.company),
    user: {
      email: existing.email,
      name: existing.name,
      companyName: companyDoc?.name || null,
      companyIdentityCode: existing.companyIdentityCode || null,
      companyStatus: existing.companyStatus || "none",
      role: existing.role,
    },
  });
}
