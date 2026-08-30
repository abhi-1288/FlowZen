import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
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

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("id atsScoreThreshold");
  if (!job) return jsonError("Job not found.", 404);

  const body = await request.json().catch(() => ({}));
  const manualNote = typeof body.note === "string" ? body.note.trim() : "";
  const mode = body.mode === "auto" ? "auto" : "manual";

  const threshold = (job as any).atsScoreThreshold;

  let moved = 0;
  let advanced = 0;

  if (mode === "auto") {
    const candidates = await ATSCandidate.find({
      job: job._id,
      company: user.company,
      atsStatus: { $in: ["rejected", "selected"] },
    });

    for (const candidate of candidates) {
      if (candidate.atsStatus === "rejected") {
        if (candidate.stage === "ats-rejected") continue;
        const fromStage = candidate.stage;

        let noteContent: string;
        if (manualNote) {
          noteContent = manualNote;
        } else {
          const score = candidate.atsScore ?? 0;
          const scorePart = threshold != null
            ? `Rejected via ATS screening — score ${score}/100 was below the job threshold of ${threshold}.`
            : `Rejected via ATS screening — score ${score}/100 did not meet the job requirements.`;
          noteContent = candidate.atsReason ? `${scorePart} ${candidate.atsReason}` : scorePart;
        }

        candidate.stage = "ats-rejected" as typeof candidate.stage;
        (candidate as any).atsRejectionNote = noteContent;
        await candidate.save();

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "stage-changed",
          metadata: { from: fromStage, to: "ats-rejected", reason: "ats-rejection" },
          actor: userId,
          company: user.company,
        });

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "note-added",
          metadata: { content: noteContent, type: "ats-rejection" },
          actor: userId,
          company: user.company,
        });

        emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
        moved++;
      } else if (candidate.atsStatus === "selected" && candidate.stage === "applied") {
        const fromStage = candidate.stage;
        candidate.stage = "screening" as typeof candidate.stage;
        await candidate.save();

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "stage-changed",
          metadata: { from: fromStage, to: "screening", reason: "ats-approved" },
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
        title: "ATS Timeline Updated",
        message: `${moved} ATS-rejected candidate(s) moved to ATS Rejected and ${advanced} approved candidate(s) advanced to Screening.`,
        link: `/recruitment/jobs/${id}`,
      });
      emitToUser(String(u._id), "notification:new", { message: `ATS timeline: ${moved} rejected, ${advanced} advanced to screening.` });
      emitToUser(String(u._id), "recruitment:update", { type: "ats-rejections-applied", jobId: id });
    }
  }

  return NextResponse.json({ moved, advanced, mode });
}
