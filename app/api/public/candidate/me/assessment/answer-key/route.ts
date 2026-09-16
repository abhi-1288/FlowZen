import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { pickDomain } from "@/lib/assessment";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  if (!(candidate as any).assessmentSubmittedAt) return jsonError("You have not submitted the assessment.", 400);
  if (!(candidate as any).assessmentResultPublishedAt) return jsonError("Your results have not been published yet.", 403);

  const job = await ATSJob.findById(candidate.job).select("title");
  if (!job) return jsonError("Job not found.", 404);

  const assessment = await ATSAssessment.findOne({ job: job._id, company: candidate.company });
  if (!assessment) return jsonError("Assessment not available.", 400);
  if (!(assessment as any).answerKeyPublished) return jsonError("Answer key has not been published yet.", 403);

  // Rebuild the exact question order the candidate received at /start.
  const domainName = (candidate as any).assessmentDomain || "";
  const chosenDomain = pickDomain((assessment.domains as any[]) || [], domainName);
  const sourceQuestions = [
    ...(assessment.questions as any[]) || [],
    ...(chosenDomain?.questions as any[]) || [],
  ];

  const questions = sourceQuestions.map((q: any, idx: number) => {
    const a = ((candidate as any).assessmentAnswers || []).find((x: any) => x.questionIndex === idx);
    return {
      index: idx,
      text: q.text ?? "",
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: q.correctIndex ?? 0,
      marks: Math.max(0, Number(q.marks) || 1),
      required: Boolean(q.required),
      type: q.type === "essay" ? "essay" : "mcq",
      answer: q.answer ?? "",
      selectedOption: a?.selectedOption ?? null,
      textAnswer: a?.textAnswer ?? "",
    };
  });

  return NextResponse.json({
    candidate: {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
    },
    jobTitle: job.title,
    domain: domainName || null,
    score: (candidate as any).assessmentScore ?? null,
    rawMarks: (candidate as any).assessmentRawMarks ?? null,
    maxMarks: (candidate as any).assessmentMaxMarks ?? null,
    passScore: (assessment as any).passScore ?? 50,
    negativeMarking: (assessment as any).negativeMarking ?? 0,
    startedAt: (candidate as any).assessmentStartedAt?.toISOString() ?? null,
    submittedAt: (candidate as any).assessmentSubmittedAt?.toISOString() ?? null,
    publishedAt: (assessment as any).answerKeyPublishedAt?.toISOString() ?? null,
    questions,
  });
}
