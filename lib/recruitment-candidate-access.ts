import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import {
  canAccessCandidate,
  isRecruitmentReader,
  isRecruitmentWriter,
} from "@/lib/candidate-region-scope";

/**
 * Load one candidate together with the caller's reach over it.
 *
 * The list filters added by `candidateRegionClause` are necessary but not
 * sufficient. Candidate ids are sequential ObjectIds, so a recruiter confined to
 * their own region can still reach a foreign candidate by walking
 * `/api/recruitment/candidates/<id>` directly — the list simply never told them
 * the id existed. Every route that reads or writes a single candidate resolves
 * access through here so that boundary cannot be bypassed by guessing.
 *
 * A candidate outside the caller's reach answers **404, not 403**. A 403 would
 * confirm the id is a real candidate, which turns the endpoint into an oracle for
 * enumerating another region's pipeline; 404 is indistinguishable from the id not
 * existing, which is the answer the caller is not entitled to.
 */

export type CandidateAccessMode = "read" | "write";

export type CandidateAccess =
  | { ok: true; user: any; company: any; candidate: any }
  | { ok: false; response: NextResponse };

export async function withCandidateAccess(
  candidateId: string,
  mode: CandidateAccessMode,
): Promise<CandidateAccess> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, response: jsonError("Unauthorized", 401) };
  if (!isObjectId(candidateId)) return { ok: false, response: jsonError("Invalid candidate id.") };

  await connectDb();
  const user = await User.findById(userId);
  const isSeniorSecurity = user?.role === "security" && Boolean((user as any).isSeniorSecurity);
  const allowed =
    mode === "write"
      ? isRecruitmentWriter(user) || isSeniorSecurity
      : isRecruitmentReader(user) || isSeniorSecurity;
  if (!user || !allowed) return { ok: false, response: jsonError("Forbidden", 403) };
  if (!user.company) return { ok: false, response: jsonError("No company found.", 400) };

  const company = (await Company.findById(user.company)
    .select("owner addresses address")
    .lean()) as any;

  const candidate = await ATSCandidate.findOne({ _id: candidateId, company: user.company });
  if (!candidate) return { ok: false, response: jsonError("Candidate not found.", 404) };
  if (!canAccessCandidate(company, user, candidate)) {
    return { ok: false, response: jsonError("Candidate not found.", 404) };
  }

  return { ok: true, user, company, candidate };
}

/**
 * The same region clause for batch endpoints that query candidates by job.
 *
 * Shared so a job-scoped write cannot quietly skip a boundary the equivalent list
 * route enforces — the two are usually read together in the UI, so a divergence
 * shows up as "I can see it in the list but the action fails".
 */
export { candidateRegionClause } from "@/lib/candidate-region-scope";
