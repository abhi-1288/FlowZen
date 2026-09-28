import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";
import { MAX_PROCTORING_LOG_ENTRIES, trimProctoringLog } from "@/lib/assessment-proctoring";

/**
 * HR waiving proctoring for one candidate.
 *
 * Proctoring is required by default, which is the right default for integrity
 * but a real lockout for a candidate on a locked-down corporate laptop, a shared
 * family machine, or a browser policy that blocks camera access. This is the
 * escape hatch, and it is deliberately per-candidate and per-reason rather than
 * a global relaxation of the assessment.
 *
 * The reason is stored on the record and appended to the proctoring log, so
 * "why did this candidate have no camera" is answerable months later.
 */

const HR_ROLES = ["admin", "human-resource"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);

  const body = await request.json().catch(() => ({}));
  const exempt = body?.exempt === true;
  const reason = String(body?.reason ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  if (exempt && reason.length < 4) {
    return jsonError("Give a short reason so the exemption is auditable.", 400);
  }

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company });
  if (!candidate) return jsonError("Candidate not found.", 404);

  const current = ((candidate as any).assessmentProctoring ?? {}) as Record<string, any>;
  const log = trimProctoringLog([
    ...((current.log as any[]) || []),
    {
      at: new Date(),
      kind: "exempt",
      detail: exempt
        ? `proctoring waived by ${user.name || user.email}${reason ? `: ${reason}` : ""}`
        : `proctoring re-enabled by ${user.name || user.email}${reason ? `: ${reason}` : ""}`,
    },
  ]);

  await ATSCandidate.findByIdAndUpdate(candidate._id, {
    $set: {
      "assessmentProctoring.exempt": exempt,
      "assessmentProctoring.exemptReason": exempt ? reason : "",
      "assessmentProctoring.log": log.slice(-MAX_PROCTORING_LOG_ENTRIES),
      // A live interruption must not keep the clock open for an exempt candidate.
      ...(exempt ? { "assessmentProctoring.pausedAt": null } : {}),
    },
  });

  // Internal timeline action: absent from CANDIDATE_VISIBLE_TIMELINE_ACTIONS, so
  // it stays out of the portal payload.
  await ATSTimeline.create({
    candidate: candidate._id,
    job: candidate.job,
    action: "stage-changed",
    metadata: { from: "proctoring", to: exempt ? "exempt" : "enforced" },
    actor: userId,
    company: user.company,
  });

  return NextResponse.json({ ok: true, exempt });
}
