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
import { sendMail } from "@/lib/mailer";
import { assessmentRejectionEmail } from "@/lib/email-templates";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("id assessment assessmentDate title");
  if (!job) return jsonError("Job not found.", 404);

  // Gate: only available after assessment date + 1 day
  const assessment = await ATSAssessment.findOne({ job: job._id, company: user.company }).select("passScore resultsAppliedAt");
  if (!assessment) return jsonError("No assessment configured for this job.", 400);

  const body = await request.json().catch(() => ({}));
  const manualNote = typeof body.note === "string" ? body.note.trim() : "";
  const mode = body.mode === "auto" ? "auto" : "manual";
  const threshold = (assessment as any).passScore ?? 50;

  let moved = 0;
  let advanced = 0;
  let notAssessed = 0;

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
            ? `Failed assessment — score ${score}/100 was below the pass threshold of ${threshold}.`
            : `Failed assessment — score ${score}/100 did not meet the pass requirements.`;
          noteContent = (candidate as any).assessmentReason ? `${scorePart} ${(candidate as any).assessmentReason}` : scorePart;
        }

        candidate.stage = "assessment-fail" as typeof candidate.stage;
        (candidate as any).assessmentRejectionNote = noteContent;
        await candidate.save();

        try {
          const emailBody = assessmentRejectionEmail({
            candidateName: `${(candidate as any).firstName ?? ""} ${(candidate as any).lastName ?? ""}`.trim() || "Candidate",
            jobTitle: (job as any).title ?? "the role",
            note: noteContent,
            company: { name: (user as any).companyName },
          });
          if ((candidate as any).email) {
            await sendMail({ to: (candidate as any).email, subject: emailBody.subject, text: emailBody.text, html: emailBody.html });
          }
        } catch (e) {
          console.error("Failed to send rejection email", e);
        }

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "stage-changed",
          metadata: { from: fromStage, to: "assessment-fail", reason: "assessment-failed" },
          actor: userId,
          company: user.company,
        });

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "note-added",
          metadata: { content: noteContent, type: "assessment-failed" },
          actor: userId,
          company: user.company,
        });

        emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
        moved++;
      } else if (candidate.assessmentStatus === "selected" && candidate.stage === "assessment") {
        const fromStage = candidate.stage;
        candidate.stage = "assessment-pass" as typeof candidate.stage;
        await candidate.save();

        await ATSTimeline.create({
          candidate: candidate._id,
          job: candidate.job,
          action: "stage-changed",
          metadata: { from: fromStage, to: "assessment-pass", reason: "assessment-passed" },
          actor: userId,
          company: user.company,
        });

        emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
        advanced++;
      }
    }

    // Candidates invited to the assessment who never started/submitted it are
    // still parked in `assessment` with a pending status. Close that cohort out
    // explicitly so the stage column empties and HR has a clear disposition.
    const neverAssessed = await ATSCandidate.find({
      job: job._id,
      company: user.company,
      stage: "assessment",
      assessmentStatus: "pending",
      assessmentSubmittedAt: null,
    });

    for (const candidate of neverAssessed) {
      const fromStage = candidate.stage;
      candidate.stage = "not-assessed" as typeof candidate.stage;
      await candidate.save();

      await ATSTimeline.create({
        candidate: candidate._id,
        job: candidate.job,
        action: "stage-changed",
        metadata: { from: fromStage, to: "not-assessed", reason: "not-assessed" },
        actor: userId,
        company: user.company,
      });

      emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
      notAssessed++;
    }
  }

  // Reveal results to candidates whose assessment outcome is final.
  // Marks/status are hidden from the candidate portal until HR triggers
  // this review action.
  const published = await ATSCandidate.find({
    job: job._id,
    company: user.company,
    assessmentStatus: { $in: ["selected", "rejected"] },
    assessmentResultPublishedAt: null,
  }).select("assessmentScore assessmentStatus assessmentRawMarks assessmentMaxMarks");

  if (published.length > 0) {
    await ATSCandidate.updateMany(
      { _id: { $in: published.map((c: any) => c._id) } },
      { $set: { assessmentResultPublishedAt: new Date() } }
    );

    for (const c of published as any[]) {
      const score = (c as any).assessmentScore;
      const passed = c.assessmentStatus === "selected";
      await ATSTimeline.updateOne(
        { candidate: c._id, job: job._id, action: "assessment-graded" },
        {
          $set: {
            "metadata.content": `Assessment result: ${score != null ? `${score}/100` : "—"}${passed ? ". Passed." : ". Failed."}`,
            "metadata.status": passed ? "selected" : "rejected",
            "metadata.passed": passed,
          },
        }
      );
    }
  }

  // Schedule the answer key auto-publish: exactly one day after this review the
  // question paper/answer key is released to candidates by the cron job
  // (/api/cron/assessment-answer-key).
  await ATSAssessment.updateOne(
    { _id: (assessment as any)._id },
    { $set: { resultsAppliedAt: new Date() } }
  );

  if (moved > 0 || advanced > 0 || notAssessed > 0) {
    const hrAndAdmin = await User.find({ company: user.company, role: { $in: ["admin", "human-resource"] }, _id: { $ne: userId } });
    for (const u of hrAndAdmin) {
      await Notification.create({
        user: u._id,
        company: user.company,
        type: "info",
        title: "Assessment Results Applied",
        message: `${moved} moved to Assessment Failed, ${advanced} to Assessment Passed, ${notAssessed} to Not Assessed.`,
        link: `/recruitment/jobs/${id}`,
      });
      emitToUser(String(u._id), "notification:new", { message: `Assessment results: ${moved} failed, ${advanced} passed, ${notAssessed} not assessed.` });
      emitToUser(String(u._id), "recruitment:update", { type: "assessment-rejections-applied", jobId: id });
    }
  }

  return NextResponse.json({ moved, advanced, notAssessed, mode });
}
