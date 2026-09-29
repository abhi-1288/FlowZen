import { NextResponse } from "next/server";
import { ATSCandidate } from "@/models/ATSCandidate";
import { withCandidateAccess } from "@/lib/recruitment-candidate-access";
import { buildOrigin, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { jsonError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const access = await withCandidateAccess(id, "read");
  if (!access.ok) return access.response;
  const { candidate } = access;

  if (candidate.stage !== "screening") {
    return jsonError("Test link is only available for candidates in the Screening stage.", 400);
  }

  const token = await resolveCandidatePortalToken(String(candidate._id));
  if (!token) return jsonError("Unable to generate test link.", 500);

  const origin = buildOrigin(request);
  const url = `${origin}/candidate-portal?token=${encodeURIComponent(token)}&test=true`;

  return NextResponse.json({ url, email: candidate.email });
}