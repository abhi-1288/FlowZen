import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";
import { MAX_EXTENSION_MS, trimProctoringLog } from "@/lib/assessment-proctoring";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";

/**
 * HR deciding a candidate's request for extra time.
 *
 * Approving adds to `assessmentProctoring.extensionMs`, which
 * getCandidateDeadlineMs() folds into the deadline. That means the extra time
 * reaches every gate at once — the countdown the candidate is watching, the
 * submit check, and the auto-submit sweep — rather than needing a separate
 * "extended" branch in each.
 *
 * A live candidate is told through their portal, which polls this state; nobody
 * needs to email them for the change to take effect.
 */

const HR_ROLES = ["admin", "human-resource"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;

  const body = await request.json().catch(() => ({}));
  const decision = String(body?.decision ?? "");
  if (decision !== "approved" && decision !== "denied") {
    return jsonError("Decision must be approved or denied.", 400);
  }

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company });
  if (!candidate) return jsonError("Candidate not found.", 404);
  if (!(candidate as any).assessmentStartedAt) {
    return jsonError("This candidate has not started the assessment.", 400);
  }
  if ((candidate as any).assessmentSubmittedAt) {
    return jsonError("This attempt is already submitted.", 400);
  }

  const proctoring = ((candidate as any).assessmentProctoring ?? {}) as Record<string, any>;
  if (proctoring.extensionRequestStatus !== "pending") {
    return jsonError("There is no pending request for this candidate.", 409);
  }

  const requestedMs = Math.max(0, Number(proctoring.extensionRequestedMs) || 0);
  const note = String(body?.note ?? "").replace(/\s+/g, " ").trim().slice(0, 300);

  // An approver may grant less than was asked for; 0 approves nothing.
  const rawMinutes = Number(body?.minutes);
  const approvedMs =
    decision === "approved"
      ? Math.min(
          MAX_EXTENSION_MS,
          Math.max(0, Math.round((Number.isFinite(rawMinutes) ? rawMinutes : requestedMs / 60000) * 60000))
        )
      : 0;

  const current = Math.max(0, Number(proctoring.extensionMs) || 0);
  const log = trimProctoringLog([
    ...((proctoring.log as any[]) || []),
    {
      at: new Date(),
      kind: "note",
      detail:
        decision === "approved"
          ? `time extension approved by ${user.name || user.email}: +${Math.round(approvedMs / 60000)} min${note ? ` (${note})` : ""}`
          : `time extension denied by ${user.name || user.email}${note ? `: ${note}` : ""}`,
    },
  ]);

  await ATSCandidate.findByIdAndUpdate(candidate._id, {
    $set: {
      "assessmentProctoring.extensionRequestStatus": decision,
      "assessmentProctoring.extensionMs": current + approvedMs,
      "assessmentProctoring.extensionDecidedAt": new Date(),
      "assessmentProctoring.log": log,
    },
  });

  return NextResponse.json({
    ok: true,
    decision,
    extensionMs: current + approvedMs,
    job: (await ATSJob.findById(candidate.job).select("title").lean())?.title ?? "",
  });
}
