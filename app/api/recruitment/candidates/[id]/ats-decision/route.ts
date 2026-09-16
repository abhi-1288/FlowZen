import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];
const VALID_DECISIONS = ["selected", "rejected"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision ?? "");
  if (!VALID_DECISIONS.includes(decision)) return jsonError("Invalid decision.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company })
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