import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { buildAssessmentQuestions, pickDomain } from "@/lib/assessment";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const job = await ATSJob.findById(candidate.job);
  if (!job || !job.assessment) return jsonError("Assessment is not available for this job.", 400);

  if (!["screening", "assessment"].includes(candidate.stage)) return jsonError("You are not eligible for the assessment.", 400);
  if ((candidate as any).assessmentSubmittedAt) return jsonError("You have already submitted the assessment.", 400);

  // A candidate in "screening" stage (moved back by HR) is treated as not
  // started, even if a stale assessmentStartedAt flag remains.
  const alreadyStarted = Boolean((candidate as any).assessmentStartedAt) && candidate.stage === "assessment";

  // Check if assessment date is today (window open)
  const now = new Date();
  if (!job.assessmentDate) return jsonError("Assessment date is not set.", 400);
  const d = new Date(job.assessmentDate);
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  if (now < start || now > end) return jsonError("The assessment window is not open today.", 400);

  const assessment = await ATSAssessment.findOne({ job: job._id, company: candidate.company });
  if (!assessment) return jsonError("Assessment questions are not yet available.", 400);

  const body = await request.json().catch(() => ({}));
  const domainName = typeof body.domain === "string" ? body.domain : "";

  // Candidate selects their domain (one) when the assessment has domain sections;
  // the general (non-domain) questions are always included.
  const chosenDomain = pickDomain((assessment.domains as any[]) || [], domainName || (candidate as any).assessmentDomain || "");
  if ((assessment.domains as any[])?.length && !chosenDomain) {
    return jsonError("Please select your domain to start the assessment.", 400);
  }

  const flatQuestions = buildAssessmentQuestions(
    (assessment.questions as any[]) || [],
    chosenDomain?.questions as any[] || []
  );
  if (!flatQuestions.length) return jsonError("Assessment questions are not yet available.", 400);

  // If not yet started, mark as started
  if (!alreadyStarted) {
    const fromStage = candidate.stage;
    const updates: any = { assessmentStartedAt: new Date() };
    if (chosenDomain) updates.assessmentDomain = chosenDomain.name;
    if (fromStage === "screening") updates.stage = "assessment";
    await ATSCandidate.findByIdAndUpdate(candidate._id, updates);

    await ATSTimeline.create({
      candidate: candidate._id,
      job: job._id,
      action: "assessment-started",
      metadata: { jobTitle: job.title, ...(chosenDomain ? { domain: chosenDomain.name } : {}) },
      company: candidate.company,
    });

    if (fromStage === "screening") {
      await ATSTimeline.create({
        candidate: candidate._id,
        job: job._id,
        action: "stage-changed",
        metadata: { from: "screening", to: "assessment", reason: "Started online assessment", ...(chosenDomain ? { domain: chosenDomain.name } : {}) },
        company: candidate.company,
      });
    }
  }

  const sourceQuestions = [
    ...(assessment.questions as any[]) || [],
    ...(chosenDomain?.questions as any[]) || [],
  ];
  const questions = flatQuestions.map((q, idx) => {
    const src = sourceQuestions[idx] || {};
    return {
      index: idx,
      text: src.text ?? "",
      options: Array.isArray(src.options) ? src.options : [],
      type: q.type,
      marks: q.marks,
      required: q.required,
    };
  });

  const startedAt = alreadyStarted ? new Date((candidate as any).assessmentStartedAt) : now;
  return NextResponse.json({
    ok: true,
    domain: chosenDomain?.name || (candidate as any).assessmentDomain || null,
    questions,
    durationMinutes: job.assessmentDurationMinutes || null,
    endsAt: job.assessmentDurationMinutes
      ? new Date(startedAt.getTime() + job.assessmentDurationMinutes * 60 * 1000).toISOString()
      : null,
  });
}