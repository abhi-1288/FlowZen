import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { buildOrigin, resolveCandidatePortalToken } from "@/lib/candidate-portal";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const user: any = await User.findById(userId);
  if (!user || !["admin", "human-resource"].includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company });
  if (!candidate) return jsonError("Candidate not found.", 404);
  if (candidate.stage !== "screening") {
    return jsonError("Test link is only available for candidates in the Screening stage.", 400);
  }

  const token = await resolveCandidatePortalToken(String(candidate._id));
  if (!token) return jsonError("Unable to generate test link.", 500);

  const origin = buildOrigin(request);
  const url = `${origin}/candidate-portal?token=${encodeURIComponent(token)}&test=true`;

  return NextResponse.json({ url, email: candidate.email });
}