import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAssessment } from "@/models/ATSAssessment";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("id assessment assessmentDate title");
  if (!job) return jsonError("Job not found.", 404);

  // Gate: only available after assessment date + 1 day
  const assessment = await ATSAssessment.findOne({ job: job._id, company: user.company }).select("passScore");
  if (!assessment) return jsonError("No assessment configured for this job.", 400);

  const body = await request.json().catch(() => ({}));
  const manualNote = typeof body.note === "string" ? body.note.trim() : "";
  const mode = body.mode === "auto" ? "auto" : "manual";
  const threshold = (assessment as any).passScore ?? 50;

  let moved = 0;
  let advanced = 0;

  if (mode === "auto") {
    const candidates = await ATSCandidate.find({
      job: job._id,
      company: user.company,
      assessmentStatus: { $in: ["rejected", "selected"] },
      stage: "assessment",
    });

    for (const candidate of candidates) {
      if (candidate.assessmentStatus === "rejected") {
        const fromStage = candidate.stage;

        let noteContent: string;
        if (manualNote) {
          noteContent = manualNote;
        } else {
          const score = (candidate as any).assessmentScore ?? 0;
          const scorePart = threshold != null
            ? `Rejected via assessment — score ${score}/100 was below the pass threshold of ${threshold}.`
            : `Rejected via assessment — score ${score}/100 did not meet the pass requirements.`;
          noteContent = (candidate as any).assessmentReason ? `${scorePart} ${(candidate as any).assessmentReason}` : scorePart;
        }

        candidate.stage = "ats-rejected" as typeof candidate.stage;
        (candidate as any).assessmentRejectionNote = noteContent;
        await candidate.save();

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "stage-changed",
          metadata: { from: fromStage, to: "ats-rejected", reason: "assessment-rejection" },
          actor: userId,
          company: user.company,
        });

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "note-added",
          metadata: { content: noteContent, type: "assessment-rejection" },
          actor: userId,
          company: user.company,
        });

        emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
        moved++;
      } else if (candidate.assessmentStatus === "selected" && candidate.stage === "assessment") {
        const fromStage = candidate.stage;
        candidate.stage = "technical-interview" as typeof candidate.stage;
        await candidate.save();

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "stage-changed",
          metadata: { from: fromStage, to: "technical-interview", reason: "assessment-passed" },
          actor: userId,
          company: user.company,
        });

        emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
        advanced++;
      }
    }
  }

  if (moved > 0 || advanced > 0) {
    const hrAndAdmin = await User.find({ company: user.company, role: { $in: ["admin", "human-resource"] }, _id: { $ne: userId } });
    for (const u of hrAndAdmin) {
      await Notification.create({
        user: u._id,
        company: user.company,
        type: "info",
        title: "Assessment Results Applied",
        message: `${moved} candidate(s) rejected and ${advanced} candidate(s) advanced to Technical Interview.`,
        link: `/recruitment/jobs/${id}`,
      });
      emitToUser(String(u._id), "notification:new", { message: `Assessment results: ${moved} rejected, ${advanced} advanced.` });
      emitToUser(String(u._id), "recruitment:update", { type: "assessment-rejections-applied", jobId: id });
    }
  }

  return NextResponse.json({ moved, advanced, mode });
}