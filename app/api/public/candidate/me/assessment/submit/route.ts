import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { buildAssessmentQuestions, computeAssessmentScore, pickDomain } from "@/lib/assessment";

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
  const answers: Array<{ questionIndex: number; selectedOption?: number; textAnswer?: string }> = Array.isArray(body.answers) ? body.answers : [];

  if (!answers.length) return jsonError("No answers provided.", 400);

  const job = await ATSJob.findById(candidate.job);
  if (!job) return jsonError("Job not found.", 404);

  const assessment = await ATSAssessment.findOne({ job: job._id, company: candidate.company });
  if (!assessment) return jsonError("Assessment not available.", 400);

  // Rebuild the exact question order the candidate received at /start.
  const chosenDomain = pickDomain((assessment.domains as any[]) || [], (candidate as any).assessmentDomain);
  const flatQuestions = buildAssessmentQuestions(
    (assessment.questions as any[]) || [],
    chosenDomain?.questions as any[] || []
  );
  if (!flatQuestions.length) return jsonError("Assessment not available.", 400);

  // Required questions (MCQ or essay) must be answered.
  const missingRequired: number[] = [];
  for (let i = 0; i < flatQuestions.length; i++) {
    const q = flatQuestions[i];
    if (!q.required) continue;
    const a = answers.find((x) => x.questionIndex === i);
    const answered =
      q.type === "essay"
        ? Boolean(a && String(a.textAnswer || "").trim())
        : a != null && typeof a.selectedOption === "number";
    if (!answered) missingRequired.push(i + 1);
  }
  if (missingRequired.length) {
    return jsonError(
      `Please answer the required question${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.join(", ")}.`,
      400
    );
  }

  // Auto-grade only multiple-choice questions; essays are stored for manual review.
  const negativeMarking = Math.max(0, Number((assessment as any).negativeMarking) || 0);
  const graded = computeAssessmentScore(answers, flatQuestions, negativeMarking);
  const { score, rawMarks, maxMarks, correct, mcqTotal, essayCount, hasEssays } = graded;

  // Check if auto-submitted (timer expired)
  const startedAt = new Date((candidate as any).assessmentStartedAt);
  const durationMin = job.assessmentDurationMinutes || null;
  const now = new Date();
  const autoSubmitted = durationMin ? now.getTime() > startedAt.getTime() + durationMin * 60 * 1000 : false;

  let status: string;
  let reason: string;
  if (hasEssays) {
    status = "pending";
    reason =
      maxMarks > 0
        ? `Score: ${score}/100 (${rawMarks}/${maxMarks} marks, multiple-choice). Essay answers require manual review.`
        : "Essay-only assessment — answers require manual review.";
  } else {
    const threshold = assessment.passScore || 50;
    status = score! >= threshold ? "selected" : "rejected";
    reason = autoSubmitted
      ? `Score: ${score}/100 (${rawMarks}/${maxMarks} marks; ${status === "selected" ? "Passed" : "Failed"}). Auto-submitted due to time limit.`
      : `Score: ${score}/100 (${rawMarks}/${maxMarks} marks; ${status === "selected" ? "Passed" : "Failed"}).`;
  }

  await ATSCandidate.findByIdAndUpdate(candidate._id, {
    assessmentScore: score,
    assessmentRawMarks: rawMarks,
    assessmentMaxMarks: maxMarks,
    assessmentDomain: chosenDomain?.name || "",
    assessmentStatus: status,
    assessmentReason: reason,
    assessmentSubmittedAt: now,
    assessmentAnswers: answers.map((a) => ({
      questionIndex: a.questionIndex,
      selectedOption: a.selectedOption ?? 0,
      textAnswer: String(a.textAnswer || "").trim().slice(0, 5000),
    })),
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "assessment-submitted",
    metadata: { score, rawMarks, maxMarks, total: flatQuestions.length, correct, mcqTotal, essayCount, autoSubmitted, hasEssays, domain: chosenDomain?.name || null },
    company: candidate.company,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "assessment-graded",
    metadata: {
      content: "Your assessment has been submitted. Results will be shared once the assessment has been reviewed.",
      status: "pending",
      passed: false,
      score, // retained for HR; not rendered on the candidate timeline
      outcome: status,
    },
    company: candidate.company,
  });

  return NextResponse.json({
    ok: true,
    submittedAt: now.toISOString(),
    message: "Assessment submitted. Results will be shared once the assessment has been reviewed.",
  });
}