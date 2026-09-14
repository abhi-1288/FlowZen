import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const job = await ATSJob.findById(candidate.job);
  if (!job || !job.assessment) return jsonError("Assessment is not available for this job.", 400);

  if (!["screening", "assessment"].includes(candidate.stage)) return jsonError("You are not currently eligible for the assessment.", 400);
  if ((candidate as any).assessmentSubmittedAt) return jsonError("You have already submitted the assessment.", 400);
  if ((candidate as any).assessmentStartedAt) return jsonError("Assessment already started. Please submit your answers.", 400);

  // Check if assessment date is today (window open)
  const now = new Date();
  if (!job.assessmentDate) return jsonError("Assessment date is not set.", 400);
  const d = new Date(job.assessmentDate);
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  if (now < start || now > end) return jsonError("The assessment window is not open today.", 400);

  const assessment = await ATSAssessment.findOne({ job: job._id, company: candidate.company });
  if (!assessment || !assessment.questions.length) return jsonError("Assessment questions are not yet available.", 400);

  // Mark as started
  const fromStage = candidate.stage;
  const updates: any = { assessmentStartedAt: new Date() };
  if (fromStage === "screening") updates.stage = "assessment";
  await ATSCandidate.findByIdAndUpdate(candidate._id, updates);

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "assessment-started",
    metadata: { jobTitle: job.title },
    company: candidate.company,
  });

  if (fromStage === "screening") {
    await ATSTimeline.create({
      candidate: candidate._id,
      job: job._id,
      action: "stage-changed",
      metadata: { from: "screening", to: "assessment", reason: "Started online assessment" },
      company: candidate.company,
    });
  }

  const questions = assessment.questions.map((q: any, idx: number) => ({
    index: idx,
    text: q.text,
    options: q.options,
    type: q.type === "essay" ? "essay" : "mcq",
  }));

  return NextResponse.json({
    ok: true,
    questions,
    durationMinutes: job.assessmentDurationMinutes || null,
    endsAt: job.assessmentDurationMinutes
      ? new Date(now.getTime() + job.assessmentDurationMinutes * 60 * 1000).toISOString()
      : null,
  });
}