import { NextResponse } from "next/server";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSTimeline } from "@/models/ATSTimeline";
import { withCandidateAccess } from "@/lib/recruitment-candidate-access";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { jsonError, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };
const VALID_DECISIONS = ["selected", "rejected"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision ?? "");
  if (!VALID_DECISIONS.includes(decision)) return jsonError("Invalid decision.");

  const access = await withCandidateAccess(id, "write");
  if (!access.ok) return access.response;
  const { user } = access;
  const userId = String(user._id);

  // Overriding or confirming the ATS verdict is a pipeline decision.
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;

  const candidate = await ATSCandidate.findById(access.candidate._id)
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");
  if (!candidate) return jsonError("Candidate not found.", 404);

  const job = candidate.job;
  const jobObj = typeof job === "object" && job !== null ? job : null;
  const threshold = jobObj && (jobObj as any).atsScoreThreshold != null
    ? (jobObj as any).atsScoreThreshold
    : (await ATSJob.findOne({ _id: job }).select("atsScoreThreshold"))?.atsScoreThreshold ?? null;

  if (decision === "selected") {
    const fromStage = candidate.stage;
    const advanced = fromStage === "applied";

    candidate.atsStatus = "selected";
    candidate.atsRejectionNote = "";

    if (advanced) candidate.stage = "screening" as typeof candidate.stage;

    await candidate.save();

    await ATSTimeline.create({
      candidate: candidate._id,
      job: candidate.job,
      action: advanced ? "stage-changed" : "note-added",
      metadata: advanced
        ? { from: fromStage, to: "screening", reason: "hr-ats-approved" }
        : { content: "HR marked the candidate OK for the pipeline (ATS flag overridden).", type: "ats-override" },
      actor: userId,
      company: user.company,
    });

    emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
  } else {
    const fromStage = candidate.stage;

    const score = candidate.atsScore ?? 0;
    const defaultNote = threshold != null
      ? `Rejected via ATS screening — score ${score}/100 was below the job threshold of ${threshold}.`
      : `Rejected via ATS screening — score ${score}/100 did not meet the job requirements.`;
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : defaultNote;

    candidate.atsStatus = "rejected";
    candidate.atsRejectionNote = note;
    if (candidate.stage !== "ats-rejected" && candidate.stage !== "rejected") {
      candidate.stage = "ats-rejected" as typeof candidate.stage;
    }

    await candidate.save();

    await ATSTimeline.create({
      candidate: candidate._id,
      job: candidate.job,
      action: "stage-changed",
      metadata: { from: fromStage, to: "ats-rejected", reason: "ats-rejection", content: note },
      actor: userId,
      company: user.company,
    });

    await ATSTimeline.create({
      candidate: candidate._id,
      job: candidate.job,
      action: "note-added",
      metadata: { content: note, type: "ats-rejection" },
      actor: userId,
      company: user.company,
    });

    emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
  }

  const refreshed = await ATSCandidate.findById(candidate._id)
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");

  return NextResponse.json({ candidate: serializeDoc(refreshed!) });
}