import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";

/**
 * Clear one candidate's mock-test history.
 *
 * Exists because a paper can be lost to something that is nobody's fault: the
 * laptop died mid-question, the proctoring preflight never passed on a locked
 * down machine, the network dropped. Burning the attempt limit on a technical
 * failure would leave a candidate unable to practise at all.
 *
 * Only the mock block is touched — the real attempt, its score, the stage and
 * the timeline are not involved, so this cannot be used to re-open a real exam.
 * `inviteSentAt` is cleared too, so the candidate is put back in the queue for
 * the next invitation rather than being silently left with an empty card.
 */

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const candidateId = String(body?.candidateId || "").trim();
  if (!candidateId) return jsonError("A candidate is required.", 400);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("assessment").lean();
  if (!job) return jsonError("Job not found.", 404);
  if (!job?.assessment) return jsonError("Online assessment is not enabled for this job.", 400);

  const updated = await ATSCandidate.findOneAndUpdate(
    { _id: candidateId, job: id, company: user.company },
    { $set: { "mockTest.attempts": [], "mockTest.bestScore": null, "mockTest.lastSubmittedAt": null, "mockTest.inviteSentAt": null } },
    { new: true }
  ).select("firstName lastName email");
  if (!updated) return jsonError("Candidate not found for this job.", 404);

  return NextResponse.json({
    ok: true,
    candidate: {
      _id: String((updated as any)._id),
      firstName: (updated as any).firstName,
      lastName: (updated as any).lastName || "",
      email: (updated as any).email,
    },
  });
}
