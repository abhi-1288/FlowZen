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

  if (candidate.stage !== "assessment") return jsonError("You are not in the assessment stage.", 400);
  if ((candidate as any).assessmentSubmittedAt) return jsonError("Already submitted.", 400);
  if (!(candidate as any).assessmentStartedAt) return jsonError("You must start the assessment before submitting.", 400);

  const body = await request.json();
  const answers: Array<{ questionIndex: number; selectedOption: number }> = Array.isArray(body.answers) ? body.answers : [];

  if (!answers.length) return jsonError("No answers provided.", 400);

  const job = await ATSJob.findById(candidate.job);
  if (!job) return jsonError("Job not found.", 404);

  const assessment = await ATSAssessment.findOne({ job: job._id, company: candidate.company });
  if (!assessment || !assessment.questions.length) return jsonError("Assessment not available.", 400);

  // Auto-grade
  let correct = 0;
  const total = assessment.questions.length;
  for (const a of answers) {
    const q = assessment.questions[a.questionIndex];
    if (q && q.correctIndex === a.selectedOption) correct++;
  }
  const score = Math.round((correct / total) * 100);
  const threshold = assessment.passScore || 50;
  const status = score >= threshold ? "selected" : "rejected";

  // Check if auto-submitted (timer expired)
  const startedAt = new Date((candidate as any).assessmentStartedAt);
  const durationMin = job.assessmentDurationMinutes || null;
  const now = new Date();
  const autoSubmitted = durationMin ? now.getTime() > startedAt.getTime() + durationMin * 60 * 1000 : false;

  await ATSCandidate.findByIdAndUpdate(candidate._id, {
    assessmentScore: score,
    assessmentStatus: status,
    assessmentReason: autoSubmitted
      ? `Score: ${score}/100 (${status === "selected" ? "Passed" : "Failed"}). Auto-submitted due to time limit.`
      : `Score: ${score}/100 (${status === "selected" ? "Passed" : "Failed"}).`,
    assessmentSubmittedAt: now,
    assessmentAnswers: answers,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "assessment-submitted",
    metadata: { score, total, correct, autoSubmitted },
    company: candidate.company,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "assessment-graded",
    metadata: {
      content: `Assessment result: ${score}/100. ${status === "selected" ? "Passed." : "Failed."}`,
      score,
      status,
      passed: status === "selected",
    },
    company: candidate.company,
  });

  return NextResponse.json({
    ok: true,
    score,
    status,
    submittedAt: now.toISOString(),
    message: status === "selected" ? "You have passed the assessment." : "Assessment submitted. You will be notified of the result.",
  });
}